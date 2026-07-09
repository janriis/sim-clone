import * as THREE from 'three';
import { GRID_SIZE } from '../config';
import { idx, inBounds } from '../core/grid';
import type { GameState } from '../core/types';
import { PALETTE } from './palette';

// Connection-aware roads: each road tile picks a piece + rotation from the
// bitmask of its road neighbors (N=1, E=2, S=4, W=8).

type PieceName = 'end' | 'straight' | 'corner' | 'tee' | 'cross' | 'dot';

// bitmask -> [piece, rotationSteps]
const LOOKUP: Array<[PieceName, number]> = [
  ['dot', 0], // 0
  ['end', 0], // 1 N
  ['end', 1], // 2 E
  ['corner', 0], // 3 NE
  ['end', 2], // 4 S
  ['straight', 0], // 5 NS
  ['corner', 1], // 6 ES
  ['tee', 0], // 7 NES
  ['end', 3], // 8 W
  ['corner', 3], // 9 NW
  ['straight', 1], // 10 EW
  ['tee', 3], // 11 NEW
  ['corner', 2], // 12 SW
  ['tee', 2], // 13 NSW
  ['tee', 1], // 14 ESW
  ['cross', 0], // 15
];

const ROAD_H = 0.04;
const LINE_H = 0.045;

function buildPiece(name: PieceName): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const road = new THREE.Color(PALETTE.road);
  const line = new THREE.Color(PALETTE.roadLine);

  const slab = (
    w: number,
    d: number,
    cx: number,
    cz: number,
    color: THREE.Color,
    h: number,
  ): void => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(cx, h / 2, cz);
    const count = g.attributes.position.count;
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g);
  };

  // base asphalt slab always fills the tile
  slab(1, 1, 0, 0, road, ROAD_H);

  // center-line markings per piece (thin bright strips slightly higher)
  const lw = 0.09;
  switch (name) {
    case 'straight':
      slab(lw, 0.72, 0, 0, line, LINE_H);
      break;
    case 'end':
      slab(lw, 0.4, 0, -0.16, line, LINE_H);
      break;
    case 'corner':
      slab(lw, 0.3, 0, -0.21, line, LINE_H);
      slab(0.3, lw, 0.21, 0, line, LINE_H);
      break;
    case 'tee':
      slab(lw, 0.72, 0, 0, line, LINE_H);
      slab(0.3, lw, 0.21, 0, line, LINE_H);
      break;
    case 'cross':
      slab(lw, lw, 0, 0, line, LINE_H);
      break;
    case 'dot':
      break;
  }

  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Minimal BufferGeometry merge (positions/normals/colors/index) to avoid the examples dependency. */
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const g of geos) {
    const base = positions.length / 3;
    const p = g.attributes.position;
    const nrm = g.attributes.normal;
    const col = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      if (col) colors.push(col.getX(i), col.getY(i), col.getZ(i));
      else colors.push(1, 1, 1);
    }
    const index = g.index;
    if (index) for (let i = 0; i < index.count; i++) indices.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) indices.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.setIndex(indices);
  return out;
}

export class RoadsMesh {
  readonly group = new THREE.Group();
  private meshes = new Map<PieceName, THREE.InstancedMesh>();

  constructor() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const names: PieceName[] = ['end', 'straight', 'corner', 'tee', 'cross', 'dot'];
    for (const name of names) {
      const mesh = new THREE.InstancedMesh(buildPiece(name), mat, GRID_SIZE * GRID_SIZE);
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes.set(name, mesh);
      this.group.add(mesh);
    }
  }

  rebuild(state: GameState): void {
    const counts = new Map<PieceName, number>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();

    const hasRoad = (x: number, y: number): boolean =>
      inBounds(x, y) && state.tiles[idx(x, y)].road;

    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        if (!state.tiles[idx(x, y)].road) continue;
        let mask = 0;
        if (hasRoad(x, y - 1)) mask |= 1; // N
        if (hasRoad(x + 1, y)) mask |= 2; // E
        if (hasRoad(x, y + 1)) mask |= 4; // S
        if (hasRoad(x - 1, y)) mask |= 8; // W
        const [piece, rot] = LOOKUP[mask];
        const mesh = this.meshes.get(piece)!;
        const i = counts.get(piece) ?? 0;
        counts.set(piece, i + 1);
        q.setFromAxisAngle(up, (-rot * Math.PI) / 2);
        pos.set(x + 0.5, 0, y + 0.5);
        m.compose(pos, q, one);
        mesh.setMatrixAt(i, m);
      }
    }

    for (const [name, mesh] of this.meshes) {
      mesh.count = counts.get(name) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
