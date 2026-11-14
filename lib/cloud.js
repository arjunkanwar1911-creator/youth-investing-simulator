// Saving and loading a learner's portfolio in Supabase.
//
// Like portfolio.js, this knows nothing about the page. It is handed a Supabase
// `client` (the real one in the browser, a pretend one in the tests), so the tests
// can run with no internet.
//
// Two tables (see supabase/m8.sql): `portfolios` holds cash and holdings, one row
// per learner; `trades` holds one row per trade, numbered 0, 1, 2 ... in order.
// Every query here also says `user_id = me`. The database lock (row level
// security) is the real protection; this is a second belt on the same trousers.

import { newPortfolio, isPortfolio } from './portfolio.js';

/** Turn a portfolio into the rows we store. Trades are numbered by their place in the history. */
export function toRows(userId, portfolio) {
  return {
    portfolioRow: { user_id: userId, cash_paise: portfolio.cashPaise, holdings: portfolio.holdings },
    tradeRows: portfolio.trades.map((t, n) => ({
      user_id: userId,
      n,
      side: t.side,
      symbol: t.symbol,
      quantity: t.quantity,
      price_paise: t.pricePaise,
      total_paise: t.totalPaise,
      price_date: t.date ?? null,
    })),
  };
}

/** Turn stored rows back into a portfolio. Throws if what came back looks damaged. */
export function fromRows(portfolioRow, tradeRows) {
  const portfolio = {
    cashPaise: portfolioRow.cash_paise,
    holdings: portfolioRow.holdings,
    trades: [...tradeRows]
      .sort((a, b) => a.n - b.n)
      .map((r) => ({
        side: r.side,
        symbol: r.symbol,
        quantity: r.quantity,
        pricePaise: r.price_paise,
        totalPaise: r.total_paise,
        date: r.price_date ?? null,
      })),
  };
  if (!isPortfolio(portfolio)) throw new Error('The saved portfolio in your account looks damaged.');
  return portfolio;
}

/** Throw if Supabase answered with an error, otherwise hand back the data. */
function unwrap({ data, error }) {
  if (error) throw new Error(error.message ?? String(error));
  return data;
}

/** The learner's portfolio from their account, or null if the account is empty. */
export async function loadCloudPortfolio(client, userId) {
  const row = unwrap(await client.from('portfolios')
    .select('cash_paise, holdings').eq('user_id', userId).maybeSingle());
  if (!row) return null;
  const trades = unwrap(await client.from('trades')
    .select('n, side, symbol, quantity, price_paise, total_paise, price_date')
    .eq('user_id', userId).order('n'));
  return fromRows(row, trades ?? []);
}

/**
 * Save the whole portfolio. `savedTrades` is how many trades the account already
 * holds, so only the new ones are sent. Returns the new count of saved trades.
 * Safe to repeat: a trade with the same number is never stored twice.
 */
export async function saveCloudPortfolio(client, userId, portfolio, savedTrades = 0) {
  const { portfolioRow, tradeRows } = toRows(userId, portfolio);

  let from = savedTrades;
  if (tradeRows.length < savedTrades) {
    // The history got shorter: the learner started again. Clear the old one first.
    unwrap(await client.from('trades').delete().eq('user_id', userId).gte('n', 0));
    from = 0;
  }

  const fresh = tradeRows.slice(from);
  if (fresh.length) {
    unwrap(await client.from('trades').upsert(fresh, { onConflict: 'user_id,n', ignoreDuplicates: true }));
  }
  unwrap(await client.from('portfolios')
    .upsert({ ...portfolioRow, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  return tradeRows.length;
}

/**
 * Just after sign in: which portfolio does this learner start with?
 *  - Their account already has one: use it. (It wins over the browser's copy.)
 *  - Their account is empty: copy the browser's portfolio up, so nothing is lost.
 * Returns { portfolio, savedTrades, copied }.
 */
export async function syncOnSignIn(client, userId, browserPortfolio) {
  const existing = await loadCloudPortfolio(client, userId);
  if (existing) return { portfolio: existing, savedTrades: existing.trades.length, copied: false };

  const start = isPortfolio(browserPortfolio) ? browserPortfolio : newPortfolio();
  const savedTrades = await saveCloudPortfolio(client, userId, start, 0);
  return { portfolio: start, savedTrades, copied: start.trades.length > 0 };
}
