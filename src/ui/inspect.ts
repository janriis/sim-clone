import { idx } from '../core/grid';
import {
  ZONE_COM,
  ZONE_IND,
  ZONE_RES,
  type GameState,
} from '../core/types';
import { capacityOf } from '../sim/growth';
import { pumpCapacity } from '../sim/water';
import { POWER_PER_PLANT } from '../config';

const ZONE_NAMES = ['Unzoned', 'Residential', 'Commercial', 'Industrial'];
const SERVICE_NAMES: Record<string, string> = {
  power: 'Power plant',
  pump: 'Water pump',
  police: 'Police station',
  fire: 'Fire station',
  park: 'Park',
  school: 'School',
};

/** Click-a-tile inspector panel. */
export class Inspector {
  private panel: HTMLDivElement;
  private body: HTMLDivElement;
  private tile: [number, number] | null = null;

  constructor(hud: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    this.panel.style.display = 'none';

    const h3 = document.createElement('h3');
    h3.textContent = 'Tile info';
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.hide());
    h3.appendChild(close);

    this.body = document.createElement('div');
    this.panel.append(h3, this.body);
    hud.appendChild(this.panel);
  }

  show(tile: [number, number]): void {
    this.tile = tile;
    this.panel.style.display = 'block';
  }

  hide(): void {
    this.tile = null;
    this.panel.style.display = 'none';
  }

  update(state: GameState): void {
    if (!this.tile) return;
    const [x, y] = this.tile;
    const t = state.tiles[idx(x, y)];
    const b = t.buildingId ? state.buildings[t.buildingId] : null;

    const rows: Array<[string, string]> = [];
    rows.push(['Location', `${x}, ${y}`]);
    if (t.terrain === 'water') {
      rows.push(['Terrain', 'Water']);
    } else if (t.road) {
      rows.push(['Type', 'Road']);
    } else if (t.wire) {
      rows.push(['Type', 'Power line']);
      rows.push(['Energized', t.powered ? 'Yes' : 'No']);
    } else {
      rows.push(['Zone', ZONE_NAMES[t.zone]]);
      if (b) {
        if (b.kind === 'service') {
          rows.push(['Building', SERVICE_NAMES[b.service ?? ''] ?? '—']);
          if (b.service === 'power') {
            rows.push(['Supplies', `${POWER_PER_PLANT} buildings`]);
          } else if (b.service === 'pump') {
            rows.push(['Supplies', `${pumpCapacity(state, b)} buildings`]);
            rows.push(['Running', t.powered ? 'Yes' : 'No — needs power ⚡']);
          }
        } else {
          const kind =
            b.zone === ZONE_RES ? 'Homes' : b.zone === ZONE_COM ? 'Shops' : 'Factory';
          rows.push(['Building', `${kind} · level ${b.level}${b.abandoned ? ' (abandoned)' : ''}`]);
          rows.push(['Condition', `${Math.round(b.condition)} / 100`]);
          if (b.zone === ZONE_RES) {
            rows.push(['Residents', `${Math.round(b.population)} / ${capacityOf(b)}`]);
          } else if (b.zone === ZONE_COM || b.zone === ZONE_IND) {
            rows.push(['Jobs', `${Math.round(b.jobs)} / ${capacityOf(b)}`]);
          }
        }
      }
      rows.push(['Powered', t.powered ? 'Yes' : 'No ⚡']);
      rows.push(['Water', t.watered ? 'Yes' : 'No 💧']);
      rows.push(['Road access', t.roadAccess ? 'Yes' : 'No']);
      rows.push(['Land value', `${Math.round(t.landValue)}`]);
      rows.push(['Pollution', `${Math.round(t.pollution)}`]);
      if (t.fire > 0) rows.push(['Status', '🔥 ON FIRE']);
      if (t.rubble > 0) rows.push(['Status', `Rubble (${t.rubble}d left)`]);
    }

    this.body.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'row';
        const l = document.createElement('span');
        l.textContent = label;
        const v = document.createElement('b');
        v.textContent = value;
        row.append(l, v);
        return row;
      }),
    );
  }
}
