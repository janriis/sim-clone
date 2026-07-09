import { GRID_SIZE, STARTING_MONEY, TAX_DEFAULT } from '../config';
import { idx } from './grid';
import { hash2 } from './rng';
import { allDirty, ZONE_NONE, type GameState, type Tile } from './types';

function blankTile(): Tile {
  return {
    terrain: 'grass',
    elevation: 0,
    zone: ZONE_NONE,
    road: false,
    buildingId: 0,
    tree: false,
    rubble: 0,
    powered: false,
    roadAccess: false,
    landValue: 0,
    pollution: 0,
    fire: 0,
  };
}

/** Smooth value noise from the coordinate hash — deterministic per seed, no RNG state consumed. */
function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const h = (gx: number, gy: number) => hash2(gx * 7919 + seed, gy * 104729 - seed);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function createNewGame(seed: number): GameState {
  const size = GRID_SIZE;
  const tiles: Tile[] = new Array(size * size);
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = blankTile();
      const noise =
        valueNoise(x, y, 14, seed) * 0.65 + valueNoise(x, y, 5, seed * 3 + 1) * 0.35;
      // Radial falloff sinks the map edges below water level -> island with a shore rim.
      const dx = (x - half + 0.5) / half;
      const dy = (y - half + 0.5) / half;
      const edge = Math.max(Math.abs(dx), Math.abs(dy));
      const height = noise * 0.75 + 0.45 - Math.pow(edge, 3.2) * 1.15;
      if (height < 0.18) {
        t.terrain = 'water';
        t.elevation = 0;
      } else {
        t.elevation = Math.min(1, Math.max(0, (height - 0.18) / 0.8));
        // Scatter some decorative trees on higher inland ground.
        const treeNoise = hash2(x * 31 + seed, y * 17 - seed);
        if (treeNoise > 0.86 && t.elevation > 0.25) t.tree = true;
      }
      tiles[idx(x, y)] = t;
    }
  }

  return {
    version: 1,
    seed,
    rngState: seed | 0 || 1,
    size,
    tiles,
    buildings: {},
    nextBuildingId: 1,
    money: STARTING_MONEY,
    taxRates: { res: TAX_DEFAULT, com: TAX_DEFAULT, ind: TAX_DEFAULT },
    demand: { res: 0, com: 0, ind: 0 },
    population: 0,
    jobs: 0,
    day: 0,
    speed: 1,
    modifier: null,
    milestonesHit: [],
    dirty: allDirty(),
  };
}
