import { createNewGame } from '../src/core/state';
import { idx } from '../src/core/grid';
import type { GameState, ZoneType } from '../src/core/types';
import { buildRoad, paintZone, placeService } from '../src/sim/actions';
import { tick } from '../src/sim/simulation';

/** A fresh game with a deterministic seed and all-grass terrain (no water lakes in the middle). */
export function testGame(seed = 12345): GameState {
  const state = createNewGame(seed);
  state.money = 1_000_000; // tests shouldn't hit funding limits unless they want to
  return state;
}

/** Force a rectangle of tiles to grass so layouts are placeable regardless of seed. */
export function flatten(state: GameState, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = state.tiles[idx(x, y)];
      t.terrain = 'grass';
      t.elevation = 0.4;
      t.tree = false;
    }
  }
}

/** Build a standard starter town: road spine, power plant, zoned strips on both sides. */
export function buildStarterTown(state: GameState, zone: ZoneType | 'mixed' = 'mixed'): void {
  flatten(state, 8, 8, 40, 20);
  const road: Array<[number, number]> = [];
  for (let x = 10; x <= 38; x++) road.push([x, 14]);
  buildRoad(state, road);
  placeService(state, 10, 12, 'power'); // 2x2, bottom edge touches the road spine at y=14

  const north: Array<[number, number]> = [];
  const south: Array<[number, number]> = [];
  for (let x = 14; x <= 38; x++) {
    north.push([x, 13], [x, 12]);
    south.push([x, 15], [x, 16]);
  }
  if (zone === 'mixed') {
    paintZone(state, north, 1);
    paintZone(state, south.filter(([x]) => x < 27), 2);
    paintZone(state, south.filter(([x]) => x >= 27), 3);
  } else {
    paintZone(state, [...north, ...south], zone);
  }
}

export function run(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) tick(state);
}

/**
 * Run the sim like a minimal player: if fire razes the power plant, rebuild it
 * at a spot touching the starter town's road spine (y=14) so it conducts.
 */
export function runWithCaretaker(state: GameState, ticks: number): void {
  const spots: Array<[number, number]> = [
    [10, 12],
    [12, 12],
    [16, 12],
    [20, 12],
    [24, 12],
  ];
  for (let i = 0; i < ticks; i++) {
    tick(state);
    if (i % 30 === 0) {
      const hasPlant = Object.values(state.buildings).some(
        (b) => b.kind === 'service' && b.service === 'power',
      );
      if (!hasPlant && state.money > 3000) {
        for (const [x, y] of spots) {
          if (placeService(state, x, y, 'power').ok) break;
        }
      }
    }
  }
}
