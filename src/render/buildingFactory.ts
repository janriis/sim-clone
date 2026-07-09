import * as THREE from 'three';
import type { ServiceType } from '../core/types';
import { PALETTE } from './palette';
import { mergeGeometries } from './roadsMesh';

/**
 * Procedural low-poly archetypes composed from vertex-colored boxes.
 * Pre-built once at startup; rendered via one InstancedMesh per archetype.
 * All footprints are centered on origin so instances just translate to tile centers.
 */

export type ArchetypeKey =
  | `res-${1 | 2 | 3}-${0 | 1 | 2}`
  | `com-${1 | 2 | 3}-${0 | 1 | 2}`
  | `ind-${1 | 2 | 3}-${0 | 1 | 2}`
  | `service-${ServiceType}`
  | 'husk'
  | 'rubble'
  | 'tree';

class Builder {
  private geos: THREE.BufferGeometry[] = [];
  private color = new THREE.Color();

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): this {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z); // y = base height; boxes sit on their base
    this.color.set(color);
    const count = g.attributes.position.count;
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = this.color.r;
      cols[i * 3 + 1] = this.color.g;
      cols[i * 3 + 2] = this.color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.geos.push(g);
    return this;
  }

  /** Pitched roof approximated by two stacked, shrinking slabs. */
  roof(w: number, d: number, x: number, y: number, z: number, color: number): this {
    this.box(w, 0.1, d, x, y, z, color);
    this.box(w * 0.62, 0.1, d * 0.62, x, y + 0.1, z, color);
    return this;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.geos);
    this.geos.forEach((g) => g.dispose());
    return merged;
  }
}

// ---------- residential ----------
function buildRes(level: 1 | 2 | 3, variant: number): THREE.BufferGeometry {
  const b = new Builder();
  const wall = PALETTE.resWall[level - 1];
  const roof = PALETTE.resRoof[(level - 1 + variant) % 3];

  if (level === 1) {
    // cottage: small box + pitched roof, variant shifts footprint
    const w = 0.52 + variant * 0.05;
    const d = 0.6 - variant * 0.04;
    const h = 0.34 + variant * 0.04;
    b.box(w, h, d, 0, 0, 0, wall);
    b.roof(w + 0.1, d + 0.1, 0, h, 0, roof);
    if (variant !== 1) b.box(0.1, h + 0.28, 0.1, w / 2 - 0.08, 0, -d / 2 + 0.1, roof); // chimney
  } else if (level === 2) {
    // townhouse: two offset boxes
    b.box(0.42, 0.7, 0.62, -0.16, 0, 0, wall);
    b.box(0.38, 0.52 + variant * 0.08, 0.56, 0.2, 0, 0.02, PALETTE.resWall[variant % 3]);
    b.roof(0.5, 0.68, -0.16, 0.7, 0, roof);
    b.roof(0.44, 0.6, 0.2, 0.52 + variant * 0.08, 0.02, PALETTE.resRoof[variant % 3]);
  } else {
    // apartment block: tall slab + roof deck + balconies strip
    const h = 1.15 + variant * 0.15;
    b.box(0.68, h, 0.68, 0, 0, 0, wall);
    b.box(0.72, 0.06, 0.72, 0, h, 0, roof);
    b.box(0.2, 0.14, 0.2, 0.14 - variant * 0.14, h + 0.06, 0, PALETTE.resRoof[variant % 3]); // stair head
    b.box(0.72, 0.05, 0.1, 0, h * 0.45, 0.31, roof); // balcony band
  }
  return b.build();
}

