import { DAYS_PER_MONTH, START_YEAR } from '../config';
import type { GameState, Speed } from '../core/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Top bar: money, population, jobs, date, RCI demand, speed controls. */
export class Hud {
  private moneyEl: HTMLElement;
  private popEl: HTMLElement;
  private jobsEl: HTMLElement;
  private dateEl: HTMLElement;
  private fills: { res: HTMLElement; com: HTMLElement; ind: HTMLElement };
  private speedButtons: HTMLButtonElement[] = [];
  private last = { money: NaN, pop: NaN, jobs: NaN, day: NaN, res: NaN, com: NaN, ind: NaN, speed: -1 };

  constructor(
    hud: HTMLElement,
    onSpeed: (s: Speed) => void,
  ) {
    const bar = document.createElement('div');
    bar.className = 'topbar';

    const stat = (label: string): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.className = 'stat';
      const l = document.createElement('span');
      l.className = 'label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'value';
      wrap.append(l, v);
      bar.appendChild(wrap);
      return v;
    };

    this.moneyEl = stat('Funds');
    this.popEl = stat('Population');
    this.jobsEl = stat('Jobs');
    this.dateEl = stat('Date');

    // RCI bars
    const rci = document.createElement('div');
    rci.className = 'rci';
    const mkBar = (cls: string, letter: string): HTMLElement => {
      const bar2 = document.createElement('div');
      bar2.className = `bar ${cls}`;
      const track = document.createElement('div');
      track.className = 'track';
      const fill = document.createElement('div');
      fill.className = 'fill';
      track.appendChild(fill);
      const s = document.createElement('span');
      s.textContent = letter;
      bar2.append(track, s);
      rci.appendChild(bar2);
      return fill;
    };
    this.fills = { res: mkBar('res', 'R'), com: mkBar('com', 'C'), ind: mkBar('ind', 'I') };
    bar.appendChild(rci);

    // speed controls
    const speeds = document.createElement('div');
    speeds.className = 'speeds';
    const labels = ['⏸', '▶', '▶▶', '▶▶▶'];
    for (let s = 0; s <= 3; s++) {
      const btn = document.createElement('button');
      btn.textContent = labels[s];
      btn.title = `Speed ${s} (key ${s})`;
      btn.addEventListener('click', () => onSpeed(s as Speed));
      speeds.appendChild(btn);
      this.speedButtons.push(btn);
    }
    bar.appendChild(speeds);

    hud.appendChild(bar);
  }

  update(state: GameState): void {
    const money = Math.round(state.money);
    if (money !== this.last.money) {
      this.last.money = money;
      this.moneyEl.textContent = `§${money.toLocaleString()}`;
      this.moneyEl.classList.toggle('negative', money < 0);
    }
    if (state.population !== this.last.pop) {
      this.last.pop = state.population;
      this.popEl.textContent = state.population.toLocaleString();
    }
    if (state.jobs !== this.last.jobs) {
      this.last.jobs = state.jobs;
      this.jobsEl.textContent = state.jobs.toLocaleString();
    }
    if (state.day !== this.last.day) {
      this.last.day = state.day;
      const month = Math.floor(state.day / DAYS_PER_MONTH);
      this.dateEl.textContent = `${MONTHS[month % 12]} ${START_YEAR + Math.floor(month / 12)}`;
    }
    const d = state.demand;
    const setFill = (el: HTMLElement, v: number, key: 'res' | 'com' | 'ind'): void => {
      const rounded = Math.round(v);
      if (rounded === this.last[key]) return;
      this.last[key] = rounded;
      el.style.height = `${Math.max(0, Math.min(100, (v + 100) / 2))}%`;
    };
    setFill(this.fills.res, d.res, 'res');
    setFill(this.fills.com, d.com, 'com');
    setFill(this.fills.ind, d.ind, 'ind');

    if (state.speed !== this.last.speed) {
      this.last.speed = state.speed;
      this.speedButtons.forEach((b, i) => b.classList.toggle('active', i === state.speed));
    }
  }
}
