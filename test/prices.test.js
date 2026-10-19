import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pricesInPaise } from '../lib/prices.js';
import { SYMBOLS } from '../lib/universe.js';

test('a $10 share at 95 rupees to the dollar costs 950 rupees', () => {
  const stocks = { prices: { KO: { history: [{ date: '2026-10-16', close: 10 }, { date: '2026-10-15', close: 9 }] } } };
  const forex = { rates: { USD: { inr: 95 } } };
  assert.deepEqual(pricesInPaise(stocks, forex), { KO: 95000 });
});

test('missing prices or rates are left out, not turned into zero', () => {
  const stocks = { prices: { KO: { history: [] }, AAPL: { history: [{ close: 300 }] } } };
  assert.deepEqual(pricesInPaise(stocks, { rates: {} }), {});
  assert.deepEqual(pricesInPaise(stocks, null), {});
});

test('the real data files give a rupee price for all 20 instruments', () => {
  const stocks = JSON.parse(readFileSync(new URL('../data/stocks.json', import.meta.url)));
  const forex = JSON.parse(readFileSync(new URL('../data/forex.json', import.meta.url)));
  const prices = pricesInPaise(stocks, forex);
  assert.deepEqual(Object.keys(prices).sort(), [...SYMBOLS].sort());
  assert.ok(Object.values(prices).every((p) => Number.isInteger(p) && p > 0));
});
