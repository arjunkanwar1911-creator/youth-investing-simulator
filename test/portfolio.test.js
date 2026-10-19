import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPortfolio, buy, sell, value, isPortfolio, STARTING_CASH_PAISE } from '../lib/portfolio.js';

const day = '2026-10-16';
const ok = (result) => {
  assert.equal(result.ok, true, result.reason);
  return result.portfolio;
};

test('every learner starts with 1,00,000 rupees and nothing else', () => {
  const p = newPortfolio();
  assert.equal(p.cashPaise, 10000000);
  assert.deepEqual(p.holdings, {});
  assert.deepEqual(p.trades, []);
});

test('buying moves money from cash into shares, and the total stays the same', () => {
  const p = ok(buy(newPortfolio(), { symbol: 'KO', quantity: 10, pricePaise: 650000, date: day }));
  assert.equal(p.cashPaise, STARTING_CASH_PAISE - 6500000);
  assert.deepEqual(p.holdings.KO, { quantity: 10, costPaise: 6500000 });
  assert.equal(value(p, { KO: 650000 }).totalPaise, STARTING_CASH_PAISE);
});

test('edge case: you cannot spend more than you have', () => {
  const start = newPortfolio();
  const result = buy(start, { symbol: 'SPY', quantity: 2, pricePaise: 6200000, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /No borrowing/);
  assert.equal(start.cashPaise, STARTING_CASH_PAISE); // nothing changed
});

test('edge case: spending exactly all your cash is allowed', () => {
  const p = ok(buy(newPortfolio(), { symbol: 'VTI', quantity: 4, pricePaise: 2500000, date: day }));
  assert.equal(p.cashPaise, 0);
});

test('edge case: you cannot sell something you do not own', () => {
  const result = sell(newPortfolio(), { symbol: 'TSLA', quantity: 1, pricePaise: 4000000, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /No short selling/);
});

test('edge case: you cannot sell more than you own', () => {
  const p = ok(buy(newPortfolio(), { symbol: 'NKE', quantity: 3, pricePaise: 700000, date: day }));
  const result = sell(p, { symbol: 'NKE', quantity: 4, pricePaise: 700000, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /only own 3/);
});

test('edge case: zero, negative and nonsense quantities are refused', () => {
  for (const quantity of [0, -5, NaN, Infinity, 0.0000001]) {
    assert.equal(buy(newPortfolio(), { symbol: 'KO', quantity, pricePaise: 650000, date: day }).ok, false, `qty ${quantity}`);
  }
  assert.equal(buy(newPortfolio(), { symbol: 'KO', quantity: 1, pricePaise: undefined, date: day }).ok, false);
});

test('selling everything removes the holding completely', () => {
  let p = ok(buy(newPortfolio(), { symbol: 'DIS', quantity: 0.3, pricePaise: 1000000, date: day }));
  p = ok(buy(p, { symbol: 'DIS', quantity: 0.6, pricePaise: 1000000, date: day }));
  p = ok(sell(p, { symbol: 'DIS', quantity: 0.9, pricePaise: 1000000, date: day })); // 0.3 + 0.6 is not 0.9 in raw decimals
  assert.equal(p.holdings.DIS, undefined);
  assert.equal(p.cashPaise, STARTING_CASH_PAISE);
});

test('selling half keeps the average price you paid', () => {
  let p = ok(buy(newPortfolio(), { symbol: 'MSFT', quantity: 2, pricePaise: 4000000, date: day }));
  p = ok(sell(p, { symbol: 'MSFT', quantity: 1, pricePaise: 5000000, date: day }));
  assert.deepEqual(p.holdings.MSFT, { quantity: 1, costPaise: 4000000 });
  assert.equal(value(p, { MSFT: 5000000 }).rows[0].gainPaise, 1000000);
});

test('every trade lands in the history with date, price and quantity', () => {
  let p = ok(buy(newPortfolio(), { symbol: 'V', quantity: 1, pricePaise: 3000000, date: '2026-10-15' }));
  p = ok(sell(p, { symbol: 'V', quantity: 1, pricePaise: 3100000, date: '2026-10-16' }));
  assert.deepEqual(p.trades.map((t) => [t.side, t.symbol, t.quantity, t.pricePaise, t.date]), [
    ['buy', 'V', 1, 3000000, '2026-10-15'],
    ['sell', 'V', 1, 3100000, '2026-10-16'],
  ]);
});

test('Sahil\'s check, times ten: 200 random trades, cash + holdings always equals total', () => {
  // A tiny seeded random generator, so if this ever fails it fails the same way twice.
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const symbols = ['AAPL', 'KO', 'SPY', 'NVDA', 'INDA'];
  const prices = Object.fromEntries(symbols.map((s) => [s, 100000 + Math.floor(rand() * 6000000)]));

  let p = newPortfolio();
  let accepted = 0;
  for (let i = 0; i < 200; i++) {
    const owned = Object.keys(p.holdings);
    const selling = owned.length > 0 && rand() < 0.4;
    // Sells mostly pick something you own, and sometimes "sell all" or a bit too much.
    const symbol = selling && rand() < 0.9 ? owned[Math.floor(rand() * owned.length)] : symbols[Math.floor(rand() * symbols.length)];
    const held = p.holdings[symbol]?.quantity ?? 0;
    const quantity = selling
      ? (rand() < 0.2 ? held : Math.round(rand() * held * 1.1 * 1000) / 1000)
      : Math.round(rand() * 0.8 * 1000) / 1000;
    const order = { symbol, quantity, pricePaise: prices[symbol], date: day };
    const result = selling ? sell(p, order) : buy(p, order);
    if (result.ok) { p = result.portfolio; accepted++; }

    const v = value(p, prices);
    const holdingsAddUp = v.rows.reduce((s, r) => s + r.valuePaise, 0);
    assert.equal(v.totalPaise, v.cashPaise + holdingsAddUp, `after trade ${i}`);
    assert.ok(p.cashPaise >= 0, `cash went negative after trade ${i}`);
    assert.ok(Object.values(p.holdings).every((h) => h.quantity > 0), `zero or negative holding after trade ${i}`);
    assert.ok(isPortfolio(JSON.parse(JSON.stringify(p))), `did not survive saving after trade ${i}`);
  }
  assert.ok(accepted > 120, `only ${accepted} trades went through, the test is too weak`);
  assert.equal(p.trades.length, accepted);
});

test('a damaged saved copy is spotted instead of loaded', () => {
  assert.equal(isPortfolio(null), false);
  assert.equal(isPortfolio({ cashPaise: 'lots', holdings: {}, trades: [] }), false);
  assert.equal(isPortfolio({ cashPaise: -1, holdings: {}, trades: [] }), false);
  assert.equal(isPortfolio(newPortfolio()), true);
});