// ---------- commercial ----------
function buildCom(level: 1 | 2 | 3, variant: number): THREE.BufferGeometry {
  const b = new Builder();
  const wall = PALETTE.comWall[level - 1];
  const roofC = PALETTE.comRoof[(level - 1 + variant) % 3];

  if (level === 1) {
    // corner shop with awning sign
    b.box(0.66, 0.4, 0.6, 0, 0, 0, wall);
    b.box(0.7, 0.05, 0.64, 0, 0.4, 0, roofC);
    b.box(0.7, 0.08, 0.14, 0, 0.28, 0.3, PALETTE.comSign); // awning
  } else if (level === 2) {
    // mid-rise with glass band
    const h = 0.85 + variant * 0.1;
    b.box(0.66, h, 0.62, 0, 0, 0, wall);
    b.box(0.68, 0.12, 0.64, 0, h * 0.5, 0, roofC); // band
    b.box(0.66, 0.05, 0.62, 0, h, 0, roofC);
    b.box(0.3, 0.1, 0.08, 0.1, h + 0.05, 0.1, PALETTE.comSign); // roof sign
  } else {
    // office tower, stepped
    const h = 1.5 + variant * 0.2;
    b.box(0.62, h, 0.58, 0, 0, 0, wall);
    b.box(0.44, 0.32, 0.4, 0, h, 0, PALETTE.comWall[variant % 3]);
    b.box(0.48, 0.05, 0.44, 0, h + 0.32, 0, roofC);
    b.box(0.05, 0.28, 0.05, 0, h + 0.37, 0, PALETTE.comSign); // antenna
  }
  return b.build();
}

// ---------- industrial ----------
function buildInd(level: 1 | 2 | 3, variant: number): THREE.BufferGeometry {
  const b = new Builder();
  const wall = PALETTE.indWall[level - 1];
  const roofC = PALETTE.indRoof[(level - 1 + variant) % 3];

  if (level === 1) {
    // workshop with skillion roof + small chimney
    b.box(0.7, 0.36, 0.62, 0, 0, 0, wall);
    b.box(0.74, 0.07, 0.66, 0, 0.36, 0, roofC);
    b.box(0.09, 0.5, 0.09, 0.24, 0, -0.2, PALETTE.indChimney);
  } else if (level === 2) {
    // factory hall with sawtooth-ish roof blocks
    b.box(0.74, 0.5, 0.68, 0, 0, 0, wall);
    for (let i = 0; i < 3; i++) {
      b.box(0.2, 0.14, 0.66, -0.24 + i * 0.24, 0.5, 0, roofC);
    }
    b.box(0.1, 0.72, 0.1, 0.28, 0, 0.22, PALETTE.indChimney);
  } else {
    // heavy plant: big hall + tanks + twin stacks
    b.box(0.76, 0.62, 0.56, 0, 0, -0.08, wall);
    b.box(0.78, 0.07, 0.58, 0, 0.62, -0.08, roofC);
    b.box(0.2, 0.34, 0.2, -0.22, 0, 0.3, PALETTE.indChimney); // tank
    b.box(0.2, 0.26, 0.2, 0.1, 0, 0.3, PALETTE.indChimney); // tank
    b.box(0.1, 0.95 + variant * 0.1, 0.1, 0.3, 0, 0.28, PALETTE.indChimney); // stack
    b.box(0.1, 0.8, 0.1, 0.3, 0, 0.1, PALETTE.indChimney); // stack
  }
  return b.build();
}

