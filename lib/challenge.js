// The weekly challenge: "Survive the crash".
//
// Pretend money only. Educational, not financial advice.
//
// Every week everyone gets the same rough patch from the past and the same pretend
// money. You choose whole shares (or keep cash), then we replay the patch month by
// month and compare you with the S&P 500 fund (SPY).
//
// "Same for everyone" works because the scenario is chosen from the week number,
// not at random: same week number in, same scenario out.

export const CHALLENGE_MONEY = 10000; // US dollars, same as the time machine
export const MARKET_SYMBOL = 'SPY';

// Rough patches, found in the real SPY history (a test checks each one fell by 8% or more).
// `start` and `end` are months. The name is hidden until a learner has locked in their answer.
export const SCENARIOS = [
  { id: 'autumn-2018', start: '2018-09', end: '2018-12', name: 'The autumn 2018 slide' },
  { id: 'covid-2020', start: '2019-12', end: '2020-03', name: 'The 2020 crash' },
  { id: 'rates-2022-a', start: '2021-12', end: '2022-06', name: 'The 2022 interest rate slide' },
  { id: 'rates-2022-b', start: '2022-03', end: '2022-09', name: 'The 2022 summer slump' },
  { id: 'autumn-2023', start: '2023-07', end: '2023-10', name: 'The autumn 2023 dip' },
  { id: 'late-2026', start: '2026-08', end: '2026-11', name: 'The late 2026 fall' },
];

// ---- weeks: Monday 00:00 India time (IST is UTC+5:30) ----

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
const FIRST_MONDAY_DAY = Date.UTC(2026, 0, 5) / DAY_MS; // Monday 5 January 2026 = week 0

/** Which week is it? Week 0 starts Monday 5 Jan 2026, India time. */
export function weekNumber(now = new Date()) {
  const dayInIndia = Math.floor((now.getTime() + IST_MS) / DAY_MS);
  return Math.floor((dayInIndia - FIRST_MONDAY_DAY) / 7);
}

/** The Monday a week starts on, as 2026-11-16. */
export function weekStartDate(week) {
  return new Date((FIRST_MONDAY_DAY + week * 7) * DAY_MS).toISOString().slice(0, 10);
}

/** The exact moment the next week begins (a Date): next Monday 00:00 India time. */
export function nextReset(week) {
  return new Date((FIRST_MONDAY_DAY + (week + 1) * 7) * DAY_MS - IST_MS);
}

// ---- the seeded part: same number in, same shuffle out ----

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(count, seed) {
  const order = [...Array(count).keys()];
  const random = mulberry32(seed);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * This week's scenario. The scenarios are shuffled once per "round" of six weeks,
 * so none comes back until every other one has been used.
 */
export function scenarioForWeek(week) {
  const n = SCENARIOS.length;
  const round = Math.floor(week / n);
  const place = ((week % n) + n) % n;
  return SCENARIOS[shuffled(n, round + 1)[place]];
}

// ---- playing a challenge ----

const monthDate = (month) => `${month}-01`;

function priceAt(history, symbol, date) {
  const row = history?.prices?.[symbol]?.find((r) => r.date === date);
  if (!row) throw new Error(`There is no ${symbol} price for ${date.slice(0, 7)}.`);
  return row.close;
}

/** Month by month value of some shares plus cash, and the numbers we show. */
function replay(history, shares, cash, dates) {
  const values = dates.map((date) => ({
    date,
    value: cash + Object.entries(shares).reduce((sum, [s, n]) => sum + n * priceAt(history, s, date), 0),
  }));
  const start = values[0].value;
  const end = values.at(-1).value;

  let peak = start;
  let worstDrop = 0;
  for (const { value } of values) {
    peak = Math.max(peak, value);
    worstDrop = Math.max(worstDrop, (peak - value) / peak);
  }

  return {
    startValue: start,
    endValue: end,
    totalReturnPct: (end / start - 1) * 100,
    worstDropPct: worstDrop * 100,
    values,
  };
}

/**
 * Play one challenge.
 *   shares: { AAPL: 10, KO: 20 }  whole shares, bought at the first month's price.
 * Money you do not spend stays as cash and earns nothing.
 * Returns your result, the S&P 500's result, and whether you lost less than the market.
 */
export function playChallenge(history, scenario, shares, money = CHALLENGE_MONEY) {
  const symbols = Object.keys(shares ?? {});
  for (const symbol of symbols) {
    const n = shares[symbol];
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Shares of ${symbol} must be a whole number above 0 (got ${n}).`);
    }
  }

  const startDate = monthDate(scenario.start);
  const endDate = monthDate(scenario.end);

  // Every month in the patch that the market fund and all your stocks have a price for.
  const hasPrice = (symbol, date) => history?.prices?.[symbol]?.some((r) => r.date === date);
  const dates = (history?.prices?.[MARKET_SYMBOL] ?? [])
    .map((r) => r.date)
    .filter((d) => d >= startDate && d <= endDate && symbols.every((s) => hasPrice(s, d)));
  if (dates.length < 2 || dates[0] !== startDate) {
    throw new Error('We do not have prices for every stock you picked in this rough patch.');
  }

  const cost = symbols.reduce((sum, s) => sum + shares[s] * priceAt(history, s, startDate), 0);
  if (cost > money + 1e-9) {
    throw new Error(`That costs $${cost.toFixed(2)} but you only have $${money}.`);
  }
  const cash = money - cost;

  const yours = replay(history, shares, cash, dates);
  const marketShares = { [MARKET_SYMBOL]: money / priceAt(history, MARKET_SYMBOL, startDate) };
  const market = replay(history, marketShares, 0, dates);

  return {
    scenario,
    money,
    cost,
    cash,
    yours,
    market,
    // "Survive" = you lost less than the market (or gained more).
    survived: yours.endValue > market.endValue,
  };
}
