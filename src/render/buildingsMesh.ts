import * as THREE from 'three';
import { GRID_SIZE } from '../config';
import { idx } from '../core/grid';
import { hash2 } from '../core/rng';
import { ZONE_COM, ZONE_RES, type GameState } from '../core/types';
import { buildArchetypes } from './buildingFactory';

/**
 * One InstancedMesh per archetype. On `dirty.meshes` the whole set of instance
 * matrices is rebuilt in one pass over the tiles (<1ms at 64x64) — simpler and
 * safer than incremental patching. Idle frames upload nothing.
 */
export class BuildingsMesh {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();

  constructor() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const [key, geo] of buildArchetypes()) {
      const capacity = key === 'tree' ? GRID_SIZE * GRID_SIZE : 4096;
      const mesh = new THREE.InstancedMesh(geo, mat, capacity);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes.set(key, mesh);
      this.group.add(mesh);
    }
  }

  rebuild(state: GameState): void {
    const counts = new Map<string, number>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();

    const push = (
      key: string,
      x: number,
      z: number,
      rotSteps: number,
      s: number,
      jitterPos = 0,
    ): void => {
      const mesh = this.meshes.get(key);
      if (!mesh) return;
      const i = counts.get(key) ?? 0;
      counts.set(key, i + 1);
      const jx = jitterPos ? (hash2(x * 3 + 1, z) - 0.5) * jitterPos : 0;
      const jz = jitterPos ? (hash2(x, z * 3 + 1) - 0.5) * jitterPos : 0;
      q.setFromAxisAngle(up, (rotSteps * Math.PI) / 2);
      pos.set(x + jx, 0, z + jz);
      scale.setScalar(s);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    };

    // --- buildings (drawn once at their origin tile, centered on footprint) ---
    for (const id in state.buildings) {
      const b = state.buildings[id];
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      const j = hash2(b.x, b.y);
      const rot = Math.floor(j * 4);

      if (b.kind === 'service') {
        push(`service-${b.service}`, cx, cz, rot, b.w); // 2x2 archetypes are authored at ~1.6 scale via footprint
        continue;
      }
      const burning = state.tiles[idx(b.x, b.y)].fire > 0;
      if (b.abandoned) {
        push('husk', cx, cz, rot, 1);
      } else {
        const variant = Math.floor(j * 3);
        const zoneKey = b.zone === ZONE_RES ? 'res' : b.zone === ZONE_COM ? 'com' : 'ind';
        const s = 0.92 + hash2(b.x * 7, b.y * 13) * 0.16; // subtle size jitter
        push(`${zoneKey}-${b.level}-${variant}`, cx, cz, rot, s);
      }
      if (burning) push('flame', cx, cz, 0, 1 + j * 0.4);
    }

    // --- tiles: trees, power lines, rubble, stray flames ---
    const hasWire = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < state.size && y < state.size && state.tiles[idx(x, y)].wire;
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const t = state.tiles[idx(x, y)];
        const cx = x + 0.5;
        const cz = y + 0.5;
        if (t.tree) push('tree', cx, cz, Math.floor(hash2(x, y) * 4), 0.8 + hash2(y, x) * 0.5, 0.35);
        if (t.wire) {
          // crossarm faces along the run: E/W neighbors -> keep, else rotate 90°
          const eastWest = hasWire(x - 1, y) || hasWire(x + 1, y);
          push('wire', cx, cz, eastWest ? 0 : 1, 1);
        }
        if (t.rubble > 0) push('rubble', cx, cz, Math.floor(hash2(x, y) * 4), 1);
        if (t.fire > 0 && t.buildingId === 0) push('flame', cx, cz, 0, 0.8);
      }
    }

    for (const [key, mesh] of this.meshes) {
      mesh.count = counts.get(key) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
