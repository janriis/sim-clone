import type { GameState } from './types';

/** mulberry32: tiny, fast, deterministic. State lives in GameState so saves replay identically. */
export function nextFloat(state: GameState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(state: GameState, p: number): boolean {
  return nextFloat(state) < p;
}

export function pickInt(state: GameState, n: number): number {
  return Math.floor(nextFloat(state) * n);
}

/** Stateless hash for visual jitter — derived from coordinates, never advances the sim RNG. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
