import { describe, expect, it } from 'vitest';
import { idx } from '../src/core/grid';
import { buildRoad, buildWire, bulldoze, paintZone, placeService } from '../src/sim/actions';
import { recomputePower } from '../src/sim/power';
import { recomputeWater } from '../src/sim/water';
import { flatten, runWithCaretaker, testGame } from './helpers';

describe('power lines', () => {
  it('an isolated plant powers nothing until a wire connects it', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power'); // 2x2, touching nothing
    buildRoad(state, [
      [16, 10],
      [17, 10],
      [18, 10],
    ]);
    recomputePower(state);
    expect(state.tiles[idx(16, 10)].powered).toBe(false);

    // wire from plant edge (12,10 is right of the 2x2 at 10..11) to the road at 16
    buildWire(state, [
      [12, 10],
      [13, 10],
      [14, 10],
      [15, 10],
    ]);
    recomputePower(state);
    expect(state.tiles[idx(16, 10)].powered).toBe(true);
    expect(state.tiles[idx(18, 10)].powered).toBe(true);
  });

  it('roads absorb wires when built over them', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    buildWire(state, [[20, 10]]);
    expect(state.tiles[idx(20, 10)].wire).toBe(true);
    buildRoad(state, [[20, 10]]);
    expect(state.tiles[idx(20, 10)].road).toBe(true);
    expect(state.tiles[idx(20, 10)].wire).toBe(false);
  });

  it('bulldozing a wire cuts the circuit', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power');
    buildWire(state, [
      [12, 10],
      [13, 10],
      [14, 10],
    ]);
    recomputePower(state);
    expect(state.tiles[idx(14, 10)].powered).toBe(true);
    bulldoze(state, [[13, 10]]);
    recomputePower(state);
    expect(state.tiles[idx(14, 10)].powered).toBe(false);
  });
});

describe('water supply', () => {
  function pumpedTown(pumpPowered: boolean) {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    buildRoad(state, Array.from({ length: 20 }, (_, i) => [10 + i, 14] as [number, number]));
    paintZone(state, [
      [14, 13],
      [15, 13],
      [16, 13],
    ], 1);
    if (pumpPowered) placeService(state, 10, 12, 'power'); // touches road
    placeService(state, 13, 13, 'pump'); // touches road
    recomputePower(state);
    recomputeWater(state);
    return state;
  }

  it('a powered pump waters tiles along roads and zones', () => {
    const state = pumpedTown(true);
    expect(state.tiles[idx(13, 13)].powered).toBe(true);
    expect(state.tiles[idx(16, 13)].watered).toBe(true);
    expect(state.tiles[idx(29, 14)].watered).toBe(true); // far down the road
  });

  it('an unpowered pump supplies nothing', () => {
    const state = pumpedTown(false);
    expect(state.tiles[idx(16, 13)].watered).toBe(false);
  });

  it('wires conduct power but not water', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power');
    placeService(state, 12, 10, 'pump'); // touches plant -> powered
    buildWire(state, [
      [13, 10],
      [14, 10],
    ]);
    buildRoad(state, [[12, 11]]); // touches pump -> carries water
    recomputePower(state);
    recomputeWater(state);
    expect(state.tiles[idx(14, 10)].powered).toBe(true);
    expect(state.tiles[idx(14, 10)].watered).toBe(false);
    expect(state.tiles[idx(12, 11)].watered).toBe(true);
  });

  it('unwatered towns stall at level 1 and half occupancy', () => {
    const state = testGame(555);
    flatten(state, 8, 8, 40, 20);
    const road: Array<[number, number]> = [];
    for (let x = 10; x <= 38; x++) road.push([x, 14]);
    buildRoad(state, road);
    placeService(state, 10, 12, 'power');
    const zones: Array<[number, number]> = [];
    for (let x = 14; x <= 38; x++) zones.push([x, 13], [x, 15]);
    paintZone(state, zones, 1);
    runWithCaretaker(state, 1800);
    const buildings = Object.values(state.buildings).filter((b) => b.kind === 'zone' && !b.abandoned);
    expect(buildings.length).toBeGreaterThan(5);
    expect(buildings.every((b) => b.level === 1)).toBe(true);
    // level-1 res capacity is 8; unwatered caps at 4
    for (const b of buildings) expect(b.population).toBeLessThanOrEqual(4.5);
  });
});
