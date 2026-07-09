import { COST } from '../config';
import type { Tool } from '../core/types';

interface ToolDef {
  tool: Tool;
  icon: string;
  label: string;
  price?: number;
  key?: string;
}

const TOOLS: Array<ToolDef | 'divider'> = [
  { tool: 'select', icon: '🔍', label: 'Inspect', key: 'X' },
  { tool: 'road', icon: '🛣️', label: 'Road', price: COST.road, key: 'T' },
  'divider',
  { tool: 'zone-res', icon: '🏠', label: 'Residential', price: COST.zone, key: 'R' },
  { tool: 'zone-com', icon: '🏬', label: 'Commercial', price: COST.zone, key: 'C' },
  { tool: 'zone-ind', icon: '🏭', label: 'Industrial', price: COST.zone, key: 'I' },
  'divider',
  { tool: 'power', icon: '⚡', label: 'Power plant', price: COST.power, key: 'P' },
  { tool: 'police', icon: '🚓', label: 'Police', price: COST.police },
  { tool: 'fire', icon: '🚒', label: 'Fire station', price: COST.fire, key: 'F' },
  { tool: 'park', icon: '🌳', label: 'Park', price: COST.park },
  { tool: 'school', icon: '🎓', label: 'School', price: COST.school },
  'divider',
  { tool: 'bulldoze', icon: '🚜', label: 'Bulldoze', price: COST.bulldoze, key: 'B' },
];

/** Left-side tool palette. */
export class Toolbar {
  active: Tool = 'select';
  private buttons = new Map<Tool, HTMLButtonElement>();
  private onChange: (tool: Tool) => void;

  constructor(hud: HTMLElement, onChange: (tool: Tool) => void) {
    this.onChange = onChange;
    const bar = document.createElement('div');
    bar.className = 'toolbar';

    for (const def of TOOLS) {
      if (def === 'divider') {
        const d = document.createElement('div');
        d.className = 'divider';
        bar.appendChild(d);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = 'tool';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = def.icon;
      const label = document.createElement('span');
      label.textContent = def.label;
      btn.append(icon, label);
      if (def.key) {
        const k = document.createElement('span');
        k.className = 'key';
        k.textContent = def.key;
        btn.appendChild(k);
      }
      if (def.price !== undefined) {
        const p = document.createElement('span');
        p.className = 'price';
        p.textContent = `§${def.price}`;
        btn.appendChild(p);
      }
      btn.addEventListener('click', () => this.set(def.tool));
      this.buttons.set(def.tool, btn);
      bar.appendChild(btn);
    }

    hud.appendChild(bar);

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const byKey: Record<string, Tool> = {
        KeyX: 'select',
        KeyT: 'road',
        KeyR: 'zone-res',
        KeyC: 'zone-com',
        KeyI: 'zone-ind',
        KeyP: 'power',
        KeyF: 'fire',
        KeyB: 'bulldoze',
      };
      const tool = byKey[e.code];
      if (tool) this.set(tool);
      if (e.code === 'Escape') this.set('select');
    });

    // Highlight the default tool without firing onChange — main.ts is still
    // wiring up when this constructor runs.
    this.buttons.get(this.active)?.classList.add('active');
  }

  set(tool: Tool): void {
    this.active = tool;
    for (const [t, btn] of this.buttons) btn.classList.toggle('active', t === tool);
    this.onChange(tool);
  }
}
