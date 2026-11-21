import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeMachine } from '../lib/timemachine.js';

// Made-up, round prices so every answer can be checked by hand.
// Same shape as data/history.json.
const row = (date, close) => ({ date, close });

const history = {
  prices: {
    // Doubles: 100 -> 200 in 12 months.
    DOUBLE: [row('2020-01-31', 100), row('2020-07-31', 150), row('2021-01-31', 200)],
    // Goes nowhere.
    FLAT: [row('2020-01-31', 50), row('2020-07-31', 50), row('2021-01-31', 50)],
    // 100 -> 60 -> 100: a 40% drop, then fully recovers.
    DIP: [row('2020-01-31', 100), row('2020-07-31', 60), row('2021-01-31', 100)],
    // Starts later than the others.
    LATE: [row('2020-07-31', 10), row('2021-01-31', 20)],
    // Rises, falls, rises: the worst drop is from the peak, not from the start.
    BUMPY: [
      row('2020-01-31', 100), row('2020-04-30', 200), row('2020-07-31', 150),
      row('2020-10-31', 300), row('2021-01-31', 240),
    ],
  },
};

const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} expected ${expected}, got ${actual}`);

test('one stock that doubles: +100% in a year', () => {
  const r = timeMachine(history, { DOUBLE: 1 }, 1000, '2020-01-01');
  close(r.startValue, 1000);
  close(r.endValue, 2000);
  close(r.totalReturnPct, 100);
  close(r.yearlyReturnPct, 100); // exactly 12 months
  close(r.worstDropPct, 0);
  assert.deepEqual(r.values.map((v) => v.date), ['2020-01-31', '2020-07-31', '2021-01-31']);
  assert.deepEqual(r.values.map((v) => Math.round(v.value)), [1000, 1500, 2000]);
});

test('a 50/50 mix of a doubler and a flat stock grows 50%', () => {
  // 500 in DOUBLE becomes 1000. 500 in FLAT stays 500. Total 1500.
  const r = timeMachine(history, { DOUBLE: 0.5, FLAT: 0.5 }, 1000, '2020-01-01');
  close(r.startValue, 1000);
  close(r.endValue, 1500);
  close(r.totalReturnPct, 50);
  close(r.worstDropPct, 0);
});

test('a drop from 100 to 60 and back to 100 is a 40% worst drop', () => {
  const r = timeMachine(history, { DIP: 1 }, 1000, '2020-01-01');
  close(r.worstDropPct, 40);
  close(r.totalReturnPct, 0);
  close(r.endValue, 1000);
  assert.deepEqual(r.values.map((v) => Math.round(v.value)), [1000, 600, 1000]);
});

test('worst drop is measured from the highest peak so far, not from the start', () => {
  // Values: 1000, 2000, 1500, 3000, 2400.
  // Falls: 2000 -> 1500 is 25%. 3000 -> 2400 is 20%. Worst is 25%.
  const r = timeMachine(history, { BUMPY: 1 }, 1000, '2020-01-01');
  close(r.worstDropPct, 25);
  close(r.endValue, 2400);
  close(r.totalReturnPct, 140);
});

test('buys at the first month on or after the start date', () => {
  // Starting 2020-03-01 skips 2020-01-31, so we buy at 150, not 100.
  const r = timeMachine(history, { DOUBLE: 1 }, 1500, '2020-03-01');
  assert.equal(r.values[0].date, '2020-07-31');
  close(r.startValue, 1500);
  close(r.endValue, 2000);
  close(r.totalReturnPct, (200 / 150 - 1) * 100);

  // A start date that is exactly a month-end buys that very month.
  assert.equal(timeMachine(history, { DOUBLE: 1 }, 1000, '2020-01-31').values[0].date, '2020-01-31');
});

test('with a holding that starts late, we buy when every holding has a price', () => {
  const r = timeMachine(history, { DOUBLE: 0.5, LATE: 0.5 }, 1000, '2020-01-01');
  assert.equal(r.values[0].date, '2020-07-31');
  // 500 buys 500/150 of DOUBLE and 50 of LATE. At 2021-01-31: 500/150*200 + 50*20.
  close(r.endValue, (500 / 150) * 200 + 50 * 20);
});

test('yearly return compounds: doubling over 24 months is about 41.4% a year', () => {
  const twoYears = { prices: { X: [row('2020-01-31', 100), row('2022-01-31', 200)] } };
  const r = timeMachine(twoYears, { X: 1 }, 1000, '2020-01-01');
  close(r.totalReturnPct, 100);
  close(r.yearlyReturnPct, (Math.SQRT2 - 1) * 100);
});

test('only one month of data: no yearly return to report', () => {
  const r = timeMachine(history, { DOUBLE: 1 }, 1000, '2021-01-01');
  assert.equal(r.values.length, 1);
  assert.equal(r.yearlyReturnPct, null);
  close(r.totalReturnPct, 0);
});

test('weights that do not add up to 1 throw a clear error', () => {
  assert.throws(
    () => timeMachine(history, { DOUBLE: 0.5, FLAT: 0.4 }, 1000, '2020-01-01'),
    /must add up to 1.*0\.9/,
  );
  assert.throws(
    () => timeMachine(history, { DOUBLE: 0.7, FLAT: 0.7 }, 1000, '2020-01-01'),
    /must add up to 1/,
  );
  // Thirds are fine even though 1/3 is not exact in a computer.
  assert.doesNotThrow(() =>
    timeMachine(history, { DOUBLE: 1 / 3, FLAT: 1 / 3, DIP: 1 / 3 }, 900, '2020-01-01'));
});

test('bad input throws instead of giving nonsense', () => {
  assert.throws(() => timeMachine(history, {}, 1000, '2020-01-01'), /mix is empty/);
  assert.throws(() => timeMachine(history, { DOUBLE: 1.5, FLAT: -0.5 }, 1000, '2020-01-01'), /above 0/);
  assert.throws(() => timeMachine(history, { NOPE: 1 }, 1000, '2020-01-01'), /no price history for NOPE/);
  assert.throws(() => timeMachine(history, { DOUBLE: 1 }, 0, '2020-01-01'), /amount/);
  assert.throws(() => timeMachine(history, { DOUBLE: 1 }, 1000, 'last year'), /start date/);
  assert.throws(() => timeMachine(history, { DOUBLE: 1 }, 1000, '2030-01-01'), /No month on or after/);
});
