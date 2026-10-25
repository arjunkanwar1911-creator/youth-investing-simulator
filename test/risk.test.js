import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocation } from '../lib/risk.js';
import { newPortfolio } from '../lib/portfolio.js';

// Round prices so the expected numbers are easy to check by hand.
const prices = { AAPL: 3000000, MSFT: 4000000, KO: 600000, SPY: 6000000, JNJ: 1500000 };
const holding = (quantity, pricePaise) => ({ quantity, costPaise: quantity * pricePaise });
const labels = (list) => list.map((g) => [g.label, Math.round(g.share * 100)]);

test('a fresh portfolio has nothing on the ring, and all 10 lakh as cash', () => {
  const a = allocation(newPortfolio(), prices);
  assert.deepEqual(a.kind, []);
  assert.deepEqual(a.sector, []);
  assert.deepEqual(a.currency, []);
  assert.equal(a.cashPaise, 100000000);
  assert.equal(a.investedPaise, 0);
});

test('cash is never a slice, only the money in shares is split', () => {
  // ₹3,00,000 Apple + ₹9,00,000 cash: the ring is 100% Apple, not 25%
  const p = { cashPaise: 90000000, holdings: { AAPL: holding(10, prices.AAPL) }, trades: [] };
  const a = allocation(p, prices);
  assert.deepEqual(labels(a.sector), [['Technology', 100]]);
  assert.equal(a.cashPaise, 90000000);
  assert.equal(a.investedPaise, 30000000);
});

test('if I own only Apple and no cash, it is 100% one company, tech, dollars', () => {
  const p = { cashPaise: 0, holdings: { AAPL: holding(10, prices.AAPL) }, trades: [] };
  const a = allocation(p, prices);
  assert.deepEqual(labels(a.kind), [['Single companies', 100]]);
  assert.deepEqual(labels(a.sector), [['Technology', 100]]);
  assert.deepEqual(labels(a.currency), [['USD', 100]]);
});

test('two tech stocks land in one Technology slice, not two', () => {
  // ₹3,00,000 Apple + ₹4,00,000 Microsoft + ₹3,00,000 Coca-Cola
  const p = { cashPaise: 30000000, holdings: { AAPL: holding(10, prices.AAPL), MSFT: holding(10, prices.MSFT), KO: holding(50, prices.KO) }, trades: [] };
  assert.deepEqual(labels(allocation(p, prices).sector), [['Technology', 70], ['Everyday needs', 30]]);
});

test('an index fund counts as an index fund, not a company', () => {
  // ₹6,00,000 S&P 500 + ₹1,50,000 Johnson & Johnson, plus cash that doesn't count
  const p = { cashPaise: 25000000, holdings: { SPY: holding(10, prices.SPY), JNJ: holding(10, prices.JNJ) }, trades: [] };
  const a = allocation(p, prices);
  assert.deepEqual(labels(a.kind), [['Index funds', 80], ['Single companies', 20]]);
  assert.deepEqual(labels(a.sector), [['Diversified', 80], ['Healthcare', 20]]);
});

