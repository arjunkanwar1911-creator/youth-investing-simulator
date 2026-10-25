// The paper trading engine: cash, holdings and trade history.
//
// Like compound.js, this knows nothing about the page. Every function takes a
// portfolio and returns a NEW one, so nothing changes behind our back and the
// page can simply save whatever comes out.
//
// Money is kept in whole paise (1 rupee = 100 paise). Computers are bad at
// decimals: 0.1 + 0.2 is 0.30000000000000004. Whole numbers never drift, which
// is how "cash plus holdings always equals total value" stays true after
// hundreds of trades.
//
// Simple rules on purpose: no borrowing, no short selling, no leverage, whole
// shares only, and no single buy bigger than a quarter of everything you have.

export const STARTING_CASH_PAISE = 1000000 * 100; // 10,00,000 rupees

// One buy can be at most 1/4 of your total value. It slows down "all in on one
// stock" without banning it: you can still pile in, just one quarter at a time.
export const MAX_BUY_FRACTION = 1 / 4;

export const toPaise = (rupees) => Math.round(rupees * 100);
export const toRupees = (paise) => paise / 100;

/** A brand new learner: all cash, nothing owned, no trades. */
export function newPortfolio() {
  return { cashPaise: STARTING_CASH_PAISE, holdings: {}, trades: [] };
}

/**
 * Buy `quantity` whole shares of `symbol` at `pricePaise` each.
 * `pricesPaise` is today's price of everything you own, needed to work out your
 * total for the 25% rule.
 * Returns { ok: true, portfolio } or { ok: false, reason } with a sentence a
 * learner can read. The original portfolio is never changed.
 */
export function buy(portfolio, { symbol, quantity, pricePaise, date }, pricesPaise = {}) {
  const problem = checkOrder({ symbol, quantity, pricePaise });
  if (problem) return { ok: false, reason: problem };

  const qty = quantity;
  const costPaise = qty * pricePaise;

  if (costPaise > portfolio.cashPaise) {
    return {
      ok: false,
      reason: `That costs ₹${fmt(costPaise)} but you only have ₹${fmt(portfolio.cashPaise)}. ` +
        'No borrowing here: you can only spend money you have.',
    };
  }

  const { totalPaise } = value(portfolio, { ...pricesPaise, [symbol]: pricePaise });
  const capPaise = maxBuyPaise(totalPaise);
  if (costPaise > capPaise) {
    return {
      ok: false,
      reason: `That costs ₹${fmt(costPaise)}, but one buy can be at most a quarter of your total ` +
        `(₹${fmt(capPaise)} right now). Spreading out is the safer habit.`,
    };
  }

  const held = portfolio.holdings[symbol] ?? { quantity: 0, costPaise: 0 };
  return {
    ok: true,
    portfolio: {
      cashPaise: portfolio.cashPaise - costPaise,
      holdings: {
        ...portfolio.holdings,
        [symbol]: {
          quantity: held.quantity + qty,
          costPaise: held.costPaise + costPaise, // what you paid in total, for "am I up?"
        },
      },
      trades: [...portfolio.trades, { side: 'buy', symbol, quantity: qty, pricePaise, totalPaise: costPaise, date }],
    },
  };
}

/** Sell `quantity` shares you already own. Same return shape as buy(). */
export function sell(portfolio, { symbol, quantity, pricePaise, date }) {
  const problem = checkOrder({ symbol, quantity, pricePaise });
  if (problem) return { ok: false, reason: problem };

  const qty = quantity;
  const held = portfolio.holdings[symbol];

  if (!held) {
    return { ok: false, reason: `You don't own any ${symbol}, so there's nothing to sell. No short selling here.` };
  }
  if (qty > held.quantity) {
    return {
      ok: false,
      reason: `You only own ${fmtQty(held.quantity)} ${symbol}, so you can't sell ${fmtQty(qty)}. No short selling here.`,
    };
  }

  const proceedsPaise = qty * pricePaise;
  const remaining = held.quantity - qty;

  const holdings = { ...portfolio.holdings };
  if (remaining === 0) {
    delete holdings[symbol];
  } else {
    // Keep the average price paid the same for the shares you still hold.
    holdings[symbol] = {
      quantity: remaining,
      costPaise: Math.round(held.costPaise * (remaining / held.quantity)),
    };
  }

  return {
    ok: true,
    portfolio: {
      cashPaise: portfolio.cashPaise + proceedsPaise,
      holdings,
      trades: [...portfolio.trades, { side: 'sell', symbol, quantity: qty, pricePaise, totalPaise: proceedsPaise, date }],
    },
  };
}

/**
 * What everything is worth right now. `pricesPaise` maps symbol -> price.
 * total is always exactly cash + holdings: it is worked out that way, in paise.
 */
export function value(portfolio, pricesPaise) {
  const rows = Object.entries(portfolio.holdings).map(([symbol, h]) => {
    const price = pricesPaise[symbol];
    if (!Number.isFinite(price)) throw new Error(`No price for ${symbol}`);
    const valuePaise = Math.round(h.quantity * price);
    return { symbol, quantity: h.quantity, pricePaise: price, valuePaise, costPaise: h.costPaise, gainPaise: valuePaise - h.costPaise };
  });
  const holdingsPaise = rows.reduce((sum, r) => sum + r.valuePaise, 0);
  return { cashPaise: portfolio.cashPaise, holdingsPaise, totalPaise: portfolio.cashPaise + holdingsPaise, rows };
}

/** The most one buy can cost: a quarter of your total, rounded down to the paisa. */
export const maxBuyPaise = (totalPaise) => Math.floor(totalPaise * MAX_BUY_FRACTION);

/** Is this something we can save and load back safely? Used when reading the browser's copy. */
export function isPortfolio(p) {
  return !!p && Number.isInteger(p.cashPaise) && p.cashPaise >= 0 &&
    typeof p.holdings === 'object' && p.holdings !== null && Array.isArray(p.trades) &&
    Object.values(p.holdings).every((h) => h && Number.isInteger(h.quantity) && h.quantity > 0 && Number.isInteger(h.costPaise));
}

function checkOrder({ symbol, quantity, pricePaise }) {
  if (typeof symbol !== 'string' || symbol === '') return 'Pick something to trade first.';
  if (!Number.isFinite(quantity) || quantity <= 0) return 'The number of shares has to be more than zero.';
  if (!Number.isInteger(quantity)) {
    return `Whole shares only: try ${Math.max(1, Math.round(quantity))} ${symbol} instead of ${fmtQty(quantity)}.`;
  }
  if (!Number.isInteger(pricePaise) || pricePaise <= 0) return `We don't have a price for ${symbol} yet.`;
  return null;
}

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (paise) => inr.format(paise / 100);
const fmtQty = (q) => q.toLocaleString('en-IN', { maximumFractionDigits: 4 });
