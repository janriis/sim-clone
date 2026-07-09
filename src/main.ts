import './ui/styles.css';
import { AUTOSAVE, DAYS_PER_MONTH, TICKS_PER_SECOND } from './config';
import { createNewGame } from './core/state';
import { loadFromStorage, saveToStorage, clearStorage } from './core/serialize';
import type { GameState, Speed } from './core/types';
import { tick } from './sim/simulation';
import { createRenderer } from './render/renderer';
import { CameraControls } from './render/cameraControls';
import { createTerrainMesh } from './render/terrainMesh';
import { RoadsMesh } from './render/roadsMesh';
import { BuildingsMesh } from './render/buildingsMesh';
import { Overlays } from './render/overlays';
import { Effects } from './render/effects';
import { Hud } from './ui/hud';
import { Toolbar } from './ui/toolbar';
import { Toasts } from './ui/toasts';
import { Inspector } from './ui/inspect';
import { BudgetPanel } from './ui/budgetPanel';
import { InputController } from './ui/input';
import { isFootprintConnected } from './sim/actions';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLElement;

let state: GameState = loadFromStorage() ?? createNewGame(Date.now() & 0x7fffffff);

// --- rendering ---
const rig = createRenderer(canvas);
const controls = new CameraControls(rig.camera, canvas);
let terrain = createTerrainMesh(state);
rig.scene.add(terrain);
const roads = new RoadsMesh();
rig.scene.add(roads.group);
const buildings = new BuildingsMesh();
rig.scene.add(buildings.group);
const overlays = new Overlays();
rig.scene.add(overlays.group);
const effects = new Effects();
rig.scene.add(effects.group);

// --- UI ---
const toasts = new Toasts(hudRoot);
const inspector = new Inspector(hudRoot);
const budgetPanel = new BudgetPanel(hudRoot, state);
const hud = new Hud(hudRoot, (s: Speed) => (state.speed = s));
const toolbar = new Toolbar(hudRoot, () => {
  inspector.hide();
  input.refresh();
});

const input = new InputController(canvas, rig.camera, state, overlays, {
  getTool: () => toolbar.active,
  onInspect: (tile) => {
    inspector.show(tile);
    inspector.update(state);
  },
  onAction: (ok, reason, tool, tile) => {
    if (!ok && reason && reason !== 'Nowhere to build' && reason !== 'Nothing to zone') {
      toasts.show({ kind: 'bad', title: 'Cannot build', detail: reason });
      return;
    }
    // warn about electrically isolated plants/pumps right away
    if (ok && tile && (tool === 'power' || tool === 'pump')) {
      if (!isFootprintConnected(state, tile[0], tile[1], tool)) {
        toasts.show({
          kind: 'bad',
          title: tool === 'power' ? 'Plant not connected' : 'Pump not connected',
          detail: 'Nothing conductive touches it — run power lines (L) or build next to a road or zone.',
        });
      } else if (tool === 'pump') {
        toasts.show({
          kind: 'info',
          title: 'Water pump online soon',
          detail: 'Pumps need electricity. Next to open water they supply twice as many buildings.',
        });
      }
    }
  },
});

// corner buttons: budget + new city
const corner = document.createElement('div');
corner.className = 'corner-buttons';
const budgetBtn = document.createElement('button');
budgetBtn.textContent = '💰 Budget';
budgetBtn.addEventListener('click', () => budgetPanel.toggle());
const newBtn = document.createElement('button');
newBtn.textContent = '🌱 New city';
newBtn.addEventListener('click', () => {
  if (!confirm('Start a new city? The current one will be lost.')) return;
  clearStorage();
  state = createNewGame(Date.now() & 0x7fffffff);
  rig.scene.remove(terrain);
  terrain.geometry.dispose();
  terrain = createTerrainMesh(state);
  rig.scene.add(terrain);
  input.setState(state);
  inspector.hide();
  budgetPanel.sync(state);
  buildings.reset();
  effects.reset();
  rebuildAll();
});
corner.append(budgetBtn, newBtn);
hudRoot.appendChild(corner);

// hint line
const hint = document.createElement('div');
hint.className = 'hint';
hint.textContent =
  'Drag: build/zone · Right-drag: pan · Wheel: zoom · Q/E: rotate · 0-3: speed · L: power line · U: pump · Esc: inspect';
hudRoot.appendChild(hint);

// speed hotkeys
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code >= 'Digit0' && e.code <= 'Digit3') state.speed = Number(e.code.slice(5)) as Speed;
  if (e.code === 'Space') state.speed = state.speed === 0 ? 1 : 0;
});

function rebuildAll(): void {
  roads.rebuild(state);
  buildings.update(state, 0, true);
  overlays.rebuildZones(state);
  state.dirty.meshes = false;
  state.dirty.roads = false;
}
rebuildAll();

// --- autosave ---
let lastSavedMonth = -1;
window.addEventListener('beforeunload', () => AUTOSAVE && saveToStorage(state));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && AUTOSAVE) saveToStorage(state);
});

// --- main loop ---
let tickAccumulator = 0;
let lastTime = performance.now();

function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // fixed-step simulation
  const tps = TICKS_PER_SECOND[state.speed];
  if (tps > 0) {
    tickAccumulator += dt * tps;
    let steps = Math.floor(tickAccumulator);
    tickAccumulator -= steps;
    if (steps > 8) steps = 8; // don't spiral after a background tab
    for (let i = 0; i < steps; i++) {
      const events = tick(state);
      toasts.showAll(events);
    }
    const month = Math.floor(state.day / DAYS_PER_MONTH);
    if (AUTOSAVE && month !== lastSavedMonth) {
      lastSavedMonth = month;
      saveToStorage(state);
    }
  }

  // renderer reads state; rebuilds only when the sim marked something dirty
  const meshesDirty = state.dirty.meshes;
  if (meshesDirty) {
    overlays.rebuildZones(state);
    state.dirty.meshes = false;
  }
  buildings.update(state, dt, meshesDirty);
  if (state.dirty.roads) {
    roads.rebuild(state);
    state.dirty.roads = false;
  }
  effects.update(state, state.speed === 0 ? 0 : dt); // world life freezes on pause
  overlays.updateNoPower(state, dt);

  controls.update(dt);
  hud.update(state);
  inspector.update(state);
  budgetPanel.update(state);
  rig.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
