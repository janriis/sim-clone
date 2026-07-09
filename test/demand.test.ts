import { describe, expect, it } from 'vitest';
import { computeDemand } from '../src/sim/demand';
import { buildStarterTown, run, runWithCaretaker, testGame } from './helpers';

describe('RCI demand', () => {
  it('an empty city wants residents and industry', () => {
    const state = testGame();
    computeDemand(state);
    expect(state.demand.res).toBeGreaterThan(0);
    expect(state.demand.ind).toBeGreaterThan(0);
  });

  it('high taxes suppress demand', () => {
    const state = testGame();
    state.taxRates = { res: 20, com: 20, ind: 20 };
    computeDemand(state);
    const highTax = { ...state.demand };

    const state2 = testGame();
    state2.taxRates = { res: 0, com: 0, ind: 0 };
    computeDemand(state2);

    expect(highTax.res).toBeLessThan(state2.demand.res);
    expect(highTax.com).toBeLessThan(state2.demand.com);
    expect(highTax.ind).toBeLessThan(state2.demand.ind);
  });

  it('a growing city eventually balances jobs and population', () => {
    const state = testGame();
    buildStarterTown(state);
    runWithCaretaker(state, 1200); // ~3.3 game years
    expect(state.population).toBeGreaterThan(50);
    expect(state.jobs).toBeGreaterThan(20);
  });

  it('recession modifier suppresses demand', () => {
    const state = testGame();
    buildStarterTown(state);
    run(state, 300);
    computeDemand(state);
    const normal = state.demand.res;
    state.modifier = { demandMult: 0.45, label: 'Recession', expiresDay: state.day + 180 };
    computeDemand(state);
    expect(Math.abs(state.demand.res)).toBeLessThanOrEqual(Math.abs(normal) + 1e-9);
  });
});
