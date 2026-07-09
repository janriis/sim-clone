import { LAND_VALUE, POLLUTION } from '../config';
import { forEachInRadius, idx } from '../core/grid';
import { ZONE_IND, type GameState } from '../core/types';

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Recompute pollution and land value fields by additive splatting. O(sources * r^2). */
export function recomputeFields(state: GameState): void {
  const n = state.tiles.length;
  const pollution = new Float32Array(n);
  const value = new Float32Array(n);

  const splat = (
    field: Float32Array,
    x: number,
    y: number,
    amount: number,
    radius: number,
  ): void => {
    forEachInRadius(x, y, radius, (nx, ny, d) => {
      field[idx(nx, ny)] += amount * (1 - d / (radius + 1));
    });
  };

  // --- pollution sources ---
  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind === 'zone' && b.zone === ZONE_IND && !b.abandoned) {
      splat(pollution, b.x, b.y, POLLUTION.indPerLevel * b.level, POLLUTION.indRadius);
    } else if (b.kind === 'service' && b.service === 'power') {
      splat(pollution, b.x, b.y, POLLUTION.plant, POLLUTION.plantRadius);
    }
  }
  for (let i = 0; i < n; i++) {
    if (state.tiles[i].fire > 0) {
      const x = i % state.size;
      const y = Math.floor(i / state.size);
      splat(pollution, x, y, POLLUTION.fire, POLLUTION.fireRadius);
    }
  }

  // --- land value base: elevation + water proximity ---
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      const i = idx(x, y);
      const t = state.tiles[i];
      if (t.terrain === 'water') continue;
      let v = LAND_VALUE.base + t.elevation * LAND_VALUE.elevationBonus;
      let nearWater = false;
      forEachInRadius(x, y, LAND_VALUE.waterRadius, (nx, ny) => {
        if (state.tiles[idx(nx, ny)].terrain === 'water') nearWater = true;
      });
      if (nearWater) v += LAND_VALUE.waterBonus;
      value[i] = v;
    }
  }

  // --- service boosts & ruin penalties ---
  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind !== 'service') continue;
    if (b.service === 'park') splat(value, b.x, b.y, LAND_VALUE.park, LAND_VALUE.parkRadius);
    else if (b.service === 'school') splat(value, b.x, b.y, LAND_VALUE.school, LAND_VALUE.schoolRadius);
    else if (b.service === 'police') splat(value, b.x, b.y, LAND_VALUE.police, LAND_VALUE.policeRadius);
  }
  for (let i = 0; i < n; i++) {
    const t = state.tiles[i];
    const isRuin = t.rubble > 0 || (t.buildingId !== 0 && state.buildings[t.buildingId]?.abandoned);
    if (isRuin) {
      const x = i % state.size;
      const y = Math.floor(i / state.size);
      splat(value, x, y, -LAND_VALUE.ruinPenalty, LAND_VALUE.ruinRadius);
    }
  }

  for (let i = 0; i < n; i++) {
    const t = state.tiles[i];
    t.pollution = clamp100(pollution[i]);
    t.landValue = clamp100(value[i] - t.pollution * LAND_VALUE.pollutionFactor);
  }
}
