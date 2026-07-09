import { DAYS_PER_MONTH, EVENTS, FIRE, MILESTONES, MILESTONE_GRANT_PER_POP } from '../config';
import { forEachNeighbor4, idx, xy } from '../core/grid';
import { chance, nextFloat, pickInt } from '../core/rng';
import type { GameEvent, GameState } from '../core/types';

/** Fire suppression coverage at a tile: max over powered fire stations of 1 - dist/radius. */
export function fireCoverage(state: GameState, x: number, y: number): number {
  let best = 0;
  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind !== 'service' || b.service !== 'fire') continue;
    if (!state.tiles[idx(b.x, b.y)].powered) continue;
    const dist = Math.abs(b.x - x) + Math.abs(b.y - y);
    if (dist < FIRE.stationRadius) best = Math.max(best, 1 - dist / FIRE.stationRadius);
  }
  return best;
}

function destroyBuilding(state: GameState, buildingId: number): void {
  const b = state.buildings[buildingId];
  if (!b) return;
  const wasPlant = b.kind === 'service' && b.service === 'power';
  for (let dy = 0; dy < b.h; dy++) {
    for (let dx = 0; dx < b.w; dx++) {
      const t = state.tiles[idx(b.x + dx, b.y + dy)];
      t.buildingId = 0;
      t.rubble = FIRE.rubbleDays;
      t.fire = 0;
    }
  }
  delete state.buildings[buildingId];
  state.dirty.meshes = true;
  state.dirty.fields = true;
  if (wasPlant) state.dirty.power = true;
}

/** Runs every tick while anything is burning: decay timers, spread to neighbors. */
export function tickFire(state: GameState, events: GameEvent[]): void {
  const burning: number[] = [];
  for (let i = 0; i < state.tiles.length; i++) {
    if (state.tiles[i].fire > 0) burning.push(i);
  }
  if (burning.length === 0) return;

  for (const i of burning) {
    const t = state.tiles[i];
    const [x, y] = xy(i);

    // spread
    forEachNeighbor4(x, y, (nx, ny) => {
      const nt = state.tiles[idx(nx, ny)];
      if (nt.fire > 0 || nt.buildingId === 0 || nt.road || nt.terrain === 'water') return;
      const cov = fireCoverage(state, nx, ny);
      if (chance(state, FIRE.spreadChance * (1 - cov))) {
        nt.fire = FIRE.burnTicks;
        state.dirty.meshes = true;
      }
    });

    // burn down
    t.fire--;
    if (t.fire <= 0) {
      if (t.buildingId !== 0) {
        const b = state.buildings[t.buildingId];
        if (b?.kind === 'service' && b.service === 'power') {
          events.push({
            kind: 'bad',
            title: 'Power plant destroyed!',
            detail: 'A fire has burned down a power plant. Expect blackouts.',
          });
        }
        destroyBuilding(state, t.buildingId);
      } else {
        t.fire = 0;
      }
      state.dirty.meshes = true;
    }
  }
  state.dirty.fields = true; // burning tiles pollute
}

/** Decay rubble back to buildable land. */
export function tickRubble(state: GameState): void {
  for (const t of state.tiles) {
    if (t.rubble > 0) {
      t.rubble--;
      if (t.rubble === 0) state.dirty.meshes = true;
    }
  }
}

function igniteRandomBuilding(state: GameState, events: GameEvent[]): void {
  const candidates: number[] = [];
  for (let i = 0; i < state.tiles.length; i++) {
    const t = state.tiles[i];
    if (t.buildingId !== 0 && t.fire === 0) candidates.push(i);
  }
  if (candidates.length === 0) return;
  const i = candidates[pickInt(state, candidates.length)];
  const [x, y] = xy(i);
  // coverage halves ignition chance
  if (nextFloat(state) < fireCoverage(state, x, y) * 0.5) return;
  state.tiles[i].fire = FIRE.burnTicks;
  state.dirty.meshes = true;
  events.push({
    kind: 'bad',
    title: 'Fire!',
    detail: `A fire has broken out at (${x}, ${y}). Roads act as firebreaks.`,
  });
}

/** Monthly event roll: fire / boom / recession (exclusive with an active modifier). */
export function rollMonthlyEvents(state: GameState, events: GameEvent[]): void {
  if (state.modifier && state.day >= state.modifier.expiresDay) {
    events.push({
      kind: 'info',
      title: `${state.modifier.label} is over`,
      detail: 'The economy returns to normal.',
    });
    state.modifier = null;
  }

  const roll = nextFloat(state);
  if (roll < EVENTS.fireChance) {
    igniteRandomBuilding(state, events);
  } else if (state.modifier === null) {
    if (roll < EVENTS.fireChance + EVENTS.boomChance) {
      state.modifier = {
        demandMult: EVENTS.boomMult,
        label: 'Economic boom',
        expiresDay: state.day + EVENTS.modifierMonths * DAYS_PER_MONTH,
      };
      events.push({
        kind: 'good',
        title: 'Economic boom!',
        detail: 'Demand for all zones surges for the next 6 months.',
      });
    } else if (roll < EVENTS.fireChance + EVENTS.boomChance + EVENTS.recessionChance) {
      state.modifier = {
        demandMult: EVENTS.recessionMult,
        label: 'Recession',
        expiresDay: state.day + EVENTS.modifierMonths * DAYS_PER_MONTH,
      };
      events.push({
        kind: 'bad',
        title: 'Recession',
        detail: 'Demand collapses for 6 months. Hold on tight.',
      });
    }
  }
}

/** Population milestones: toast + cash grant, each fired once. */
export function checkMilestones(state: GameState, events: GameEvent[]): void {
  for (const m of MILESTONES) {
    if (state.population >= m && !state.milestonesHit.includes(m)) {
      state.milestonesHit.push(m);
      const grant = m * MILESTONE_GRANT_PER_POP;
      state.money += grant;
      events.push({
        kind: 'good',
        title: `Population ${m.toLocaleString()}!`,
        detail: `The regional government awards a §${grant.toLocaleString()} grant.`,
      });
    }
  }
}
