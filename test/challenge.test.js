import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SCENARIOS, weekNumber, weekStartDate, nextReset, scenarioForWeek, playChallenge,
} from '../lib/challenge.js';

const row = (date, close) => ({ date, close });

// Made-up prices. SPY falls 100 -> 80 over the patch, so the market loses 20%.
const history = {
  prices: {
    SPY: [row('2020-01-01', 100), row('2020-02-01', 90), row('2020-03-01', 80)],
    SAFE: [row('2020-01-01', 50), row('2020-02-01', 50), row('2020-03-01', 50)], // never moves
    BAD: [row('2020-01-01', 100), row('2020-02-01', 50), row('2020-03-01', 40)], // loses 60%
    LATE: [row('2020-02-01', 10), row('2020-03-01', 10)],
  },
};
const patch = { id: 't', start: '2020-01', end: '2020-03', name: 'Test patch' };

test('weeks: Monday 5 Jan 2026 00:00 India time starts week 0', () => {
  // 00:00 IST Monday = 18:30 UTC the Sunday before.
  assert.equal(weekNumber(new Date('2026-01-04T18:30:00Z')), 0);
  assert.equal(weekNumber(new Date('2026-01-04T18:29:59Z')), -1);
  assert.equal(weekStartDate(0), '2026-01-05');
});

test('weeks: the number holds all week, then moves on at Monday 00:00 India time', () => {
  assert.equal(weekNumber(new Date('2026-01-05T00:00:00Z')), 0);
  assert.equal(weekNumber(new Date('2026-01-11T18:29:59Z')), 0); // Sunday 23:59 IST
  assert.equal(weekNumber(new Date('2026-01-11T18:30:00Z')), 1); // Monday 00:00 IST
});

test('weeks: 22 Nov 2026 (a Sunday) is week 45, which started Monday 16 Nov', () => {
  const week = weekNumber(new Date('2026-11-22T10:00:00Z'));
  assert.equal(week, 45);
  assert.equal(weekStartDate(week), '2026-11-16');
  assert.equal(nextReset(week).toISOString(), '2026-11-22T18:30:00.000Z');
});

test('the scenario depends only on the week number', () => {
  for (let week = -3; week < 40; week++) {
    assert.deepEqual(scenarioForWeek(week), scenarioForWeek(week));
  }
});

test('every scenario is used once before any comes back', () => {
  for (const round of [0, 1, 7]) {
    const week0 = round * SCENARIOS.length;
    const ids = Array.from({ length: SCENARIOS.length }, (_, i) => scenarioForWeek(week0 + i).id);
    assert.equal(new Set(ids).size, SCENARIOS.length);
  }
});

test('every scenario is a real fall in the real SPY history', () => {
  const real = JSON.parse(fs.readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));
  for (const s of SCENARIOS) {
    const spy = real.prices.SPY;
    const a = spy.find((r) => r.date === `${s.start}-01`);
    const b = spy.find((r) => r.date === `${s.end}-01`);
    assert.ok(a && b, `${s.id}: missing SPY month`);
    assert.ok(b.close / a.close - 1 <= -0.08, `${s.id}: SPY did not fall by 8%`);
  }
});

test('all cash: you stay flat and beat a falling market', () => {
  const r = playChallenge(history, patch, {});
  assert.equal(r.cash, 10000);
  assert.equal(r.yours.endValue, 10000);
  assert.equal(r.yours.totalReturnPct, 0);
  assert.ok(Math.abs(r.market.totalReturnPct - -20) < 1e-9);
  assert.equal(r.survived, true);
});

test('shares cost money and the rest stays as cash', () => {
  const r = playChallenge(history, patch, { SAFE: 100 }); // 100 x 50 = 5,000
  assert.equal(r.cost, 5000);
  assert.equal(r.cash, 5000);
  assert.equal(r.yours.endValue, 10000);
});

test('a bad pick loses more than the market and does not survive', () => {
  const r = playChallenge(history, patch, { BAD: 100 }); // 10,000 -> 4,000
  assert.equal(r.yours.endValue, 4000);
  assert.ok(Math.abs(r.yours.totalReturnPct - -60) < 1e-9);
  assert.ok(Math.abs(r.yours.worstDropPct - 60) < 1e-9);
  assert.equal(r.survived, false);
});

test('market worst drop is measured from the peak', () => {
  const r = playChallenge(history, patch, {});
  assert.ok(Math.abs(r.market.worstDropPct - 20) < 1e-9);
});

test('refuses to spend more than you have', () => {
  assert.throws(() => playChallenge(history, patch, { SAFE: 201 }), /only have/);
});

test('refuses part shares, zero or negative shares', () => {
  assert.throws(() => playChallenge(history, patch, { SAFE: 1.5 }), /whole number/);
  assert.throws(() => playChallenge(history, patch, { SAFE: 0 }), /whole number/);
  assert.throws(() => playChallenge(history, patch, { SAFE: -2 }), /whole number/);
});

test('refuses a stock that has no price at the start of the patch', () => {
  assert.throws(() => playChallenge(history, patch, { LATE: 1 }), /do not have prices/);
});
