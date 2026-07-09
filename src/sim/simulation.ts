import { DAYS_PER_MONTH, FIELD_INTERVAL } from '../config';
import type { GameEvent, GameState } from '../core/types';
import { recomputeRoadAccess } from './access';
import { applyBudget } from './budget';
import { computeDemand } from './demand';
import { checkMilestones, rollMonthlyEvents, tickFire, tickRubble } from './events';
import { tickGrowth } from './growth';
import { recomputeFields } from './landvalue';
import { recomputePower } from './power';

/**
 * One tick = one game day. Returns notable events for the UI to toast.
 * Order matters: infrastructure caches refresh before growth reads them.
 */
export function tick(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  state.day++;

  if (state.dirty.power) {
    recomputePower(state);
    state.dirty.power = false;
  }
  if (state.dirty.access) {
    recomputeRoadAccess(state);
    state.dirty.access = false;
  }
  if (state.dirty.fields || state.day % FIELD_INTERVAL === 0) {
    recomputeFields(state);
    state.dirty.fields = false;
  }

  tickFire(state, events);
  tickRubble(state);
  computeDemand(state);
  tickGrowth(state);

  if (state.day % DAYS_PER_MONTH === 0) {
    applyBudget(state, events);
    rollMonthlyEvents(state, events);
  }
  checkMilestones(state, events);

  return events;
}
