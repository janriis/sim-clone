import type { GameEvent } from '../core/types';

/** Queued toast notifications, bottom-center. */
export class Toasts {
  private container: HTMLDivElement;

  constructor(hud: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'toasts';
    hud.appendChild(this.container);
  }

  show(event: GameEvent): void {
    const el = document.createElement('div');
    el.className = `toast ${event.kind}`;
    const title = document.createElement('b');
    title.textContent = event.title;
    const detail = document.createElement('span');
    detail.textContent = event.detail;
    el.append(title, detail);
    this.container.appendChild(el);

    // cap simultaneous toasts
    while (this.container.children.length > 4) this.container.firstChild?.remove();

    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    }, 5200);
  }

  showAll(events: GameEvent[]): void {
    for (const e of events) this.show(e);
  }
}
