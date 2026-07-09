import { SAVE_KEY } from '../config';
import { allDirty, type Building, type GameState, type Tile } from './types';

// Tiles are packed into parallel numeric arrays: ~30KB of JSON instead of 4096 objects.
interface SaveFile {
  version: 1;
  seed: number;
  rngState: number;
  size: number;
  // per-tile arrays
  terrain: number[]; // 0 grass, 1 water
  elevation: number[];
  zone: number[];
  road: number[];
  wire?: number[]; // optional: older saves predate power lines
  buildingId: number[];
  tree: number[];
  rubble: number[];
  fire: number[];
  // buildings + scalars
  buildings: Building[];
  nextBuildingId: number;
  money: number;
  taxRates: GameState['taxRates'];
  population: number;
  jobs: number;
  day: number;
  modifier: GameState['modifier'];
  milestonesHit: number[];
}

export function serialize(state: GameState): string {
  const n = state.tiles.length;
  const save: SaveFile = {
    version: 1,
    seed: state.seed,
    rngState: state.rngState,
    size: state.size,
    terrain: new Array(n),
    elevation: new Array(n),
    zone: new Array(n),
    road: new Array(n),
    wire: new Array(n),
    buildingId: new Array(n),
    tree: new Array(n),
    rubble: new Array(n),
    fire: new Array(n),
    buildings: Object.values(state.buildings),
    nextBuildingId: state.nextBuildingId,
    money: state.money,
    taxRates: state.taxRates,
    population: state.population,
    jobs: state.jobs,
    day: state.day,
    modifier: state.modifier,
    milestonesHit: state.milestonesHit,
  };
  for (let i = 0; i < n; i++) {
    const t = state.tiles[i];
    save.terrain[i] = t.terrain === 'water' ? 1 : 0;
    save.elevation[i] = Math.round(t.elevation * 1000) / 1000;
    save.zone[i] = t.zone;
    save.road[i] = t.road ? 1 : 0;
    save.wire![i] = t.wire ? 1 : 0;
    save.buildingId[i] = t.buildingId;
    save.tree[i] = t.tree ? 1 : 0;
    save.rubble[i] = t.rubble;
    save.fire[i] = t.fire;
  }
  return JSON.stringify(save);
}

export function deserialize(json: string): GameState | null {
  let save: SaveFile;
  try {
    save = JSON.parse(json);
  } catch {
    return null;
  }
  if (!save || save.version !== 1 || !Array.isArray(save.terrain)) return null;

  const n = save.size * save.size;
  const tiles: Tile[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tiles[i] = {
      terrain: save.terrain[i] === 1 ? 'water' : 'grass',
      elevation: save.elevation[i],
      zone: save.zone[i] as Tile['zone'],
      road: save.road[i] === 1,
      wire: save.wire?.[i] === 1,
      buildingId: save.buildingId[i],
      tree: save.tree[i] === 1,
      rubble: save.rubble[i],
      fire: save.fire[i],
      // derived caches recomputed via dirty flags on load:
      powered: false,
      watered: false,
      roadAccess: false,
      landValue: 0,
      pollution: 0,
    };
  }
  const buildings: Record<number, Building> = {};
  for (const b of save.buildings) buildings[b.id] = b;

  return {
    version: 1,
    seed: save.seed,
    rngState: save.rngState,
    size: save.size,
    tiles,
    buildings,
    nextBuildingId: save.nextBuildingId,
    money: save.money,
    taxRates: save.taxRates,
    demand: { res: 0, com: 0, ind: 0 },
    population: save.population,
    jobs: save.jobs,
    day: save.day,
    speed: 1,
    modifier: save.modifier,
    milestonesHit: save.milestonesHit,
    dirty: allDirty(),
  };
}

export function saveToStorage(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // storage full/unavailable — non-fatal
  }
}

export function loadFromStorage(): GameState | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    return json ? deserialize(json) : null;
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
