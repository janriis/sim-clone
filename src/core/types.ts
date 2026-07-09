// Shared contract between simulation and rendering. Pure types, no imports.

export const ZONE_NONE = 0;
export const ZONE_RES = 1;
export const ZONE_COM = 2;
export const ZONE_IND = 3;
export type ZoneType = typeof ZONE_NONE | typeof ZONE_RES | typeof ZONE_COM | typeof ZONE_IND;

export type ServiceType = 'power' | 'police' | 'fire' | 'park' | 'school';

export type Terrain = 'grass' | 'water';

export interface Tile {
  terrain: Terrain;
  elevation: number; // 0..1, visual + small land value bonus
  zone: ZoneType;
  road: boolean;
  buildingId: number; // 0 = none
  tree: boolean; // decorative, cleared by any construction
  rubble: number; // days of rubble remaining after a fire (0 = none)
  // derived caches, recomputed by sim:
  powered: boolean;
  roadAccess: boolean;
  landValue: number; // 0..100
  pollution: number; // 0..100
  fire: number; // 0 = not burning, >0 = ticks until burn-out
}

export type BuildingKind = 'zone' | 'service';

export interface Building {
  id: number;
  kind: BuildingKind;
  zone: ZoneType; // meaningful for kind === 'zone'
  service?: ServiceType;
  level: 1 | 2 | 3;
  x: number;
  y: number;
  w: number;
  h: number;
  condition: number; // 0..100, 0 => abandoned
  abandoned: boolean;
  population: number; // res occupancy
  jobs: number; // com/ind occupancy
}

export type Speed = 0 | 1 | 2 | 3;

export interface EventModifier {
  demandMult: number;
  label: string;
  expiresDay: number;
}

export interface Demand {
  res: number;
  com: number;
  ind: number;
}

export interface DirtyFlags {
  power: boolean;
  access: boolean;
  fields: boolean;
  meshes: boolean;
  roads: boolean;
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  size: number;
  tiles: Tile[];
  buildings: Record<number, Building>;
  nextBuildingId: number;
  money: number;
  taxRates: { res: number; com: number; ind: number };
  demand: Demand;
  population: number;
  jobs: number;
  day: number;
  speed: Speed;
  modifier: EventModifier | null;
  milestonesHit: number[];
  // transient (not serialized):
  dirty: DirtyFlags;
}

export type Tool =
  | 'select'
  | 'road'
  | 'zone-res'
  | 'zone-com'
  | 'zone-ind'
  | 'power'
  | 'police'
  | 'fire'
  | 'park'
  | 'school'
  | 'bulldoze';

export interface GameEvent {
  kind: 'info' | 'good' | 'bad';
  title: string;
  detail: string;
}

export function allDirty(): DirtyFlags {
  return { power: true, access: true, fields: true, meshes: true, roads: true };
}
