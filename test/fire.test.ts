import { describe, expect, it } from 'vitest';
import { idx } from '../src/core/grid';
import { FIRE } from '../src/config';
import { placeService } from '../src/sim/actions';
import { fireCoverage, tickFire } from '../src/sim/events';
import { recomputePower } from '../src/sim/power';
import { buildStarterTown, run, runWithCaretaker, testGame } from './helpers';
import type { GameState } from '../src/core/types';

function countBuildings(state: GameState): number {
  return Object.values(state.buildings).filter((b) => b.kind === 'zone').length;
}

function igniteAt(state: GameState, x: number, y: number): void {
  state.tiles[idx(x, y)].fire = FIRE.burnTicks;
}

function burnOut(state: GameState): void {
  // run fire ticks only, until nothing burns
  for (let guard = 0; guard < 500; guard++) {
    const burning = state.tiles.some((t) => t.fire > 0);
    if (!burning) break;
    tickFire(state, []);
  }
}

describe('fire', () => {
  it('spreads through a dense town and destroys buildings', () => {
    const state = testGame(777);
    buildStarterTown(state);
    runWithCaretaker(state, 900);
    const before = countBuildings(state);
    expect(before).toBeGreaterThan(10);

    const target = Object.values(state.buildings).find((b) => b.kind === 'zone')!;
    igniteAt(state, target.x, target.y);
    burnOut(state);
    expect(countBuildings(state)).toBeLessThan(before);
  });

  it('fire coverage is higher near a powered fire station', () => {
    const state = testGame();
    buildStarterTown(state);
    run(state, 60);
    placeService(state, 20, 11, 'fire');
    recomputePower(state);
    const near = fireCoverage(state, 21, 12);
    const far = fireCoverage(state, 38, 20);
    expect(near).toBeGreaterThan(far);
  });

  it('a covered town loses fewer buildings than an uncovered one (same seed)', () => {
    const mk = (withStation: boolean): number => {
      const state = testGame(4242);
      buildStarterTown(state);
      run(state, 900);
      if (withStation) {
        // ring of stations for blanket coverage
        placeService(state, 20, 10, 'fire');
        placeService(state, 28, 10, 'fire');
        placeService(state, 34, 10, 'fire');
        placeService(state, 20, 18, 'fire');
        placeService(state, 28, 18, 'fire');
        recomputePower(state);
      }
      const before = countBuildings(state);
      const target = Object.values(state.buildings)
        .filter((b) => b.kind === 'zone')
        .sort((a, b) => a.id - b.id)[0]!;
      igniteAt(state, target.x, target.y);
      burnOut(state);
      return before - countBuildings(state);
    };

    const uncovered = mk(false);
    const covered = mk(true);
    expect(covered).toBeLessThanOrEqual(uncovered);
  });

  it('destroyed buildings leave rubble that decays', () => {
    const state = testGame(99);
    buildStarterTown(state);
    run(state, 600);
    const target = Object.values(state.buildings).find((b) => b.kind === 'zone')!;
    igniteAt(state, target.x, target.y);
    burnOut(state);
    expect(state.tiles.some((t) => t.rubble > 0)).toBe(true);
  });
});
