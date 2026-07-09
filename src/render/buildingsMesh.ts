import * as THREE from 'three';
import { GRID_SIZE } from '../config';
import { idx } from '../core/grid';
import { hash2 } from '../core/rng';
import { ZONE_COM, ZONE_RES, type GameState } from '../core/types';
import { buildArchetypes } from './buildingFactory';

const POP_DURATION = 0.45; // seconds of spawn/level-up bounce

/** easeOutBack mapped 0->1 with a playful overshoot around q≈0.7 */
function popScale(q: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = q - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

/**
 * One InstancedMesh per archetype. On `dirty.meshes` the whole set of instance
 * matrices is rebuilt in one pass over the tiles (<1ms at 64x64) — simpler and
 * safer than incremental patching. Idle frames upload nothing, except while a
 * spawn/level-up "pop" animation briefly forces per-frame rebuilds.
 */
export class BuildingsMesh {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();
  private knownLevels = new Map<number, number>(); // building id -> last seen level
  private anims = new Map<number, number>(); // building id -> seconds since pop began

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

  reset(): void {
    this.knownLevels.clear();
    this.anims.clear();
  }

  /**
   * Call every frame. Rebuilds instance buffers when the sim marked meshes
   * dirty, and keeps rebuilding while any pop animation is in flight.
   */
  update(state: GameState, dt: number, dirty: boolean): void {
    for (const [id, t] of this.anims) {
      const nt = t + dt;
      if (nt >= POP_DURATION) this.anims.delete(id);
      else this.anims.set(id, nt);
    }
    if (dirty) {
      for (const idStr in state.buildings) {
        const b = state.buildings[idStr];
        const prev = this.knownLevels.get(b.id);
        if ((prev === undefined || prev < b.level) && !b.abandoned) this.anims.set(b.id, 0);
      }
      this.knownLevels.clear();
      for (const idStr in state.buildings) {
        const b = state.buildings[idStr];
        this.knownLevels.set(b.id, b.level);
      }
    }
    if (dirty || this.anims.size > 0) this.rebuild(state);
  }

  private popOf(id: number): number {
    const t = this.anims.get(id);
    return t === undefined ? 1 : popScale(Math.min(1, t / POP_DURATION));
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

      const pop = this.popOf(b.id); // spawn/level-up bounce multiplier
      if (b.kind === 'service') {
        push(`service-${b.service}`, cx, cz, rot, b.w * pop); // 2x2 archetypes scale via footprint
        continue;
      }
      if (b.abandoned) {
        push('husk', cx, cz, rot, 1);
      } else {
        const variant = Math.floor(j * 3);
        const zoneKey = b.zone === ZONE_RES ? 'res' : b.zone === ZONE_COM ? 'com' : 'ind';
        const s = 0.92 + hash2(b.x * 7, b.y * 13) * 0.16; // subtle size jitter
        push(`${zoneKey}-${b.level}-${variant}`, cx, cz, rot, s * pop);
      }
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
        // flames live in the Effects layer now — they flicker per frame
      }
    }

    for (const [key, mesh] of this.meshes) {
      mesh.count = counts.get(key) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
