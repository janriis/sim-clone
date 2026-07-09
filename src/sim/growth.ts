import { CAPACITY, GROWTH } from '../config';
import { idx, xy } from '../core/grid';
import { chance, pickInt } from '../core/rng';
import {
  ZONE_COM,
  ZONE_IND,
  ZONE_NONE,
  ZONE_RES,
  type Building,
  type GameState,
  type ZoneType,
} from '../core/types';

function demandFor(state: GameState, zone: ZoneType): number {
  if (zone === ZONE_RES) return state.demand.res;
  if (zone === ZONE_COM) return state.demand.com;
  if (zone === ZONE_IND) return state.demand.ind;
  return 0;
}

export function capacityOf(b: Building): number {
  if (b.zone === ZONE_RES) return CAPACITY.res * b.level * b.level;
  if (b.zone === ZONE_COM) return CAPACITY.com * b.level * b.level;
  if (b.zone === ZONE_IND) return CAPACITY.ind * b.level * b.level;
  return 0;
}

function spawnBuilding(state: GameState, x: number, y: number, zone: ZoneType): void {
  const b: Building = {
    id: state.nextBuildingId++,
    kind: 'zone',
    zone,
    level: 1,
    x,
    y,
    w: 1,
    h: 1,
    condition: GROWTH.spawnCondition,
    abandoned: false,
    population: 0,
    jobs: 0,
  };
  state.buildings[b.id] = b;
  const t = state.tiles[idx(x, y)];
  t.buildingId = b.id;
  t.tree = false;
  state.dirty.meshes = true;
  state.dirty.power = true; // buildings conduct power
  state.dirty.fields = true;
}

/** Sample random zoned empty tiles and maybe grow a building on them. */
function trySpawns(state: GameState): void {
  const n = state.tiles.length;
  for (let s = 0; s < GROWTH.samplesPerTick; s++) {
    const i = pickInt(state, n);
    const t = state.tiles[i];
    if (
      t.zone === ZONE_NONE ||
      t.buildingId !== 0 ||
      t.road ||
      t.terrain === 'water' ||
      t.rubble > 0 ||
      t.fire > 0
    )
      continue;
    const demand = demandFor(state, t.zone);
    if (demand <= 0 || !t.powered || !t.roadAccess) continue;
    if (chance(state, (demand / 100) * GROWTH.spawnChanceAtFullDemand)) {
      const [x, y] = xy(i);
      spawnBuilding(state, x, y, t.zone);
    }
  }
}

/** Per-building condition, level-ups, abandonment, occupancy drift. */
function updateBuildings(state: GameState): void {
  let population = 0;
  let jobs = 0;

  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind !== 'zone') continue;
    const t = state.tiles[idx(b.x, b.y)];
    const demand = demandFor(state, b.zone);
    const tax =
      b.zone === ZONE_RES
        ? state.taxRates.res
        : b.zone === ZONE_COM
          ? state.taxRates.com
          : state.taxRates.ind;

    if (b.abandoned) {
      // Chance to re-occupy when conditions recover.
      if (
        t.powered &&
        t.roadAccess &&
        demand > GROWTH.reoccupyMinDemand &&
        chance(state, GROWTH.reoccupyChance)
      ) {
        b.abandoned = false;
        b.level = 1;
        b.condition = 50;
        state.dirty.meshes = true;
      }
      continue;
    }

    // --- condition score ---
    let score = 0;
    score += t.powered ? 1 : -4;
    score += t.roadAccess ? 1 : -4;
    score += demand > 0 ? 1 : -1;
    if (t.landValue > 40) score += 1;
    if (b.zone === ZONE_RES && t.pollution > 50) score -= 2;
    if (tax > 12) score -= 2;
    b.condition = Math.max(0, Math.min(100, b.condition + score));

    if (b.condition <= 0) {
      b.abandoned = true;
      b.population = 0;
      b.jobs = 0;
      state.dirty.meshes = true;
      state.dirty.fields = true;
      continue;
    }

    // --- level up ---
    if (
      b.level < 3 &&
      b.condition > GROWTH.levelUpMinCondition &&
      demand > GROWTH.levelUpMinDemand &&
      t.landValue > GROWTH.levelUpLandValuePerLevel * b.level &&
      chance(state, GROWTH.levelUpChance)
    ) {
      b.level = (b.level + 1) as Building['level'];
      state.dirty.meshes = true;
      state.dirty.fields = true; // industry pollution scales with level
    }

    // --- occupancy drift ---
    const cap = b.condition < 30 ? 0 : capacityOf(b);
    if (b.zone === ZONE_RES) {
      b.population += (cap - b.population) * GROWTH.occupancyDrift;
      if (b.population < 0.5 && cap === 0) b.population = 0;
      population += b.population;
    } else {
      b.jobs += (cap - b.jobs) * GROWTH.occupancyDrift;
      if (b.jobs < 0.5 && cap === 0) b.jobs = 0;
      jobs += b.jobs;
    }
  }

  state.population = Math.round(population);
  state.jobs = Math.round(jobs);
}

export function tickGrowth(state: GameState): void {
  trySpawns(state);
  updateBuildings(state);
}
