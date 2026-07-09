import { ROAD_ACCESS_DIST } from '../config';
import { forEachNeighbor4, idx, xy } from '../core/grid';
import type { GameState } from '../core/types';

/** Multi-source BFS from all road tiles; tiles within ROAD_ACCESS_DIST have access. */
export function recomputeRoadAccess(state: GameState): void {
  const n = state.tiles.length;
  const dist = new Int16Array(n).fill(-1);
  const queue: number[] = [];

  for (let i = 0; i < n; i++) {
    state.tiles[i].roadAccess = false;
    if (state.tiles[i].road) {
      dist[i] = 0;
      queue.push(i);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const d = dist[i];
    state.tiles[i].roadAccess = true;
    if (d >= ROAD_ACCESS_DIST) continue;
    const [x, y] = xy(i);
    forEachNeighbor4(x, y, (nx, ny) => {
      const ni = idx(nx, ny);
      if (dist[ni] !== -1 || state.tiles[ni].terrain === 'water') return;
      dist[ni] = d + 1;
      queue.push(ni);
    });
  }
}
