import { describe, expect, it } from 'vitest';
import { idx } from '../src/core/grid';
import { buildRoad, bulldoze, placeService, paintZone } from '../src/sim/actions';
import { recomputePower } from '../src/sim/power';
import { flatten, testGame } from './helpers';

describe('power propagation', () => {
  it('powers tiles connected to a plant via roads', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power');
    buildRoad(state, [[12, 10], [13, 10], [14, 10], [15, 10]]);
    recomputePower(state);
    // road adjacent to plant conducts... but only if contiguous: 12,10 touches plant at 10..11
    expect(state.tiles[idx(12, 10)].powered).toBe(true);
    expect(state.tiles[idx(15, 10)].powered).toBe(true);
  });

  it('cutting the road unpowers the far side', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power');
    buildRoad(state, [[12, 10], [13, 10], [14, 10], [15, 10]]);
    recomputePower(state);
    expect(state.tiles[idx(15, 10)].powered).toBe(true);

    bulldoze(state, [[13, 10]]);
    recomputePower(state);
    expect(state.tiles[idx(15, 10)].powered).toBe(false);
    expect(state.tiles[idx(12, 10)].powered).toBe(true);
  });

  it('zoned tiles conduct power', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power');
    paintZone(state, [[12, 10], [13, 10], [14, 10]], 1);
    recomputePower(state);
    expect(state.tiles[idx(14, 10)].powered).toBe(true);
  });

  it('unconnected tiles stay dark', () => {
    const state = testGame();
    flatten(state, 8, 8, 40, 20);
    placeService(state, 10, 10, 'power');
    buildRoad(state, [[30, 10], [31, 10]]);
    recomputePower(state);
    expect(state.tiles[idx(30, 10)].powered).toBe(false);
  });
});
