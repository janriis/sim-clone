import * as THREE from 'three';
import { idx } from '../core/grid';
import type { GameState } from '../core/types';
import { PALETTE } from './palette';

/**
 * One static merged geometry: a colored quad per tile. Grass shades by
 * elevation, a sand rim borders water, water sits slightly lower.
 * Built once — never rebuilt.
 */
export function createTerrainMesh(state: GameState): THREE.Mesh {
  const size = state.size;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const grassLow = new THREE.Color(PALETTE.grassLow);
  const grassHigh = new THREE.Color(PALETTE.grassHigh);
  const sand = new THREE.Color(PALETTE.sand);
  const water = new THREE.Color(PALETTE.water);
  const waterDeep = new THREE.Color(PALETTE.waterDeep);
  const c = new THREE.Color();

  const isWater = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= size || y >= size || state.tiles[idx(x, y)].terrain === 'water';

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = state.tiles[idx(x, y)];
      let h: number;
      if (t.terrain === 'water') {
        h = -0.22;
        const nearShore =
          !isWater(x - 1, y) || !isWater(x + 1, y) || !isWater(x, y - 1) || !isWater(x, y + 1);
        c.copy(nearShore ? water : waterDeep);
      } else {
        h = 0;
        const shore = isWater(x - 1, y) || isWater(x + 1, y) || isWater(x, y - 1) || isWater(x, y + 1);
        if (shore) c.copy(sand);
        else c.lerpColors(grassLow, grassHigh, t.elevation);
      }

      const base = positions.length / 3;
      positions.push(x, h, y, x + 1, h, y, x + 1, h, y + 1, x, h, y + 1);
      for (let k = 0; k < 4; k++) colors.push(c.r, c.g, c.b);
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.receiveShadow = true;
  return mesh;
}
