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

// How bumpy is "bumpy"? Daily moves, as a percent, for the money in shares.
// Index funds sit under 1%, steady big companies 1-2%, exciting ones over 2%.
export const CALM_BELOW = 1;
export const BUMPY_FROM = 2;

/**
 * How much the shares you own today would have moved each day over the price
 * history (about 6 months). Uses today's quantities on every past day, so it
 * answers "how bumpy is what I hold now", not "how did my trades go".
 *
 * Returns null if there is nothing to measure. Otherwise:
 *   dailyPercent  the standard deviation of daily moves: a "normal day" size
 *   dailyPaise    that percent of today's money in shares, in paise
 *   level         'Calm', 'Medium' or 'Bumpy'
 *   worst         the biggest one-day fall: { date, percent, paise }
 *   days          how many daily moves it is based on
 */
export function volatility(portfolio, stocks, forex) {
  const symbols = Object.keys(portfolio.holdings);
  if (!symbols.length) return null;

  // One value per date, only on dates where every holding has a price.
  const closes = {};
  for (const symbol of symbols) {
    const info = findInstrument(symbol);
    const rate = info?.currency === 'INR' ? 1 : forex?.rates?.[info?.currency]?.inr;
    const history = stocks?.prices?.[symbol]?.history;
    if (!Number.isFinite(rate) || !Array.isArray(history)) return null;
    for (const { date, close } of history) {
      if (!Number.isFinite(close)) continue;
      (closes[date] ??= {})[symbol] = close * rate * 100;
    }
  }
  const series = Object.keys(closes).sort()
    .filter((date) => symbols.every((s) => closes[date][s] !== undefined))
    .map((date) => ({ date, paise: symbols.reduce((sum, s) => sum + closes[date][s] * portfolio.holdings[s].quantity, 0) }));
  if (series.length < 3) return null;

  const moves = series.slice(1).map((day, i) => ({ date: day.date, change: day.paise / series[i].paise - 1 }));
  const average = moves.reduce((sum, m) => sum + m.change, 0) / moves.length;
  // Standard deviation: how far a typical day lands from the average day.
  const spread = Math.sqrt(moves.reduce((sum, m) => sum + (m.change - average) ** 2, 0) / moves.length);
  const worst = moves.reduce((low, m) => (m.change < low.change ? m : low));

  const nowPaise = series.at(-1).paise;
  const dailyPercent = spread * 100;
  return {
    dailyPercent,
    dailyPaise: Math.round(spread * nowPaise),
    level: dailyPercent < CALM_BELOW ? 'Calm' : dailyPercent < BUMPY_FROM ? 'Medium' : 'Bumpy',
    worst: { date: worst.date, percent: worst.change * 100, paise: Math.round(worst.change * nowPaise) },
    days: moves.length,
  };
}
