import * as THREE from 'three';
import type { GameState, ServiceType, Tool, ZoneType } from '../core/types';
import { ZONE_COM, ZONE_IND, ZONE_RES } from '../core/types';
import { inBounds } from '../core/grid';
import {
  buildRoad,
  bulldoze,
  canBuildRoadAt,
  canPlaceServiceAt,
  canZoneAt,
  paintZone,
  placeService,
  serviceFootprint,
} from '../sim/actions';
import type { Overlays } from '../render/overlays';

export interface InputCallbacks {
  getTool(): Tool;
  onInspect(tile: [number, number]): void;
  onAction(ok: boolean, reason?: string): void;
}

const ZONE_OF_TOOL: Partial<Record<Tool, ZoneType>> = {
  'zone-res': ZONE_RES,
  'zone-com': ZONE_COM,
  'zone-ind': ZONE_IND,
};

const SERVICE_TOOLS: Tool[] = ['power', 'police', 'fire', 'park', 'school'];

/**
 * Pointer -> tile picking via ray ∩ y=0 plane (O(1), no mesh raycasting).
 * Drag semantics: road = L-shaped line, zones/bulldoze = rectangle,
 * services = click with footprint ghost. Left button only; camera owns the rest.
 */
export class InputController {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hitPoint = new THREE.Vector3();

  private hoverTile: [number, number] | null = null;
  private dragStart: [number, number] | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.OrthographicCamera,
    private state: GameState,
    private overlays: Overlays,
    private cb: InputCallbacks,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.cancelDrag();
    });
  }

  /** Swap in a new state after load/new-game. */
  setState(state: GameState): void {
    this.state = state;
    this.cancelDrag();
  }

  /** Re-evaluate the ghost (e.g. after a tool change). */
  refresh(): void {
    this.refreshGhost();
  }

  private pick(e: PointerEvent): [number, number] | null {
    this.ndc.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hitPoint)) return null;
    const x = Math.floor(this.hitPoint.x);
    const y = Math.floor(this.hitPoint.z);
    return inBounds(x, y) ? [x, y] : null;
  }

  /** L-shaped road path: horizontal leg then vertical leg. */
  private roadPath(a: [number, number], b: [number, number]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    const stepX = Math.sign(b[0] - a[0]);
    const stepY = Math.sign(b[1] - a[1]);
    let [x, y] = a;
    out.push([x, y]);
    while (x !== b[0]) {
      x += stepX;
      out.push([x, y]);
    }
    while (y !== b[1]) {
      y += stepY;
      out.push([x, y]);
    }
    return out;
  }

  private rect(a: [number, number], b: [number, number]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    const x0 = Math.min(a[0], b[0]);
    const x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const y1 = Math.max(a[1], b[1]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
    return out;
  }

  private footprintTiles(service: ServiceType, tile: [number, number]): Array<[number, number]> {
    const s = serviceFootprint(service);
    const out: Array<[number, number]> = [];
    for (let dy = 0; dy < s; dy++)
      for (let dx = 0; dx < s; dx++) out.push([tile[0] + dx, tile[1] + dy]);
    return out;
  }

  private pendingTiles(tile: [number, number]): Array<[number, number]> {
    const tool = this.cb.getTool();
    if (SERVICE_TOOLS.includes(tool)) return this.footprintTiles(tool as ServiceType, tile);
    if (this.dragStart) {
      if (tool === 'road') return this.roadPath(this.dragStart, tile);
      if (tool in ZONE_OF_TOOL || tool === 'bulldoze') return this.rect(this.dragStart, tile);
    }
    if (tool === 'road' || tool in ZONE_OF_TOOL || tool === 'bulldoze') return [tile];
    return [];
  }

  private validityOf(
    tool: Tool,
    tiles: Array<[number, number]>,
  ): Array<{ x: number; y: number; ok: boolean }> {
    if (SERVICE_TOOLS.includes(tool) && tiles.length > 0) {
      const [ox, oy] = tiles[0];
      const ok = canPlaceServiceAt(this.state, ox, oy, tool as ServiceType);
      return tiles.map(([x, y]) => ({ x, y, ok }));
    }
    return tiles.map(([x, y]) => {
      let ok = true;
      if (tool === 'road') ok = canBuildRoadAt(this.state, x, y);
      else if (tool in ZONE_OF_TOOL) ok = canZoneAt(this.state, x, y);
      else if (tool === 'bulldoze') ok = inBounds(x, y);
      return { x, y, ok };
    });
  }

  private refreshGhost(): void {
    const tool = this.cb.getTool();
    if (!this.hoverTile || tool === 'select') {
      this.overlays.clearGhost();
      this.overlays.setHover(this.hoverTile);
      return;
    }
    this.overlays.setGhost(this.validityOf(tool, this.pendingTiles(this.hoverTile)));
    this.overlays.setHover(null);
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const tile = this.pick(e);
    if (!tile) return;
    const tool = this.cb.getTool();
    if (tool === 'select') {
      this.cb.onInspect(tile);
      return;
    }
    if (SERVICE_TOOLS.includes(tool)) return; // services place on pointerup
    this.dragStart = tile;
    this.canvas.setPointerCapture(e.pointerId);
  }

  private onMove(e: PointerEvent): void {
    this.hoverTile = this.pick(e);
    this.refreshGhost();
  }

  private onUp(e: PointerEvent): void {
    if (e.button !== 0) return;
    const tile = this.pick(e);
    const tool = this.cb.getTool();

    if (SERVICE_TOOLS.includes(tool)) {
      if (tile) {
        const r = placeService(this.state, tile[0], tile[1], tool as ServiceType);
        this.cb.onAction(r.ok, r.reason);
      }
      this.refreshGhost();
      return;
    }

    if (!this.dragStart) return;
    const end = tile ?? this.hoverTile ?? this.dragStart;
    const tiles = this.pendingTiles(end);
    this.dragStart = null;

    let ok = false;
    let reason: string | undefined;
    if (tool === 'road') {
      ({ ok, reason } = buildRoad(this.state, tiles));
    } else if (tool in ZONE_OF_TOOL) {
      ({ ok, reason } = paintZone(this.state, tiles, ZONE_OF_TOOL[tool]!));
    } else if (tool === 'bulldoze') {
      ({ ok, reason } = bulldoze(this.state, tiles));
    }
    this.cb.onAction(ok, reason);
    this.refreshGhost();
  }

  private cancelDrag(): void {
    this.dragStart = null;
    this.overlays.clearGhost();
  }
}
