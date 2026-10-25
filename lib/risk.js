// What a portfolio's choices mean: where the money sits, how much it moves,
// and how spread out it is.
//
// Like portfolio.js, this knows nothing about the page.

import { INSTRUMENTS, findInstrument } from './universe.js';
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

// ---- part 3: the diversification score ----
//
// 60 points for owning many different things, 40 for spreading across sectors.
// An index fund holds hundreds of companies, so it counts as FUND_PIECES
// companies spread across every sector. Cash is left out, like on the ring.
export const FUND_PIECES = 20;
const FULL_PIECES = 15;  // 15 evenly sized pieces earns the full 60
const FULL_SECTORS = 4;  // 4 evenly sized sectors earns the full 40
const NUDGE_STOCK = 0.4;   // one company at 40% or more of your shares
const NUDGE_SECTOR = 0.6;  // one sector at 60% or more

/**
 * "Effective number": 4 equal pieces gives 4, but one big piece and three tiny
 * ones gives close to 1, because the big one is really all that matters.
 */
const effective = (weights) => 1 / weights.reduce((sum, w) => sum + w * w, 0);
const upTo1 = (count, full) => Math.min(1, Math.max(0, (count - 1) / (full - 1)));

/**
 * Returns null if you own nothing. Otherwise:
 *   score   whole number 0 to 100
 *   label   'Not spread out' (0-39), 'Getting there' (40-74), 'Well spread' (75+)
 *   nudge   one gentle tip about the biggest thing to fix
 */
export function diversification(portfolio, pricesPaise) {
  const rows = value(portfolio, pricesPaise).rows.filter((r) => r.valuePaise > 0);
  const investedPaise = rows.reduce((sum, r) => sum + r.valuePaise, 0);
  if (!investedPaise) return null;

  const stockSectors = [...new Set(INSTRUMENTS.filter((i) => i.kind === 'stock').map((i) => i.sector))];
  const pieces = [];
  const sectors = {};
  const addSector = (name, w) => { sectors[name] = (sectors[name] ?? 0) + w; };
  for (const r of rows) {
    const info = findInstrument(r.symbol);
    const w = r.valuePaise / investedPaise;
    if (info?.kind === 'fund') {
      for (let i = 0; i < FUND_PIECES; i++) pieces.push(w / FUND_PIECES);
      for (const s of stockSectors) addSector(s, w / stockSectors.length);
    } else {
      pieces.push(w);
      addSector(info?.sector ?? 'Other', w);
    }
  }

  const score = Math.round(60 * upTo1(effective(pieces), FULL_PIECES) + 40 * upTo1(effective(Object.values(sectors)), FULL_SECTORS));
  const label = score >= 75 ? 'Well spread' : score >= 40 ? 'Getting there' : 'Not spread out';

  // One tip only: the biggest problem first.
  const pct = (w) => Math.round(w * 100);
  const biggestStock = rows.filter((r) => findInstrument(r.symbol)?.kind !== 'fund')
    .sort((a, b) => b.valuePaise - a.valuePaise)[0];
  const stockShare = biggestStock ? biggestStock.valuePaise / investedPaise : 0;
  const stockOnly = {};
  for (const r of rows) {
    const info = findInstrument(r.symbol);
    if (info?.kind !== 'fund') stockOnly[info?.sector ?? 'Other'] = (stockOnly[info?.sector ?? 'Other'] ?? 0) + r.valuePaise / investedPaise;
  }
  const [topSector, sectorShare] = Object.entries(stockOnly).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const hasFund = rows.some((r) => findInstrument(r.symbol)?.kind === 'fund');

  let nudge;
  if (stockShare >= NUDGE_STOCK) {
    const name = findInstrument(biggestStock.symbol)?.name ?? biggestStock.symbol;
    nudge = `${pct(stockShare)}% of what you've invested is in one company (${name}). If it has a bad day, most of your money does too.`;
  } else if (sectorShare >= NUDGE_SECTOR) {
    nudge = `${pct(sectorShare)}% of what you've invested is in ${topSector}. Shares in a different sector would spread the risk.`;
  } else if (!hasFund && score < 75) {
    nudge = 'An index fund holds hundreds of companies in one buy, so it would lift your score a lot.';
  } else {
    nudge = 'Nicely spread out. No single company or sector can sink you on its own.';
  }

  return { score, label, nudge };
}
