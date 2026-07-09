import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/core/serialize';
import { tick } from '../src/sim/simulation';
import { buildStarterTown, run, testGame } from './helpers';

describe('save/load', () => {
  it('roundtrips and stays deterministic afterwards', () => {
    const state = testGame(2024);
    buildStarterTown(state);
    run(state, 500);

    const json = serialize(state);
    const loaded = deserialize(json);
    expect(loaded).not.toBeNull();

    // Run both forward 100 ticks; they must agree exactly.
    for (let i = 0; i < 100; i++) {
      tick(state);
      tick(loaded!);
    }
    expect(loaded!.rngState).toBe(state.rngState);
    expect(loaded!.population).toBe(state.population);
    expect(loaded!.jobs).toBe(state.jobs);
    expect(Math.round(loaded!.money)).toBe(Math.round(state.money));
    expect(loaded!.day).toBe(state.day);
    expect(Object.keys(loaded!.buildings).length).toBe(Object.keys(state.buildings).length);
  });

  it('rejects garbage input', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"version":99}')).toBeNull();
    expect(deserialize('{}')).toBeNull();
  });

  it('save size stays comfortably under localStorage limits', () => {
    const state = testGame();
    buildStarterTown(state);
    run(state, 1000);
    const json = serialize(state);
    expect(json.length).toBeLessThan(500_000);
  });
});
