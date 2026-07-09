import { COST, SERVICE_SIZE } from '../config';
import { idx, inBounds } from '../core/grid';
import {
  ZONE_NONE,
  type Building,
  type GameState,
  type ServiceType,
  type ZoneType,
} from '../core/types';

// The ONLY mutation entry point for player input. Every action validates,
// charges the treasury, and raises the right dirty flags.

export interface ActionResult {
  ok: boolean;
  reason?: string;
  cost: number;
}

const fail = (reason: string): ActionResult => ({ ok: false, reason, cost: 0 });

function canAfford(state: GameState, cost: number): ActionResult | null {
  if (state.money < 0) return fail('City is in debt');
  if (state.money < cost) return fail('Not enough funds');
  return null;
}

export function canBuildRoadAt(state: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const t = state.tiles[idx(x, y)];
  return t.terrain !== 'water' && t.buildingId === 0 && t.rubble === 0 && !t.road;
}

export function buildRoad(state: GameState, tilesXY: Array<[number, number]>): ActionResult {
  const buildable = tilesXY.filter(([x, y]) => canBuildRoadAt(state, x, y));
  if (buildable.length === 0) return fail('Nowhere to build');
  const cost = buildable.length * COST.road;
  const broke = canAfford(state, cost);
  if (broke) return broke;

  for (const [x, y] of buildable) {
    const t = state.tiles[idx(x, y)];
    t.road = true;
    t.zone = ZONE_NONE;
    t.tree = false;
  }
  state.money -= cost;
  state.dirty.roads = true;
  state.dirty.access = true;
  state.dirty.power = true;
  return { ok: true, cost };
}

export function canZoneAt(state: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const t = state.tiles[idx(x, y)];
  return t.terrain !== 'water' && !t.road && t.buildingId === 0 && t.rubble === 0;
}

export function paintZone(
  state: GameState,
  tilesXY: Array<[number, number]>,
  zone: ZoneType,
): ActionResult {
  const paintable = tilesXY.filter(
    ([x, y]) => canZoneAt(state, x, y) && state.tiles[idx(x, y)].zone !== zone,
  );
  if (paintable.length === 0) return fail('Nothing to zone');
  const cost = paintable.length * COST.zone;
  const broke = canAfford(state, cost);
  if (broke) return broke;

  for (const [x, y] of paintable) {
    const t = state.tiles[idx(x, y)];
    t.zone = zone;
    t.tree = false;
  }
  state.money -= cost;
  state.dirty.meshes = true; // zone tint overlay
  state.dirty.power = true; // zoned tiles conduct
  return { ok: true, cost };
}

export function serviceFootprint(service: ServiceType): number {
  return SERVICE_SIZE[service];
}

export function canPlaceServiceAt(
  state: GameState,
  x: number,
  y: number,
  service: ServiceType,
): boolean {
  const s = serviceFootprint(service);
  for (let dy = 0; dy < s; dy++) {
    for (let dx = 0; dx < s; dx++) {
      if (!inBounds(x + dx, y + dy)) return false;
      const t = state.tiles[idx(x + dx, y + dy)];
      if (t.terrain === 'water' || t.road || t.buildingId !== 0 || t.rubble > 0) return false;
    }
  }
  return true;
}

export function placeService(
  state: GameState,
  x: number,
  y: number,
  service: ServiceType,
): ActionResult {
  if (!canPlaceServiceAt(state, x, y, service)) return fail('Blocked');
  const cost = COST[service];
  const broke = canAfford(state, cost);
  if (broke) return broke;

  const s = serviceFootprint(service);
  const b: Building = {
    id: state.nextBuildingId++,
    kind: 'service',
    zone: ZONE_NONE,
    service,
    level: 1,
    x,
    y,
    w: s,
    h: s,
    condition: 100,
    abandoned: false,
    population: 0,
    jobs: 0,
  };
  state.buildings[b.id] = b;
  for (let dy = 0; dy < s; dy++) {
    for (let dx = 0; dx < s; dx++) {
      const t = state.tiles[idx(x + dx, y + dy)];
      t.buildingId = b.id;
      t.zone = ZONE_NONE;
      t.tree = false;
    }
  }
  state.money -= cost;
  state.dirty.meshes = true;
  state.dirty.power = true;
  state.dirty.fields = true;
  return { ok: true, cost };
}

export function bulldoze(state: GameState, tilesXY: Array<[number, number]>): ActionResult {
  let cleared = 0;
  const clearedBuildings = new Set<number>();

  // Pass 1: what will this cost?
  for (const [x, y] of tilesXY) {
    if (!inBounds(x, y)) continue;
    const t = state.tiles[idx(x, y)];
    if (t.road || t.zone !== ZONE_NONE || t.tree || t.rubble > 0) cleared++;
    if (t.buildingId !== 0) clearedBuildings.add(t.buildingId);
  }
  if (cleared === 0 && clearedBuildings.size === 0) return fail('Nothing to demolish');
  const cost = (cleared + clearedBuildings.size) * COST.bulldoze;
  const broke = canAfford(state, cost);
  if (broke) return broke;

  for (const [x, y] of tilesXY) {
    if (!inBounds(x, y)) continue;
    const t = state.tiles[idx(x, y)];
    if (t.road) state.dirty.roads = true;
    t.road = false;
    t.zone = ZONE_NONE;
    t.tree = false;
    t.rubble = 0;
    t.fire = 0;
  }
  for (const id of clearedBuildings) {
    const b = state.buildings[id];
    if (!b) continue;
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const t = state.tiles[idx(b.x + dx, b.y + dy)];
        t.buildingId = 0;
        t.zone = ZONE_NONE;
      }
    }
    delete state.buildings[id];
  }
  state.money -= cost;
  state.dirty.meshes = true;
  state.dirty.access = true;
  state.dirty.power = true;
  state.dirty.fields = true;
  return { ok: true, cost };
}
