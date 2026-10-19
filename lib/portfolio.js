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
// Simple rules on purpose: no borrowing, no short selling, no leverage.

export const STARTING_CASH_PAISE = 100000 * 100; // 1,00,000 rupees

// Shares can be fractional (0.25 of a share), rounded to 6 decimal places.
const QTY_DECIMALS = 1e6;
const roundQty = (q) => Math.round(q * QTY_DECIMALS) / QTY_DECIMALS;

export const toPaise = (rupees) => Math.round(rupees * 100);
export const toRupees = (paise) => paise / 100;

/** A brand new learner: all cash, nothing owned, no trades. */
export function newPortfolio() {
  return { cashPaise: STARTING_CASH_PAISE, holdings: {}, trades: [] };
}

/**
 * Buy `quantity` shares of `symbol` at `pricePaise` each.
 * Returns { ok: true, portfolio } or { ok: false, reason } with a sentence a
 * learner can read. The original portfolio is never changed.
 */
export function buy(portfolio, { symbol, quantity, pricePaise, date }) {
  const problem = checkOrder({ symbol, quantity, pricePaise });
  if (problem) return { ok: false, reason: problem };

  const qty = roundQty(quantity);
  const costPaise = Math.round(qty * pricePaise);

  if (costPaise > portfolio.cashPaise) {
    return {
      ok: false,
      reason: `That costs ₹${fmt(costPaise)} but you only have ₹${fmt(portfolio.cashPaise)}. ` +
        'No borrowing here: you can only spend money you have.',
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
          quantity: roundQty(held.quantity + qty),
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

  const qty = roundQty(quantity);
  const held = portfolio.holdings[symbol];

  if (!held) {
    return { ok: false, reason: `You don't own any ${symbol}, so there's nothing to sell. No short selling here.` };
  }
  if (qty > held.quantity) {
    return {
      ok: false,
      reason: `You only own ${held.quantity} ${symbol}, so you can't sell ${qty}. No short selling here.`,
    };
  }

  const proceedsPaise = Math.round(qty * pricePaise);
  const remaining = roundQty(held.quantity - qty);

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

/** Is this something we can save and load back safely? Used when reading the browser's copy. */
export function isPortfolio(p) {
  return !!p && Number.isInteger(p.cashPaise) && p.cashPaise >= 0 &&
    typeof p.holdings === 'object' && p.holdings !== null && Array.isArray(p.trades) &&
    Object.values(p.holdings).every((h) => h && h.quantity > 0 && Number.isInteger(h.costPaise));
}

function checkOrder({ symbol, quantity, pricePaise }) {
  if (typeof symbol !== 'string' || symbol === '') return 'Pick something to trade first.';
  if (!Number.isFinite(quantity) || roundQty(quantity) <= 0) return 'The number of shares has to be more than zero.';
  if (!Number.isFinite(pricePaise) || pricePaise <= 0) return `We don't have a price for ${symbol} yet.`;
  return null;
}

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (paise) => inr.format(paise / 100);
