import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocation } from '../lib/risk.js';
import { newPortfolio } from '../lib/portfolio.js';

// Round prices so the expected numbers are easy to check by hand.
const prices = { AAPL: 3000000, MSFT: 4000000, KO: 600000, SPY: 6000000, JNJ: 1500000 };
const holding = (quantity, pricePaise) => ({ quantity, costPaise: quantity * pricePaise });
const labels = (list) => list.map((g) => [g.label, Math.round(g.share * 100)]);

test('a fresh portfolio is 100% cash, in rupees', () => {
  const a = allocation(newPortfolio(), prices);
  assert.deepEqual(labels(a.kind), [['Cash', 100]]);
  assert.deepEqual(labels(a.sector), [['Cash', 100]]);
  assert.deepEqual(labels(a.currency), [['INR', 100]]);
});

test('if I own only Apple and no cash, it is 100% one company, tech, dollars', () => {
  const p = { cashPaise: 0, holdings: { AAPL: holding(10, prices.AAPL) }, trades: [] };
  const a = allocation(p, prices);
  assert.deepEqual(labels(a.kind), [['Single companies', 100]]);
  assert.deepEqual(labels(a.sector), [['Technology', 100]]);
  assert.deepEqual(labels(a.currency), [['USD', 100]]);
});

test('two tech stocks land in one Technology slice, not two', () => {
  // ₹3,00,000 Apple + ₹4,00,000 Microsoft + ₹3,00,000 cash
  const p = { cashPaise: 30000000, holdings: { AAPL: holding(10, prices.AAPL), MSFT: holding(10, prices.MSFT) }, trades: [] };
  assert.deepEqual(labels(allocation(p, prices).sector), [['Technology', 70], ['Cash', 30]]);
});

test('an index fund counts as an index fund, not a company', () => {
  // ₹6,00,000 S&P 500 + ₹1,50,000 Johnson & Johnson + ₹2,50,000 cash
  const p = { cashPaise: 25000000, holdings: { SPY: holding(10, prices.SPY), JNJ: holding(10, prices.JNJ) }, trades: [] };
  const a = allocation(p, prices);
  assert.deepEqual(labels(a.kind), [['Index funds', 60], ['Cash', 25], ['Single companies', 15]]);
  assert.deepEqual(labels(a.sector), [['Diversified', 60], ['Cash', 25], ['Healthcare', 15]]);
});

test('the slices always add up to the whole portfolio, to the paisa', () => {
  const p = {
    cashPaise: 12345678,
    holdings: { AAPL: holding(3, prices.AAPL), KO: holding(7, prices.KO), SPY: holding(2, prices.SPY), JNJ: holding(5, prices.JNJ) },
    trades: [],
  };
  const a = allocation(p, prices);
  for (const split of ['kind', 'sector', 'currency']) {
    assert.equal(a[split].reduce((sum, g) => sum + g.paise, 0), a.totalPaise, split);
    assert.ok(Math.abs(a[split].reduce((sum, g) => sum + g.share, 0) - 1) < 1e-12, split);
  }
});

test('the same portfolio always gives the same split, biggest slice first', () => {
  const p = { cashPaise: 1000000, holdings: { KO: holding(10, prices.KO), AAPL: holding(1, prices.AAPL) }, trades: [] };
  const first = allocation(p, prices);
  assert.deepEqual(allocation(p, prices), first);
  const sizes = first.sector.map((g) => g.paise);
  assert.deepEqual(sizes, [...sizes].sort((x, y) => y - x));
});

test('the whole-number percents always add up to exactly 100', () => {
  // Found in the browser: 52.8% + 25.6% + 21.6% each rounded up to 53 + 26 + 22 = 101.
  const p = { cashPaise: 25583700, holdings: { SPY: holding(1, 21645500), AAPL: holding(1, 52770800) }, trades: [] };
  const a = allocation(p, { SPY: 21645500, AAPL: 52770800 });
  // Round down to 52 + 25 + 21 = 98, then the 2 spare points go to the biggest
  // leftovers: .77 (Apple) and .65 (the fund), not .58 (cash).
  assert.deepEqual(a.kind.map((g) => g.percent), [53, 25, 22]);
  // and for 200 random portfolios, every split
  let seed = 7;
  const rand = (n) => (seed = (seed * 16807) % 2147483647) % n;
  for (let i = 0; i < 200; i++) {
    const r = { cashPaise: rand(5e7), holdings: { AAPL: holding(1 + rand(20), prices.AAPL), KO: holding(1 + rand(50), prices.KO), SPY: holding(1 + rand(9), prices.SPY) }, trades: [] };
    for (const split of ['kind', 'sector', 'currency']) {
      assert.equal(allocation(r, prices)[split].reduce((s, g) => s + g.percent, 0), 100);
    }
  }
});
