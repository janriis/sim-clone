import * as THREE from 'three';
import { GRID_SIZE } from '../config';
import { PALETTE } from './palette';

export interface RendererRig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  sun: THREE.DirectionalLight;
  render(): void;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererRig {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);

  // Soft pastel ambience + one shadow-casting sun covering the whole board.
  const hemi = new THREE.HemisphereLight(0xfdfcf8, 0xb8c8b8, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
  sun.position.set(GRID_SIZE * 0.7, GRID_SIZE * 0.9, GRID_SIZE * 0.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const half = GRID_SIZE * 0.75;
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.near = -100;
  sun.shadow.camera.far = 250;
  sun.shadow.bias = -0.0004;
  sun.target.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);
  // Light must orbit the board center so shadows stay put when panning.
  sun.position.add(sun.target.position);
  scene.add(sun, sun.target);

  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    sun,
    render: () => renderer.render(scene, camera),
  };
}
