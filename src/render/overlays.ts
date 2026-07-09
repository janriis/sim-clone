import * as THREE from 'three';
import { GRID_SIZE } from '../config';
import { idx } from '../core/grid';
import {
  ZONE_COM,
  ZONE_IND,
  ZONE_NONE,
  ZONE_RES,
  type GameState,
  type ZoneType,
} from '../core/types';
import { PALETTE } from './palette';

/** Zone tints, hover highlight, ghost previews, and the no-power indicator. */
export class Overlays {
  readonly group = new THREE.Group();

  private zoneMeshes = new Map<ZoneType, THREE.InstancedMesh>();
  private hover: THREE.Mesh;
  private ghost: THREE.InstancedMesh;
  private noPower: THREE.InstancedMesh;
  private noPowerPhase = 0;

  constructor() {
    // translucent quad per zone type on empty zoned tiles
    const quad = new THREE.PlaneGeometry(0.92, 0.92);
    quad.rotateX(-Math.PI / 2);
    const zoneColors: Array<[ZoneType, number]> = [
      [ZONE_RES, PALETTE.zoneRes],
      [ZONE_COM, PALETTE.zoneCom],
      [ZONE_IND, PALETTE.zoneInd],
    ];
    for (const [zone, color] of zoneColors) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(quad, mat, GRID_SIZE * GRID_SIZE);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      this.zoneMeshes.set(zone, mesh);
      this.group.add(mesh);
    }

    // hover highlight
    this.hover = new THREE.Mesh(
      quad.clone(),
      new THREE.MeshBasicMaterial({
        color: PALETTE.hover,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.hover.renderOrder = 2;
    this.hover.visible = false;
    this.group.add(this.hover);

    // ghost preview quads (green/red validity)
    this.ghost = new THREE.InstancedMesh(
      quad.clone(),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        vertexColors: false,
      }),
      4096,
    );
    this.ghost.count = 0;
    this.ghost.frustumCulled = false;
    this.ghost.renderOrder = 3;
    // per-instance colors
    this.ghost.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(4096 * 3),
      3,
    );
    this.group.add(this.ghost);

    // "no power" bolt: small floating yellow diamond over unpowered occupied buildings
    const bolt = new THREE.OctahedronGeometry(0.14);
    this.noPower = new THREE.InstancedMesh(
      bolt,
      new THREE.MeshBasicMaterial({ color: PALETTE.powerAccent }),
      2048,
    );
    this.noPower.count = 0;
    this.noPower.frustumCulled = false;
    this.group.add(this.noPower);
  }

  /** Rebuild zone tint instances (cheap; called when meshes are dirty). */
  rebuildZones(state: GameState): void {
    const counts = new Map<ZoneType, number>();
    const m = new THREE.Matrix4();
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const t = state.tiles[idx(x, y)];
        if (t.zone === ZONE_NONE || t.buildingId !== 0 || t.road) continue;
        const mesh = this.zoneMeshes.get(t.zone);
        if (!mesh) continue;
        const i = counts.get(t.zone) ?? 0;
        counts.set(t.zone, i + 1);
        m.makeTranslation(x + 0.5, 0.02, y + 0.5);
        mesh.setMatrixAt(i, m);
      }
    }
    for (const [zone, mesh] of this.zoneMeshes) {
      mesh.count = counts.get(zone) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setHover(tile: [number, number] | null): void {
    if (!tile) {
      this.hover.visible = false;
      return;
    }
    this.hover.visible = true;
    this.hover.position.set(tile[0] + 0.5, 0.03, tile[1] + 0.5);
  }

  /** Show validity-tinted quads for the pending tool footprint. */
  setGhost(tiles: Array<{ x: number; y: number; ok: boolean }>): void {
    const m = new THREE.Matrix4();
    const ok = new THREE.Color(PALETTE.ghostOk);
    const bad = new THREE.Color(PALETTE.ghostBad);
    const n = Math.min(tiles.length, 4096);
    for (let i = 0; i < n; i++) {
      const t = tiles[i];
      m.makeTranslation(t.x + 0.5, 0.04, t.y + 0.5);
      this.ghost.setMatrixAt(i, m);
      this.ghost.setColorAt(i, t.ok ? ok : bad);
    }
    this.ghost.count = n;
    this.ghost.instanceMatrix.needsUpdate = true;
    if (this.ghost.instanceColor) this.ghost.instanceColor.needsUpdate = true;
  }

  clearGhost(): void {
    this.ghost.count = 0;
  }

  /** Bob the no-power bolts; rebuild their placement when meshes change. */
  updateNoPower(state: GameState, dt: number): void {
    this.noPowerPhase += dt * 2.4;
    const bob = 0.08 * Math.sin(this.noPowerPhase);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const id in state.buildings) {
      const b = state.buildings[id];
      if (b.abandoned) continue;
      if (state.tiles[idx(b.x, b.y)].powered) continue;
      if (i >= 2048) break;
      const h = b.kind === 'service' ? 1.5 : 0.6 + b.level * 0.45;
      m.makeTranslation(b.x + b.w / 2, h + bob, b.y + b.h / 2);
      this.noPower.setMatrixAt(i++, m);
    }
    this.noPower.count = i;
    this.noPower.instanceMatrix.needsUpdate = true;
  }
}
