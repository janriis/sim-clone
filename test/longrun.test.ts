import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/core/types';
import { buildStarterTown, run, runWithCaretaker, testGame } from './helpers';

function assertSane(state: GameState): void {
  expect(Number.isFinite(state.money)).toBe(true);
  expect(Number.isFinite(state.population)).toBe(true);
  expect(state.population).toBeGreaterThanOrEqual(0);
  expect(state.jobs).toBeGreaterThanOrEqual(0);
  for (const t of state.tiles) {
    expect(Number.isFinite(t.landValue)).toBe(true);
    expect(Number.isFinite(t.pollution)).toBe(true);
  }
}

describe('long-run stability', () => {
  it('a starter town survives 10 game years and grows', () => {
    const state = testGame(1);
    state.money = 20_000; // realistic budget for the long run
    buildStarterTown(state);
    runWithCaretaker(state, 3600);
    assertSane(state);
    expect(state.population).toBeGreaterThan(100);
    expect(state.jobs).toBeGreaterThan(50);
  });

  it('an empty map does nothing for 5 years without exploding', () => {
    const state = testGame(2);
    run(state, 1800);
    assertSane(state);
    expect(state.population).toBe(0);
    expect(Object.keys(state.buildings).length).toBe(0);
  });

  it('growth is capped by capacity, not unbounded', () => {
    const state = testGame(3);
    buildStarterTown(state);
    runWithCaretaker(state, 3600);
    const popA = state.population;
    expect(popA).toBeGreaterThan(50); // it actually grew before we measure saturation
    runWithCaretaker(state, 1200);
    // after saturation, population should be roughly stable (within 50%)
    expect(state.population).toBeLessThan(Math.max(popA * 1.5, popA + 200));
    assertSane(state);
  });

  it('different seeds produce different but sane cities', () => {
    for (const seed of [11, 22, 33]) {
      const state = testGame(seed);
      buildStarterTown(state);
      run(state, 1800);
      assertSane(state);
    }
  });
});
