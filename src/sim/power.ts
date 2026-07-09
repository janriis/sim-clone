import { POWER_PER_PLANT } from '../config';
import { forEachNeighbor4, idx, xy } from '../core/grid';
import { ZONE_NONE, type GameState } from '../core/types';

/**
 * Capacity-limited multi-source BFS from power plants. A tile conducts if it
 * has a road, a building, or is zoned. Each powered *building* consumes one
 * unit of the shared plant budget; when the budget runs out the frontier goes
 * dark — natural brownouts as the city outgrows its plants.
 */
export function recomputePower(state: GameState): void {
  const n = state.tiles.length;
  const visited = new Uint8Array(n);
  const queue: number[] = [];
  let budget = 0;

  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind === 'service' && b.service === 'power') {
      budget += POWER_PER_PLANT;
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
  }

  for (let i = 0; i < n; i++) state.tiles[i].powered = false;

  const chargedBuildings = new Set<number>();
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const t = state.tiles[i];

    // Powering a live building (once, whatever its footprint) consumes budget.
    // Abandoned husks conduct but draw nothing — otherwise a dying district
    // hogs the budget and the whole grid death-spirals.
    if (t.buildingId !== 0 && !chargedBuildings.has(t.buildingId)) {
      const b = state.buildings[t.buildingId];
      if (b && !b.abandoned) {
        if (budget <= 0) continue; // out of capacity: don't power, don't conduct further
        budget--;
      }
      chargedBuildings.add(t.buildingId);
    }
    t.powered = true;

    const [x, y] = xy(i);
    forEachNeighbor4(x, y, (nx, ny) => {
      const ni = idx(nx, ny);
      if (visited[ni]) return;
      const nt = state.tiles[ni];
      const conducts = nt.road || nt.wire || nt.buildingId !== 0 || nt.zone !== ZONE_NONE;
      // wires may cross water (pylons); everything else needs land
      if (!conducts || (nt.terrain === 'water' && !nt.wire)) return;
      visited[ni] = 1;
      queue.push(ni);
    });
  }
}
