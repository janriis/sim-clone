import * as THREE from 'three';
import { idx, inBounds } from '../core/grid';
import { hash2 } from '../core/rng';
import { ZONE_IND, type GameState } from '../core/types';
import { buildFlame } from './buildingFactory';
import { mergeGeometries } from './roadsMesh';

/**
 * Purely visual, per-frame animation layer — never touches sim state.
 * Traffic on the road network, smoke from industry/plants/fires, and
 * flickering flames. Frozen while the game is paused (caller passes dt=0).
 */

const CAR_CAP = 128;
const PUFF_CAP = 512;
const FLAME_CAP = 256;
const POP_PER_CAR = 12; // one car per this many residents

const CAR_COLORS = [0xe63946, 0xf4a261, 0x2a9d8f, 0x457b9d, 0xe8e6df, 0x8b7fb8, 0x3a4763];
// dir: 0=N(-z) 1=E(+x) 2=S(+z) 3=W(-x)
const DX = [0, 1, 0, -1];
const DZ = [-1, 0, 1, 0];
const ROT_Y = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];

interface Car {
  x: number;
  y: number;
  dir: number;
  p: number; // progress through the tile, 0..1
  speed: number;
  color: THREE.Color;
}

interface Puff {
  x: number;
  h: number;
  z: number;
  vy: number;
  vx: number;
  vz: number;
  age: number;
  life: number;
  base: number; // max scale
  shade: THREE.Color;
}

function carGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(0.34, 0.1, 0.17);
  body.translate(0, 0.09, 0);
  const cabin = new THREE.BoxGeometry(0.17, 0.08, 0.14);
  cabin.translate(-0.02, 0.18, 0);
  const merged = mergeGeometries([body, cabin]);
  body.dispose();
  cabin.dispose();
  return merged;
}

export class Effects {
  readonly group = new THREE.Group();
  private cars: Car[] = [];
  private puffs: Puff[] = [];
  private carMesh: THREE.InstancedMesh;
  private puffMesh: THREE.InstancedMesh;
  private flameMesh: THREE.InstancedMesh;
  private time = 0;

  constructor() {
    this.carMesh = new THREE.InstancedMesh(
      carGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      CAR_CAP,
    );
    this.carMesh.castShadow = true;

    this.puffMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
      PUFF_CAP,
    );

    this.flameMesh = new THREE.InstancedMesh(
      buildFlame(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      FLAME_CAP,
    );

    for (const mesh of [this.carMesh, this.puffMesh, this.flameMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  reset(): void {
    this.cars.length = 0;
    this.puffs.length = 0;
  }

  update(state: GameState, dt: number): void {
    this.time += dt;
    if (dt > 0) {
      this.updateTraffic(state, dt);
      this.updateSmoke(state, dt);
    }
    this.renderCars();
    this.renderPuffs();
    this.renderFlames(state); // flicker uses this.time, harmless while paused
  }

  // ---------- traffic ----------

  private isRoad(state: GameState, x: number, y: number): boolean {
    return inBounds(x, y) && state.tiles[idx(x, y)].road;
  }

  private trySpawnCar(state: GameState): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = Math.floor(Math.random() * state.size);
      const y = Math.floor(Math.random() * state.size);
      if (!this.isRoad(state, x, y)) continue;
      const dirs = [0, 1, 2, 3].filter((d) => this.isRoad(state, x + DX[d], y + DZ[d]));
      if (dirs.length === 0) continue;
      this.cars.push({
        x,
        y,
        dir: dirs[Math.floor(Math.random() * dirs.length)],
        p: Math.random(),
        speed: 1.3 + Math.random() * 0.7,
        color: new THREE.Color(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]),
      });
      return;
    }
  }

