import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPortfolio, buy, sell, value, isPortfolio, maxBuyPaise, STARTING_CASH_PAISE } from '../lib/portfolio.js';

const day = '2026-10-16';
const ok = (result) => {
  assert.equal(result.ok, true, result.reason);
  return result.portfolio;
};

test('every learner starts with 10,00,000 rupees and nothing else', () => {
  const p = newPortfolio();
  assert.equal(p.cashPaise, 100000000);
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
  const start = { cashPaise: 5000000, holdings: {}, trades: [] }; // ₹50,000 left
  const result = buy(start, { symbol: 'SPY', quantity: 1, pricePaise: 7200000, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /No borrowing/);
  assert.equal(start.cashPaise, 5000000); // nothing changed
});

test('edge case: spending exactly all your cash is allowed', () => {
  // ₹1,000 cash plus 3 KO worth ₹19,500: a ₹1,000 buy is well under a quarter.
  const start = { cashPaise: 100000, holdings: { KO: { quantity: 3, costPaise: 1950000 } }, trades: [] };
  const p = ok(buy(start, { symbol: 'NKE', quantity: 1, pricePaise: 100000, date: day }, { KO: 650000 }));
  assert.equal(p.cashPaise, 0);
});

// Arjun's check
test('if I buy 2.5 KO it says whole shares only', () => {
  const result = buy(newPortfolio(), { symbol: 'KO', quantity: 2.5, pricePaise: 650000, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Whole shares only/);
});

// Claude's check
test('selling part of a share is refused too', () => {
  const p = ok(buy(newPortfolio(), { symbol: 'KO', quantity: 3, pricePaise: 650000, date: day }));
  const result = sell(p, { symbol: 'KO', quantity: 1.5, pricePaise: 650000, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Whole shares only/);
});

// Claude's check
test('one buy can be exactly a quarter of your total, but not a paisa more', () => {
  const quarter = STARTING_CASH_PAISE / 4; // ₹2,50,000
  assert.equal(maxBuyPaise(STARTING_CASH_PAISE), quarter);
  ok(buy(newPortfolio(), { symbol: 'SPY', quantity: 1, pricePaise: quarter, date: day }));
  const result = buy(newPortfolio(), { symbol: 'SPY', quantity: 1, pricePaise: quarter + 1, date: day });
  assert.equal(result.ok, false);
  assert.match(result.reason, /at most a quarter of your total/);
});

test('the quarter is of your total today, so it grows when your shares do', () => {
  // ₹1,00,000 cash plus 10 NVDA bought at ₹10,000 that are now worth ₹30,000 each.
  const start = { cashPaise: 10000000, holdings: { NVDA: { quantity: 10, costPaise: 10000000 } }, trades: [] };
  const order = { symbol: 'KO', quantity: 10, pricePaise: 900000, date: day }; // ₹90,000
  assert.equal(buy(start, order, { NVDA: 1000000 }).ok, false); // total ₹2,00,000, cap ₹50,000
  ok(buy(start, order, { NVDA: 3000000 })); // total ₹4,00,000, cap ₹1,00,000
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
  for (const quantity of [0, -5, NaN, Infinity, 0.000000001, '3']) {
    assert.equal(buy(newPortfolio(), { symbol: 'KO', quantity, pricePaise: 650000, date: day }).ok, false, `qty ${quantity}`);
  }
  assert.equal(buy(newPortfolio(), { symbol: 'KO', quantity: 1, pricePaise: undefined, date: day }).ok, false);
});

test('selling everything removes the holding completely', () => {
  let p = ok(buy(newPortfolio(), { symbol: 'DIS', quantity: 3, pricePaise: 1000000, date: day }));
  p = ok(buy(p, { symbol: 'DIS', quantity: 6, pricePaise: 1000000, date: day }));
  p = ok(sell(p, { symbol: 'DIS', quantity: 9, pricePaise: 1000000, date: day }));
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
      ? (rand() < 0.2 ? held : Math.round(rand() * held * 1.1))
      : 1 + Math.floor(rand() * 4);
    const order = { symbol, quantity, pricePaise: prices[symbol], date: day };
    const result = selling ? sell(p, order) : buy(p, order, prices);
    if (result.ok) { p = result.portfolio; accepted++; }

    const v = value(p, prices);
    const holdingsAddUp = v.rows.reduce((s, r) => s + r.valuePaise, 0);
    assert.equal(v.totalPaise, v.cashPaise + holdingsAddUp, `after trade ${i}`);
    assert.ok(p.cashPaise >= 0, `cash went negative after trade ${i}`);
    assert.ok(Object.values(p.holdings).every((h) => Number.isInteger(h.quantity) && h.quantity > 0), `bad holding after trade ${i}`);
    assert.ok(isPortfolio(JSON.parse(JSON.stringify(p))), `did not survive saving after trade ${i}`);
  }
  assert.ok(accepted > 120, `only ${accepted} trades went through, the test is too weak`);
  assert.equal(p.trades.length, accepted);
});

test('a damaged saved copy is spotted instead of loaded', () => {
  assert.equal(isPortfolio(null), false);
  assert.equal(isPortfolio({ cashPaise: 'lots', holdings: {}, trades: [] }), false);
  assert.equal(isPortfolio({ cashPaise: -1, holdings: {}, trades: [] }), false);
  assert.equal(isPortfolio({ cashPaise: 0, holdings: { KO: { quantity: 0.5, costPaise: 325000 } }, trades: [] }), false); // old part-share save
  assert.equal(isPortfolio(newPortfolio()), true);
});

test('a buy costs exactly shares times price, to the paisa', () => {
  const pricePaise = 3261493; // about ₹32,615 a share
  const p = ok(buy(newPortfolio(), { symbol: 'AAPL', quantity: 7, pricePaise, date: day }));
  assert.equal(p.trades[0].totalPaise, 7 * pricePaise);
  assert.equal(value(p, { AAPL: pricePaise }).totalPaise, STARTING_CASH_PAISE);
});
