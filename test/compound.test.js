import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, costOfWaiting, monthlyRate, toMoney } from '../lib/compound.js';

test('the plan check: 1,000 at 8% a year for 10 years is 2,158.92', () => {
  const { finalValue } = project({
    startingAmount: 1000,
    monthlyTopUp: 0,
    yearlyReturn: 0.08,
    years: 10,
  });

  assert.equal(toMoney(finalValue), 2158.92);
});

test('monthly top-ups match the textbook annuity formula', () => {
  const monthlyTopUp = 100;
  const yearlyReturn = 0.08;
  const years = 10;

  const { finalValue } = project({ startingAmount: 0, monthlyTopUp, yearlyReturn, years });

  // Worked out a completely different way, so a bug in the loop can't hide here.
  const rate = monthlyRate(yearlyReturn);
  const months = years * 12;
  const expected = monthlyTopUp * ((Math.pow(1 + rate, months) - 1) / rate);

  assert.ok(Math.abs(finalValue - expected) < 0.000001, `${finalValue} vs ${expected}`);
});

test('with no return, you only ever get back what you put in', () => {
  const { finalValue, totalContributed, totalGrowth } = project({
    startingAmount: 1000,
    monthlyTopUp: 50,
    yearlyReturn: 0,
    years: 5,
  });

  assert.equal(toMoney(finalValue), 4000); // 1000 + (50 x 12 x 5)
  assert.equal(toMoney(totalContributed), 4000);
  assert.equal(toMoney(totalGrowth), 0);
});

test('starting 5 years late on a 10-year run is the same as a 5-year run, and it costs you', () => {
  const options = { startingAmount: 1000, monthlyTopUp: 100, yearlyReturn: 0.08, years: 10 };
  const waiting = costOfWaiting(options, 5);

  const fiveYearRun = project({ ...options, years: 5 });

  assert.equal(toMoney(waiting.delayed.finalValue), toMoney(fiveYearRun.finalValue));
  assert.ok(waiting.difference > 0, 'waiting should always cost something');
  assert.ok(waiting.percentLost > 0 && waiting.percentLost < 100);
});

test('the yearly series has one row per year plus the starting line', () => {
  const { yearly, finalValue } = project({
    startingAmount: 500,
    monthlyTopUp: 25,
    yearlyReturn: 0.07,
    years: 12,
  });

  assert.equal(yearly.length, 13); // year 0 through year 12
  assert.equal(yearly[0].value, 500);
  assert.equal(yearly[0].growth, 0);
  assert.equal(yearly.at(-1).year, 12);
  assert.equal(yearly.at(-1).value, finalValue);

  // Money invested in a rising market should never go down year on year.
  for (let i = 1; i < yearly.length; i++) {
    assert.ok(yearly[i].value > yearly[i - 1].value);
  }
});
