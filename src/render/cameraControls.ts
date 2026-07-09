import * as THREE from 'three';
import { GRID_SIZE } from '../config';

/**
 * Damped orbit-style controls for an orthographic isometric camera.
 * - drag (middle/right or left in select mode via setPanEnabled) / WASD & arrows: pan
 * - wheel: zoom  - Q/E: eased 90-degree yaw steps
 */
export class CameraControls {
  readonly target = new THREE.Vector3(GRID_SIZE / 2, 0, GRID_SIZE / 2);
  private current = this.target.clone();
  private yaw = Math.PI / 4;
  private yawTarget = this.yaw;
  private readonly pitch = Math.atan(1 / Math.SQRT2); // classic isometric ~35.26°
  private zoom = 24; // world units of half-height visible
  private zoomTarget = this.zoom;
  private keys = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private camera: THREE.OrthographicCamera,
    dom: HTMLElement,
  ) {
    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        dom.setPointerCapture(e.pointerId);
      }
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.panScreen(-dx, -dy);
    });
    const stop = (e: PointerEvent): void => {
      if (e.button === 1 || e.button === 2) this.dragging = false;
    };
    dom.addEventListener('pointerup', stop);
    dom.addEventListener('pointercancel', () => (this.dragging = false));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = Math.exp(e.deltaY * 0.0012);
        this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, 5, 46);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (e.code === 'KeyQ') this.yawTarget += Math.PI / 2;
      if (e.code === 'KeyE') this.yawTarget -= Math.PI / 2;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Convert a screen-pixel delta into a world-space pan along the view axes. */
  private panScreen(dx: number, dy: number): void {
    const worldPerPixel = (this.zoom * 2) / window.innerHeight;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target
      .addScaledVector(right, dx * worldPerPixel)
      .addScaledVector(forward, -dy * worldPerPixel);
    const margin = 6;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -margin, GRID_SIZE + margin);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -margin, GRID_SIZE + margin);
  }

  update(dt: number): void {
    // keyboard pan
    const speed = 620 * dt;
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= speed;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += speed;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= speed;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += speed;
    if (kx || ky) this.panScreen(kx, ky);

    // damping
    const t = 1 - Math.exp(-dt * 10);
    this.current.lerp(this.target, t);
    this.zoom += (this.zoomTarget - this.zoom) * t;
    this.yaw += (this.yawTarget - this.yaw) * (1 - Math.exp(-dt * 7));

    // place camera
    const dist = 120;
    const cp = this.pitch;
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(cp),
      Math.sin(cp),
      Math.cos(this.yaw) * Math.cos(cp),
    ).multiplyScalar(dist);
    this.camera.position.copy(this.current).add(offset);
    this.camera.lookAt(this.current);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.left = -this.zoom * aspect;
    this.camera.right = this.zoom * aspect;
    this.camera.updateProjectionMatrix();
  }
}
