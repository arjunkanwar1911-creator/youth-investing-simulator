// The maths of money. No page code in here on purpose — this file knows nothing about
// buttons or charts, so it can be tested on its own from the terminal.

/**
 * Turn a yearly return into the monthly rate that compounds to exactly that much
 * over 12 months. 8% a year becomes about 0.6434% a month, NOT 8/12 = 0.667%,
 * because each month's growth also grows.
 */
export function monthlyRate(yearlyReturn) {
  return Math.pow(1 + yearlyReturn, 1 / 12) - 1;
}

/**
 * Project an investment month by month.
 *
 * @param {object} options
 * @param {number} options.startingAmount  what you put in on day one
 * @param {number} options.monthlyTopUp    what you add at the end of every month
 * @param {number} options.yearlyReturn    as a decimal, so 0.08 means 8% a year
 * @param {number} options.years           how long you stay invested
 * @returns {{finalValue:number, totalContributed:number, totalGrowth:number,
 *            yearly:Array<{year:number, value:number, contributed:number, growth:number}>}}
 */
export function project({ startingAmount = 0, monthlyTopUp = 0, yearlyReturn = 0, years = 0 }) {
  const rate = monthlyRate(yearlyReturn);
  const months = Math.round(years * 12);

  let balance = startingAmount;
  let contributed = startingAmount;

  // Year 0 is the starting line: nothing has grown yet.
  const yearly = [{ year: 0, value: balance, contributed, growth: 0 }];

  for (let month = 1; month <= months; month++) {
    balance = balance * (1 + rate) + monthlyTopUp;
    contributed += monthlyTopUp;

    if (month % 12 === 0) {
      yearly.push({
        year: month / 12,
        value: balance,
        contributed,
        growth: balance - contributed,
      });
    }
  }

  return {
    finalValue: balance,
    totalContributed: contributed,
    totalGrowth: balance - contributed,
    yearly,
  };
}

/**
 * What waiting costs. Both people stop on the same day; one just started later,
 * so they get fewer years of compounding on the same habit.
 *
 * @param {object} options  the same options as project()
 * @param {number} delayYears  how many years late the second person starts
 */
export function costOfWaiting(options, delayYears = 5) {
  const onTime = project(options);
  const yearsLeft = Math.max(0, options.years - delayYears);
  const delayed = project({ ...options, years: yearsLeft });

  const difference = onTime.finalValue - delayed.finalValue;

  return {
    onTime,
    delayed,
    delayYears,
    difference,
    // How much of the on-time pot you'd be giving up, as a percentage.
    percentLost: onTime.finalValue === 0 ? 0 : (difference / onTime.finalValue) * 100,
  };
}

/** Round to paise, the way money is actually quoted. */
export function toMoney(value) {
  return Math.round(value * 100) / 100;
}
