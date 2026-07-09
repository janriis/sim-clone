import { MAINTENANCE, TAX_INCOME_FACTOR } from '../config';
import { ZONE_RES, type GameState } from '../core/types';

/** Budget & taxes panel, toggled from the corner buttons. */
export class BudgetPanel {
  private panel: HTMLDivElement;
  private incomeEl: HTMLElement;
  private expenseEl: HTMLElement;
  private netEl: HTMLElement;
  private sliders: Record<'res' | 'com' | 'ind', { input: HTMLInputElement; label: HTMLElement }>;
  visible = false;

  constructor(hud: HTMLElement, state: GameState) {
    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    this.panel.style.display = 'none';
    this.panel.style.top = '74px';

    const h3 = document.createElement('h3');
    h3.textContent = 'Budget & taxes';
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggle());
    h3.appendChild(close);
    this.panel.appendChild(h3);

    const mkSlider = (
      key: 'res' | 'com' | 'ind',
      name: string,
    ): { input: HTMLInputElement; label: HTMLElement } => {
      const wrap = document.createElement('div');
      wrap.className = 'tax-row';
      const row = document.createElement('div');
      row.className = 'row';
      const l = document.createElement('span');
      l.textContent = `${name} tax`;
      const v = document.createElement('b');
      v.textContent = `${state.taxRates[key]}%`;
      row.append(l, v);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '20';
      input.value = String(state.taxRates[key]);
      input.addEventListener('input', () => {
        state.taxRates[key] = Number(input.value);
        v.textContent = `${input.value}%`;
      });
      wrap.append(row, input);
      this.panel.appendChild(wrap);
      return { input, label: v };
    };

    this.sliders = {
      res: mkSlider('res', 'Residential'),
      com: mkSlider('com', 'Commercial'),
      ind: mkSlider('ind', 'Industrial'),
    };

    const mkRow = (label: string): HTMLElement => {
      const row = document.createElement('div');
      row.className = 'row';
      const l = document.createElement('span');
      l.textContent = label;
      const v = document.createElement('b');
      row.append(l, v);
      this.panel.appendChild(row);
      return v;
    };
    this.incomeEl = mkRow('Monthly income');
    this.expenseEl = mkRow('Monthly expenses');
    this.netEl = mkRow('Net');

    hud.appendChild(this.panel);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? 'block' : 'none';
  }

  /** Live estimate of the monthly budget from current occupancy. */
  update(state: GameState): void {
    if (!this.visible) return;
    let income = 0;
    let serviceCost = 0;
    for (const id in state.buildings) {
      const b = state.buildings[id];
      if (b.kind === 'zone') {
        if (b.abandoned) continue;
        const rate =
          b.zone === ZONE_RES
            ? state.taxRates.res
            : b.zone === 2
              ? state.taxRates.com
              : state.taxRates.ind;
        income += (b.zone === ZONE_RES ? b.population : b.jobs) * rate * TAX_INCOME_FACTOR;
      } else if (b.service) {
        serviceCost += MAINTENANCE[b.service];
      }
    }
    let roads = 0;
    let wires = 0;
    for (const t of state.tiles) {
      if (t.road) roads++;
      if (t.wire) wires++;
    }
    const expense =
      serviceCost + roads * MAINTENANCE.roadPerTile + wires * MAINTENANCE.wirePerTile;
    const net = income - expense;
    this.incomeEl.textContent = `§${Math.round(income).toLocaleString()}`;
    this.expenseEl.textContent = `§${Math.round(expense).toLocaleString()}`;
    this.netEl.textContent = `${net >= 0 ? '+' : '−'}§${Math.abs(Math.round(net)).toLocaleString()}`;
    (this.netEl as HTMLElement).style.color = net >= 0 ? 'var(--good)' : 'var(--bad)';
  }

  /** Sync sliders if taxes changed elsewhere (e.g. on load). */
  sync(state: GameState): void {
    for (const key of ['res', 'com', 'ind'] as const) {
      this.sliders[key].input.value = String(state.taxRates[key]);
      this.sliders[key].label.textContent = `${state.taxRates[key]}%`;
    }
  }
}