// ---------- services (footprint 1x1 or 2x2, centered) ----------
function buildService(service: ServiceType): THREE.BufferGeometry {
  const b = new Builder();
  switch (service) {
    case 'power':
      // 2x2 plant: hall, cooling tower, stacks
      b.box(1.3, 0.6, 1.0, -0.15, 0, 0.3, PALETTE.power);
      b.box(1.34, 0.08, 1.04, -0.15, 0.6, 0.3, PALETTE.powerAccent);
      b.box(0.55, 0.9, 0.55, 0.55, 0, -0.5, PALETTE.power); // tower base
      b.box(0.42, 0.18, 0.42, 0.55, 0.9, -0.5, PALETTE.powerAccent);
      b.box(0.16, 1.25, 0.16, -0.55, 0, -0.5, PALETTE.indChimney);
      b.box(0.16, 1.05, 0.16, -0.2, 0, -0.55, PALETTE.indChimney);
      break;
    case 'police':
      b.box(0.7, 0.5, 0.62, 0, 0, 0, PALETTE.police);
      b.box(0.74, 0.06, 0.66, 0, 0.5, 0, PALETTE.policeAccent);
      b.box(0.08, 0.32, 0.08, 0.24, 0.56, 0.2, PALETTE.policeAccent); // mast
      break;
    case 'fire':
      b.box(0.7, 0.48, 0.62, 0, 0, 0, PALETTE.fireStation);
      b.box(0.74, 0.06, 0.66, 0, 0.48, 0, PALETTE.fireAccent);
      b.box(0.24, 0.72, 0.24, -0.2, 0, -0.16, PALETTE.fireStation); // hose tower
      b.box(0.28, 0.06, 0.28, -0.2, 0.72, -0.16, PALETTE.fireAccent);
      break;
    case 'park':
      b.box(0.9, 0.04, 0.9, 0, 0, 0, PALETTE.park); // lawn
      b.box(0.16, 0.3, 0.16, -0.2, 0.04, -0.2, PALETTE.treeTrunk);
      b.box(0.34, 0.34, 0.34, -0.2, 0.3, -0.2, PALETTE.parkAccent);
      b.box(0.12, 0.22, 0.12, 0.24, 0.04, 0.18, PALETTE.treeTrunk);
      b.box(0.26, 0.26, 0.26, 0.24, 0.24, 0.18, PALETTE.parkAccent);
      b.box(0.3, 0.03, 0.2, 0.05, 0.04, -0.28, PALETTE.sand); // path/bench
      break;
    case 'school':
      // 2x2 campus: main hall + gym + yard
      b.box(1.2, 0.55, 0.7, 0, 0, -0.35, PALETTE.school);
      b.box(1.24, 0.07, 0.74, 0, 0.55, -0.35, PALETTE.schoolAccent);
      b.box(0.6, 0.4, 0.6, -0.45, 0, 0.4, PALETTE.school);
      b.box(0.64, 0.06, 0.64, -0.45, 0.4, 0.4, PALETTE.schoolAccent);
      b.box(0.7, 0.03, 0.7, 0.4, 0, 0.4, PALETTE.park); // yard
      b.box(0.06, 0.5, 0.06, 0.58, 0.03, 0.2, PALETTE.schoolAccent); // flagpole
      break;
  }
  return b.build();
}

function buildHusk(): THREE.BufferGeometry {
  const b = new Builder();
  b.box(0.6, 0.42, 0.56, 0, 0, 0, PALETTE.abandoned);
  b.box(0.64, 0.05, 0.6, 0, 0.42, 0, PALETTE.rubble);
  b.box(0.2, 0.16, 0.2, 0.18, 0.47, -0.1, PALETTE.rubble); // collapsed bit
  return b.build();
}

function buildRubble(): THREE.BufferGeometry {
  const b = new Builder();
  b.box(0.5, 0.1, 0.44, -0.08, 0, 0.05, PALETTE.rubble);
  b.box(0.3, 0.16, 0.26, 0.14, 0, -0.14, PALETTE.abandoned);
  b.box(0.2, 0.08, 0.2, -0.2, 0.1, -0.12, PALETTE.rubble);
  return b.build();
}

function buildTree(): THREE.BufferGeometry {
  const b = new Builder();
  b.box(0.1, 0.22, 0.1, 0, 0, 0, PALETTE.treeTrunk);
  b.box(0.34, 0.4, 0.34, 0, 0.22, 0, PALETTE.tree);
  b.box(0.22, 0.2, 0.22, 0, 0.62, 0, PALETTE.tree);
  return b.build();
}

function buildFlame(): THREE.BufferGeometry {
  const b = new Builder();
  b.box(0.34, 0.5, 0.34, 0, 0, 0, PALETTE.fire);
  b.box(0.18, 0.34, 0.18, 0.06, 0.5, 0.04, PALETTE.fireCore);
  return b.build();
}

export function buildArchetypes(): Map<string, THREE.BufferGeometry> {
  const map = new Map<string, THREE.BufferGeometry>();
  const levels = [1, 2, 3] as const;
  for (const level of levels) {
    for (let v = 0; v < 3; v++) {
      map.set(`res-${level}-${v}`, buildRes(level, v));
      map.set(`com-${level}-${v}`, buildCom(level, v));
      map.set(`ind-${level}-${v}`, buildInd(level, v));
    }
  }
  const services: ServiceType[] = ['power', 'police', 'fire', 'park', 'school'];
  for (const s of services) map.set(`service-${s}`, buildService(s));
  map.set('husk', buildHusk());
  map.set('rubble', buildRubble());
  map.set('tree', buildTree());
  map.set('flame', buildFlame());
  return map;
}