  private updateTraffic(state: GameState, dt: number): void {
    const target = Math.min(CAR_CAP, Math.floor(state.population / POP_PER_CAR));
    if (this.cars.length < target) this.trySpawnCar(state);
    else if (this.cars.length > target) this.cars.pop();

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      car.p += car.speed * dt;
      while (car.p >= 1) {
        car.p -= 1;
        car.x += DX[car.dir];
        car.y += DZ[car.dir];
        if (!this.isRoad(state, car.x, car.y)) {
          this.cars.splice(i, 1); // road got bulldozed under us
          break;
        }
        // pick the next direction: never reverse unless dead-end, prefer straight
        const back = (car.dir + 2) % 4;
        const options = [0, 1, 2, 3].filter(
          (d) => d !== back && this.isRoad(state, car.x + DX[d], car.y + DZ[d]),
        );
        if (options.length === 0) {
          if (this.isRoad(state, car.x + DX[back], car.y + DZ[back])) car.dir = back;
          else {
            this.cars.splice(i, 1);
            break;
          }
        } else if (options.includes(car.dir) && Math.random() < 0.65) {
          // keep going straight
        } else {
          car.dir = options[Math.floor(Math.random() * options.length)];
        }
      }
    }
  }

  private renderCars(): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      const dx = DX[c.dir];
      const dz = DZ[c.dir];
      // right-hand lane: offset perpendicular to travel
      const ox = -dz * 0.18;
      const oz = dx * 0.18;
      pos.set(c.x + 0.5 + dx * (c.p - 0.5) + ox, 0.04, c.y + 0.5 + dz * (c.p - 0.5) + oz);
      q.setFromAxisAngle(up, ROT_Y[c.dir]);
      m.compose(pos, q, one);
      this.carMesh.setMatrixAt(i, m);
      this.carMesh.setColorAt(i, c.color);
    }
    this.carMesh.count = this.cars.length;
    this.carMesh.instanceMatrix.needsUpdate = true;
    if (this.carMesh.instanceColor) this.carMesh.instanceColor.needsUpdate = true;
  }

  // ---------- smoke ----------

  private emit(x: number, h: number, z: number, dark: boolean, big: boolean): void {
    if (this.puffs.length >= PUFF_CAP) return;
    const grey = dark ? 0.22 + Math.random() * 0.1 : 0.72 + Math.random() * 0.18;
    this.puffs.push({
      x: x + (Math.random() - 0.5) * 0.15,
      h,
      z: z + (Math.random() - 0.5) * 0.15,
      vy: 0.35 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.12,
      vz: (Math.random() - 0.5) * 0.12,
      age: 0,
      life: 1.8 + Math.random() * 1.2,
      base: (big ? 0.34 : 0.22) + Math.random() * 0.08,
      shade: new THREE.Color(grey, grey, grey),
    });
  }

  private updateSmoke(state: GameState, dt: number): void {
    // emitters: industry, power plants, burning tiles
    for (const id in state.buildings) {
      const b = state.buildings[id];
      if (b.kind === 'zone' && b.zone === ZONE_IND && !b.abandoned) {
        if (Math.random() < dt * (0.35 + 0.3 * b.level)) {
          this.emit(b.x + 0.78, 0.45 + b.level * 0.18, b.y + 0.6, false, false);
        }
      } else if (b.kind === 'service' && b.service === 'power') {
        if (Math.random() < dt * 1.4) {
          this.emit(b.x + 0.45, 1.3, b.y + 0.5, false, true);
        }
      }
    }
    if (this.puffs.length < PUFF_CAP) {
      for (let i = 0; i < state.tiles.length; i++) {
        const t = state.tiles[i];
        if (t.fire > 0 && Math.random() < dt * 2.5) {
          this.emit((i % state.size) + 0.5, 0.6, Math.floor(i / state.size) + 0.5, true, true);
        }
      }
    }

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.puffs.splice(i, 1);
        continue;
      }
      p.h += p.vy * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
    }
  }

  private renderPuffs(): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const t = p.age / p.life;
      // grow fast, fade out by shrinking at the end
      const s = p.base * Math.min(1, t * 4) * (1 - Math.max(0, (t - 0.65) / 0.35) ** 2);
      pos.set(p.x, p.h, p.z);
      q.setFromAxisAngle(up, p.age * 0.8);
      scl.setScalar(Math.max(s, 0.001));
      m.compose(pos, q, scl);
      this.puffMesh.setMatrixAt(i, m);
      this.puffMesh.setColorAt(i, p.shade);
    }
    this.puffMesh.count = this.puffs.length;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;
  }

  // ---------- flames ----------

  private renderFlames(state: GameState): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < state.tiles.length && n < FLAME_CAP; i++) {
      if (state.tiles[i].fire <= 0) continue;
      const x = i % state.size;
      const y = Math.floor(i / state.size);
      const j = hash2(x, y);
      const flicker = 0.85 + 0.3 * Math.sin(this.time * 12 + j * 20) + 0.1 * Math.sin(this.time * 31 + j * 7);
      pos.set(x + 0.5, 0.05, y + 0.5);
      q.setFromAxisAngle(up, j * Math.PI * 2 + Math.sin(this.time * 5 + j * 9) * 0.2);
      scl.set(0.9 * flicker, 1.1 * flicker, 0.9 * flicker);
      m.compose(pos, q, scl);
      this.flameMesh.setMatrixAt(n++, m);
    }
    this.flameMesh.count = n;
    this.flameMesh.instanceMatrix.needsUpdate = true;
  }
}
