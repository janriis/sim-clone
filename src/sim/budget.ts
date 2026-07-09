import { MAINTENANCE, TAX_INCOME_FACTOR } from '../config';
import { ZONE_RES, type GameEvent, type GameState } from '../core/types';

export interface BudgetReport {
  income: number;
  roadCost: number;
  serviceCost: number;
  net: number;
}

/** Monthly budget: tax income minus road/service maintenance. */
export function applyBudget(state: GameState, events: GameEvent[]): BudgetReport {
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
      const occupants = b.zone === ZONE_RES ? b.population : b.jobs;
      income += occupants * rate * TAX_INCOME_FACTOR;
    } else if (b.service) {
      serviceCost += MAINTENANCE[b.service];
    }
  }

  let roadTiles = 0;
  let wireTiles = 0;
  for (const t of state.tiles) {
    if (t.road) roadTiles++;
    if (t.wire) wireTiles++;
  }
  const roadCost = roadTiles * MAINTENANCE.roadPerTile + wireTiles * MAINTENANCE.wirePerTile;

  const net = income - roadCost - serviceCost;
  const wasSolvent = state.money >= 0;
  state.money += net;

  if (state.money < 0 && wasSolvent) {
    events.push({
      kind: 'bad',
      title: 'Treasury empty!',
      detail: 'The city is in debt — construction is blocked until the budget recovers.',
    });
  }

  return { income: Math.round(income), roadCost, serviceCost, net: Math.round(net) };
}