test('the slices always add up to the money in shares, to the paisa', () => {
  const p = {
    cashPaise: 12345678,
    holdings: { AAPL: holding(3, prices.AAPL), KO: holding(7, prices.KO), SPY: holding(2, prices.SPY), JNJ: holding(5, prices.JNJ) },
    trades: [],
  };
  const a = allocation(p, prices);
  for (const split of ['kind', 'sector', 'currency']) {
    assert.equal(a[split].reduce((sum, g) => sum + g.paise, 0), a.investedPaise, split);
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
  const p = { cashPaise: 0, holdings: { SPY: holding(1, 21645500), AAPL: holding(1, 52770800), JNJ: holding(1, 25583700) }, trades: [] };
  const a = allocation(p, { SPY: 21645500, AAPL: 52770800, JNJ: 25583700 });
  // Round down to 52 + 25 + 21 = 98, then the 2 spare points go to the biggest
  // leftovers: .77 (Technology) and .65 (the fund), not .58 (Healthcare).
  assert.deepEqual(a.sector.map((g) => g.percent), [53, 25, 22]);
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

test('sectors follow the real world: Google is Internet & Media, Coca-Cola is Everyday needs', () => {
  const sectorOf = (symbol) => {
    const p = { cashPaise: 0, holdings: { [symbol]: holding(1, 100) }, trades: [] };
    return allocation(p, { [symbol]: 100 }).sector[0].label;
  };
  assert.equal(sectorOf('AAPL'), 'Technology');
  assert.equal(sectorOf('GOOGL'), 'Internet & Media');
  assert.equal(sectorOf('NFLX'), 'Internet & Media');
  assert.equal(sectorOf('TSLA'), 'Consumer');
  assert.equal(sectorOf('KO'), 'Everyday needs');
});

// ---- part 2: how much it moves ----
import { volatility } from '../lib/risk.js';
import { readFileSync } from 'node:fs';

const forex = { rates: { USD: { inr: 100 } } };
// Builds a price history from daily moves, e.g. [+0.01, -0.01] -> 100, 101, 99.99
const historyFrom = (moves, start = 100) => {
  const closes = [start];
  for (const m of moves) closes.push(closes.at(-1) * (1 + m));
  return closes.map((close, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, close })).reverse(); // newest first, like the real file
};
const own = (holdings) => ({ cashPaise: 0, holdings, trades: [] });

test('no shares means nothing to measure', () => {
  assert.equal(volatility(newPortfolio(), { prices: {} }, forex), null);
});

test('a price that never changes moves 0% a day and is Calm', () => {
  const v = volatility(own({ KO: holding(10, 10000) }), { prices: { KO: { history: historyFrom(Array(20).fill(0)) } } }, forex);
  assert.equal(v.dailyPercent, 0);
  assert.equal(v.dailyPaise, 0);
  assert.equal(v.level, 'Calm');
});

test('up 1%, down 1%, up 1%... is a normal day of exactly 1%', () => {
  const v = volatility(own({ KO: holding(10, 10000) }), { prices: { KO: { history: historyFrom(Array(10).fill([0.01, -0.01]).flat()) } } }, forex);
  assert.ok(Math.abs(v.dailyPercent - 1) < 1e-9, v.dailyPercent);
  assert.equal(v.level, 'Medium');
  assert.equal(v.days, 20);
});

test('the rupee amount is the normal-day percent of what your shares are worth today', () => {
  // Each up-down pair is ×1.01 ×0.99 = 0.9999, so after 10 pairs the price is $99.90.
  // 10 shares × $99.90 × ₹100 = ₹99,900, and 1% of that is ₹999.00.
  const v = volatility(own({ KO: holding(10, 10000) }), { prices: { KO: { history: historyFrom(Array(10).fill([0.01, -0.01]).flat()) } } }, forex);
  assert.equal(v.dailyPaise, 99900);
});

test('the worst day is the biggest fall, with its date', () => {
  const v = volatility(own({ KO: holding(1, 10000) }), { prices: { KO: { history: historyFrom([0.01, -0.05, 0.02, -0.01]) } } }, forex);
  assert.equal(v.worst.date, '2026-01-03');
  assert.ok(Math.abs(v.worst.percent + 5) < 1e-9);
  assert.ok(v.worst.paise < 0);
});

test('two shares that move opposite ways calm each other down', () => {
  const zig = Array(10).fill([0.02, -0.02]).flat();
  const zag = zig.map((m) => -m);
  const stocks = { prices: { AAPL: { history: historyFrom(zig) }, KO: { history: historyFrom(zag) } } };
  const alone = volatility(own({ AAPL: holding(10, 10000) }), stocks, forex).dailyPercent;
  const together = volatility(own({ AAPL: holding(10, 10000), KO: holding(10, 10000) }), stocks, forex).dailyPercent;
  assert.ok(together < alone / 4, `${together} should be much less than ${alone}`);
});

test('real prices: an S&P 500 fund is Calm, Tesla is Bumpy, and the answer never changes', () => {
  const real = JSON.parse(readFileSync(new URL('../data/stocks.json', import.meta.url)));
  const realForex = JSON.parse(readFileSync(new URL('../data/forex.json', import.meta.url)));
  const spy = volatility(own({ SPY: holding(1, 1) }), real, realForex);
  const tsla = volatility(own({ TSLA: holding(1, 1) }), real, realForex);
  assert.equal(spy.level, 'Calm');
  assert.equal(tsla.level, 'Bumpy');
  assert.deepEqual(volatility(own({ TSLA: holding(1, 1) }), real, realForex), tsla);
});

// ---- part 3: the diversification score ----
import { diversification } from '../lib/risk.js';

// Every share costs ₹1,000 here, so the number of shares is the weight.
const flat = new Proxy({}, { get: () => 100000 });
const shares = (map) => own(Object.fromEntries(Object.entries(map).map(([s, q]) => [s, holding(q, 100000)])));

test('nothing invested means no score yet', () => {
  assert.equal(diversification(newPortfolio(), flat), null);
});

test('Done when 1: one stock scores low', () => {
  const d = diversification(shares({ TSLA: 10 }), flat);
  assert.equal(d.score, 0);
  assert.equal(d.label, 'Not spread out');
  assert.match(d.nudge, /100% of what you've invested is in one company \(Tesla\)/);
});

test('Done when 2: five stocks in five sectors score in the middle', () => {
  const d = diversification(shares({ AAPL: 10, GOOGL: 10, KO: 10, JNJ: 10, V: 10 }), flat);
  // 5 equal pieces: 60 × 4/14 = 17.1. 5 sectors: the full 40. Total 57.
  assert.equal(d.score, 57);
  assert.equal(d.label, 'Getting there');
  assert.match(d.nudge, /index fund/);
});

test('Done when 3: a mix with an index fund scores high', () => {
  // Half in the S&P 500, the rest in four different sectors.
  const d = diversification(shares({ SPY: 40, AAPL: 10, KO: 10, JNJ: 10, V: 10 }), flat);
  assert.ok(d.score >= 75 && d.score <= 100, d.score);
  assert.equal(d.label, 'Well spread');
  assert.match(d.nudge, /Nicely spread out/);
});

test('Done when: the same portfolio gets the same score every time', () => {
  for (const p of [shares({ TSLA: 10 }), shares({ AAPL: 10, GOOGL: 10, KO: 10, JNJ: 10, V: 10 }), shares({ SPY: 40, AAPL: 10, KO: 10, JNJ: 10, V: 10 })]) {
    const first = diversification(p, flat);
    for (let i = 0; i < 50; i++) assert.deepEqual(diversification(p, flat), first);
  }
});

test('five stocks all in one sector score lower than five in different sectors', () => {
  const sameSector = diversification(shares({ AMZN: 10, TSLA: 10, NKE: 10, SBUX: 10, MCD: 10 }), flat);
  const spread = diversification(shares({ AAPL: 10, GOOGL: 10, KO: 10, JNJ: 10, V: 10 }), flat);
  assert.ok(sameSector.score < spread.score, `${sameSector.score} vs ${spread.score}`);
  assert.match(sameSector.nudge, /100% of what you've invested is in Consumer/);
});

test('one big stock and four tiny ones is not really spread out', () => {
  const d = diversification(shares({ TSLA: 70, AAPL: 5, KO: 5, JNJ: 10, V: 10 }), flat);
  assert.ok(d.score < 40, d.score);
  assert.match(d.nudge, /^70% of what you've invested is in one company \(Tesla\)/);
});

test('cash does not change the score', () => {
  const p = shares({ AAPL: 10, KO: 10 });
  assert.deepEqual(diversification({ ...p, cashPaise: 90000000 }, flat), diversification(p, flat));
});

test('the score is always a whole number from 0 to 100', () => {
  let seed = 11;
  const rand = (n) => (seed = (seed * 16807) % 2147483647) % n;
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'KO', 'JNJ', 'V', 'SPY', 'QQQ', 'INDA'];
  for (let i = 0; i < 300; i++) {
    const map = {};
    for (const s of symbols) if (rand(3) === 0) map[s] = 1 + rand(30);
    if (!Object.keys(map).length) continue;
    const { score } = diversification(shares(map), flat);
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, String(score));
  }
});
