import { GRID_SIZE } from '../config';

export const SIZE = GRID_SIZE;

export function idx(x: number, y: number): number {
  return y * SIZE + x;
}

export function xy(i: number): [number, number] {
  return [i % SIZE, Math.floor(i / SIZE)];
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function forEachNeighbor4(x: number, y: number, cb: (nx: number, ny: number) => void): void {
  for (const [dx, dy] of N4) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny)) cb(nx, ny);
  }
}

/** Visit every in-bounds tile within Chebyshev-ish diamond radius r (Manhattan), with distance. */
export function forEachInRadius(
  x: number,
  y: number,
  r: number,
  cb: (nx: number, ny: number, dist: number) => void,
): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > r) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny)) cb(nx, ny, dist);
    }
  }
}
