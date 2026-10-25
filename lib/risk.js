// What a portfolio's choices mean: where the money sits, how much it moves,
// and how spread out it is.
//
// Like portfolio.js, this knows nothing about the page.

import { findInstrument } from './universe.js';
import { value } from './portfolio.js';

const KIND_LABELS = { stock: 'Single companies', fund: 'Index funds' };

/**
 * Splits the money you've invested three ways: by kind of asset, by sector, by
 * currency. Cash is left out of the splits (Arjun's choice) and returned on its own.
 * Each split is a list of { label, paise, share, percent } sorted biggest first.
 * share is a fraction of the invested money (0 to 1); percent is a whole number for showing.
 */
export function allocation(portfolio, pricesPaise) {
  const v = value(portfolio, pricesPaise);
  const groups = { kind: {}, sector: {}, currency: {} };
  const add = (split, label, paise) => { groups[split][label] = (groups[split][label] ?? 0) + paise; };

  for (const row of v.rows) {
    const info = findInstrument(row.symbol);
    add('kind', KIND_LABELS[info?.kind] ?? 'Other', row.valuePaise);
    add('sector', info?.sector ?? 'Other', row.valuePaise);
    add('currency', info?.currency ?? 'Other', row.valuePaise);
  }

  const toList = (totals) => withPercents(Object.entries(totals)
    .map(([label, paise]) => ({ label, paise, share: v.holdingsPaise ? paise / v.holdingsPaise : 0 }))
    .sort((a, b) => b.paise - a.paise || a.label.localeCompare(b.label)));

  return {
    investedPaise: v.holdingsPaise,
    cashPaise: v.cashPaise,
    kind: toList(groups.kind),
    sector: toList(groups.sector),
    currency: toList(groups.currency),
  };
}

/**
 * Whole-number percents that add up to exactly 100. Rounding each slice on its
 * own can give 101 or 99, so: round every slice down, then hand the spare
 * points to the slices that were closest to rounding up (largest remainder).
 */
function withPercents(groups) {
  const exact = groups.map((g) => g.share * 100);
  const percents = exact.map(Math.floor);
  const spare = groups.length ? 100 - percents.reduce((s, p) => s + p, 0) : 0;
  exact.map((x, i) => ({ i, left: x - percents[i] }))
    .sort((a, b) => b.left - a.left || a.i - b.i)
    .slice(0, spare)
    .forEach(({ i }) => percents[i]++);
  return groups.map((g, i) => ({ ...g, percent: percents[i] }));
}
