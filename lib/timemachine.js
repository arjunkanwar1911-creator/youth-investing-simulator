// The Time Machine: "what if I had put this money in, back then?"
//
// Pretend money only. Educational, not financial advice.
//
//   timeMachine(history, { AAPL: 0.5, SPY: 0.5 }, 10000, '2016-01-01')
//
// `history` is the shape of data/history.json: { prices: { SYMBOL: [{ date, close }] } },
// oldest first. We buy on the first month that every fund in the mix has a price
// for, on or after startDate, then hold until the newest month we have.

const WEIGHT_TOLERANCE = 1e-9;

function monthsBetween(from, to) {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

function checkMix(mix) {
  if (!mix || typeof mix !== 'object' || Object.keys(mix).length === 0) {
    throw new Error('The mix is empty. Pick at least one stock or fund.');
  }
  let total = 0;
  for (const [symbol, weight] of Object.entries(mix)) {
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`The weight for ${symbol} must be a number above 0 (got ${weight}).`);
    }
    total += weight;
  }
  if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
    throw new Error(`The weights must add up to 1 (100%), but they add up to ${total}.`);
  }
}

export function timeMachine(history, mix, amount, startDate) {
  checkMix(mix);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`The amount must be a number above 0 (got ${amount}).`);
  }
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error(`The start date must look like 2016-01-31 (got ${startDate}).`);
  }

  // symbol -> Map(date -> close)
  const closes = {};
  for (const symbol of Object.keys(mix)) {
    const rows = history?.prices?.[symbol];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`There is no price history for ${symbol}.`);
    }
    closes[symbol] = new Map(rows.map((row) => [row.date, row.close]));
  }

  // Only months where every holding has a price, on or after the start date.
  const symbols = Object.keys(mix);
  const dates = [...closes[symbols[0]].keys()]
    .filter((date) => date >= startDate && symbols.every((s) => closes[s].has(date)))
    .sort();

  if (dates.length === 0) {
    throw new Error(`No month on or after ${startDate} has prices for every holding.`);
  }

  // Buy: split the money by weight, and work out how many shares each part buys.
  const shares = {};
  for (const symbol of symbols) {
    shares[symbol] = (amount * mix[symbol]) / closes[symbol].get(dates[0]);
  }

  const values = dates.map((date) => ({
    date,
    value: symbols.reduce((sum, s) => sum + shares[s] * closes[s].get(date), 0),
  }));

  const startValue = values[0].value;
  const endValue = values.at(-1).value;

  // Worst fall from a peak to a later low, as a positive percentage.
  let peak = startValue;
  let worstDrop = 0;
  for (const { value } of values) {
    if (value > peak) peak = value;
    worstDrop = Math.max(worstDrop, (peak - value) / peak);
  }

  const years = monthsBetween(dates[0], dates.at(-1)) / 12;

  return {
    startValue,
    endValue,
    totalReturnPct: (endValue / startValue - 1) * 100,
    // Compound yearly rate. With under a month of data there is no "per year".
    yearlyReturnPct: years > 0 ? ((endValue / startValue) ** (1 / years) - 1) * 100 : null,
    worstDropPct: worstDrop * 100,
    values,
  };
}
