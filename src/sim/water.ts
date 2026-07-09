import { WATER_PER_PUMP, WATER_PER_PUMP_FRESH } from '../config';
import { forEachNeighbor4, idx, xy } from '../core/grid';
import { ZONE_NONE, type Building, type GameState } from '../core/types';

/**
 * Water distribution mirrors the power grid: capacity-limited multi-source BFS
 * from water pumps. Pipes are implied under roads, zones, and buildings (wires
 * do NOT carry water). Pumps only run while powered, and pumps standing next
 * to open water supply far more buildings than inland wells.
 *
 * Must run AFTER recomputePower so pump powered-state is fresh.
 */
export function pumpCapacity(state: GameState, pump: Building): number {
  let fresh = false;
  for (let dy = 0; dy < pump.h && !fresh; dy++) {
    for (let dx = 0; dx < pump.w && !fresh; dx++) {
      forEachNeighbor4(pump.x + dx, pump.y + dy, (nx, ny) => {
        if (state.tiles[idx(nx, ny)].terrain === 'water') fresh = true;
      });
    }
  }
  return fresh ? WATER_PER_PUMP_FRESH : WATER_PER_PUMP;
}

export function recomputeWater(state: GameState): void {
  const n = state.tiles.length;
  const visited = new Uint8Array(n);
  const queue: number[] = [];
  let budget = 0;

  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind !== 'service' || b.service !== 'pump') continue;
    if (!state.tiles[idx(b.x, b.y)].powered) continue; // dry pump: no electricity
    budget += pumpCapacity(state, b);
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const i = idx(b.x + dx, b.y + dy);
        if (!visited[i]) {
          visited[i] = 1;
          queue.push(i);
        }
      }
    }
  }

  for (let i = 0; i < n; i++) state.tiles[i].watered = false;

  const supplied = new Set<number>();
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const t = state.tiles[i];

    // Supplying a live building consumes budget; husks stay connected for free.
    if (t.buildingId !== 0 && !supplied.has(t.buildingId)) {
      const b = state.buildings[t.buildingId];
      if (b && !b.abandoned) {
        if (budget <= 0) continue;
        budget--;
      }
      supplied.add(t.buildingId);
    }
    t.watered = true;

    const [x, y] = xy(i);
    forEachNeighbor4(x, y, (nx, ny) => {
      const ni = idx(nx, ny);
      if (visited[ni]) return;
      const nt = state.tiles[ni];
      const conducts = nt.road || nt.buildingId !== 0 || nt.zone !== ZONE_NONE;
      if (!conducts || nt.terrain === 'water') return;
      visited[ni] = 1;
      queue.push(ni);
    });
  }
}
