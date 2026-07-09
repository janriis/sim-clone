import { DEMAND, TAX_DEFAULT } from '../config';
import { ZONE_COM, ZONE_IND, type GameState } from '../core/types';

function clamp100(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

/**
 * RCI demand in [-100, 100]. Feedback loop: residents fill jobs -> more jobs
 * wanted -> com/ind grow -> more residents wanted.
 */
export function computeDemand(state: GameState): void {
  const workforce = state.population * DEMAND.workforceRatio;
  let comJobs = 0;
  let indJobs = 0;
  for (const id in state.buildings) {
    const b = state.buildings[id];
    if (b.kind !== 'zone' || b.abandoned) continue;
    if (b.zone === ZONE_COM) comJobs += b.jobs;
    else if (b.zone === ZONE_IND) indJobs += b.jobs;
  }
  const totalJobs = comJobs + indJobs;
  const pen = (rate: number) => (rate - TAX_DEFAULT) * DEMAND.taxPenaltyPerPoint;

  const mult = state.modifier?.demandMult ?? 1;
  state.demand.res = clamp100(
    ((totalJobs * 1.15 + DEMAND.bootstrapJobs - workforce) * 1.2 - pen(state.taxRates.res)) * mult,
  );
  state.demand.com = clamp100(
    ((state.population * 0.3 - comJobs) * 1.6 - pen(state.taxRates.com)) * mult,
  );
  state.demand.ind = clamp100(
    ((state.population * 0.35 - indJobs) * 1.4 - pen(state.taxRates.ind) + DEMAND.indExportBias) *
      mult,
  );
}
