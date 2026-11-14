import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPortfolio, buy, sell } from '../lib/portfolio.js';
import { toRows, fromRows, loadCloudPortfolio, saveCloudPortfolio, syncOnSignIn } from '../lib/cloud.js';

// A pretend Supabase: two tables in memory, and just enough of the real API
// (from, select, eq, gte, order, maybeSingle, delete, upsert) for cloud.js.
function fakeClient({ failOn } = {}) {
  const db = { portfolios: [], trades: [] };
  const keys = { portfolios: ['user_id'], trades: ['user_id', 'n'] };
  const calls = [];
  const client = {
    db, calls,
    from(table) {
      let op = 'select', rows = [], opts = {}, single = false, orderBy = null;
      const filters = [];
      const q = {
        select() { return q; },
        eq(col, val) { filters.push((r) => r[col] === val); return q; },
        gte(col, val) { filters.push((r) => r[col] >= val); return q; },
        order(col) { orderBy = col; return q; },
        maybeSingle() { single = true; return q; },
        delete() { op = 'delete'; return q; },
        upsert(r, o = {}) { op = 'upsert'; rows = Array.isArray(r) ? r : [r]; opts = o; return q; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      function run() {
        calls.push({ table, op, filters: filters.length });
        if (failOn === `${table}.${op}`) return { data: null, error: { message: 'network down' } };
        if (op === 'delete') {
          db[table] = db[table].filter((r) => !filters.every((f) => f(r)));
          return { data: null, error: null };
        }
        if (op === 'upsert') {
          for (const row of rows) {
            const same = db[table].findIndex((r) => keys[table].every((k) => r[k] === row[k]));
            if (same === -1) db[table].push({ ...row });
            else if (!opts.ignoreDuplicates) db[table][same] = { ...db[table][same], ...row };
          }
          return { data: null, error: null };
        }
        let found = db[table].filter((r) => filters.every((f) => f(r)));
        if (orderBy) found = [...found].sort((a, b) => a[orderBy] - b[orderBy]);
        return { data: single ? (found[0] ?? null) : found, error: null };
      }
      return q;
    },
  };
  return client;
}

const day = '2026-11-13';
const prices = { KO: 650000, SPY: 7200000 };
const ok = (r) => { assert.equal(r.ok, true, r.reason); return r.portfolio; };
const withTrades = () => {
  let p = ok(buy(newPortfolio(), { symbol: 'KO', quantity: 10, pricePaise: 650000, date: day }));
  p = ok(buy(p, { symbol: 'SPY', quantity: 1, pricePaise: 7200000, date: day }, prices));
  p = ok(sell(p, { symbol: 'KO', quantity: 4, pricePaise: 660000, date: day }));
  return p;
};

test('a portfolio turns into rows and back into exactly the same portfolio', () => {
  const p = withTrades();
  const { portfolioRow, tradeRows } = toRows('me', p);
  assert.deepEqual(tradeRows.map((r) => r.n), [0, 1, 2]);
  assert.ok(tradeRows.every((r) => r.user_id === 'me'));
  // Rows shuffled on the way back still come out in trade order.
  assert.deepEqual(fromRows(portfolioRow, [...tradeRows].reverse()), p);
});

test('rows that look damaged are refused, not loaded', () => {
  assert.throws(() => fromRows({ cash_paise: -5, holdings: {} }, []), /damaged/);
  assert.throws(() => fromRows({ cash_paise: 100, holdings: { KO: { quantity: 0, costPaise: 1 } } }, []), /damaged/);
});

test('saving then loading gives the same portfolio back', async () => {
  const client = fakeClient();
  const p = withTrades();
  const saved = await saveCloudPortfolio(client, 'me', p, 0);
  assert.equal(saved, 3);
  assert.deepEqual(await loadCloudPortfolio(client, 'me'), p);
});

test('an account with nothing in it loads as null', async () => {
  assert.equal(await loadCloudPortfolio(fakeClient(), 'me'), null);
});

test('after each trade only the new trade is sent, and nothing is stored twice', async () => {
  const client = fakeClient();
  let p = ok(buy(newPortfolio(), { symbol: 'KO', quantity: 10, pricePaise: 650000, date: day }));
  let saved = await saveCloudPortfolio(client, 'me', p, 0);
  p = ok(buy(p, { symbol: 'SPY', quantity: 1, pricePaise: 7200000, date: day }, prices));
  saved =await saveCloudPortfolio(client, 'me', p, saved);
  assert.equal(saved, 2);
  assert.equal(client.db.trades.length, 2);
  // Saving the very same thing again (say, after a flaky connection) adds nothing.
  await saveCloudPortfolio(client, 'me', p, 0);
  assert.equal(client.db.trades.length, 2);
  assert.equal(client.db.portfolios.length, 1);
  assert.deepEqual(await loadCloudPortfolio(client, 'me'), p);
});

test('starting again clears the old trades and saves the fresh portfolio', async () => {
  const client = fakeClient();
  const saved = await saveCloudPortfolio(client, 'me', withTrades(), 0);
  const fresh = newPortfolio();
  assert.equal(await saveCloudPortfolio(client, 'me', fresh, saved), 0);
  assert.equal(client.db.trades.length, 0);
  assert.deepEqual(await loadCloudPortfolio(client, 'me'), fresh);
});

test('two learners never see or change each other\'s rows', async () => {
  const client = fakeClient();
  const mine = withTrades();
  const theirs = ok(buy(newPortfolio(), { symbol: 'AAPL', quantity: 3, pricePaise: 100000, date: day }));
  await saveCloudPortfolio(client, 'me', mine, 0);
  await saveCloudPortfolio(client, 'friend', theirs, 0);
  assert.deepEqual(await loadCloudPortfolio(client, 'me'), mine);
  assert.deepEqual(await loadCloudPortfolio(client, 'friend'), theirs);
  // The friend starting again must not touch my trades.
  await saveCloudPortfolio(client, 'friend', newPortfolio(), 1);
  assert.deepEqual(await loadCloudPortfolio(client, 'me'), mine);
});

test('first sign in with an empty account copies the browser portfolio up', async () => {
  const client = fakeClient();
  const browser = withTrades();
  const result = await syncOnSignIn(client, 'me', browser);
  assert.equal(result.copied, true);
  assert.equal(result.savedTrades, 3);
  assert.deepEqual(result.portfolio, browser);
  assert.deepEqual(await loadCloudPortfolio(client, 'me'), browser);
});

test('first sign in with an untouched browser just makes a fresh account', async () => {
  const client = fakeClient();
  const result = await syncOnSignIn(client, 'me', newPortfolio());
  assert.equal(result.copied, false);
  assert.deepEqual(result.portfolio, newPortfolio());
  assert.equal(client.db.portfolios.length, 1);
});

test('a damaged browser copy is ignored when the account is empty', async () => {
  const result = await syncOnSignIn(fakeClient(), 'me', { cashPaise: 'lots' });
  assert.deepEqual(result.portfolio, newPortfolio());
});

test('signing in again does not copy the browser over an account that already has a portfolio', async () => {
  const client = fakeClient();
  const inAccount = withTrades();
  await saveCloudPortfolio(client, 'me', inAccount, 0);
  const browser = ok(buy(newPortfolio(), { symbol: 'TSLA', quantity: 1, pricePaise: 300000, date: day }));
  const result = await syncOnSignIn(client, 'me', browser);
  assert.equal(result.copied, false);
  assert.deepEqual(result.portfolio, inAccount);
  assert.equal(client.db.trades.length, 3); // the browser's trade was not added
});

test('a failed save throws, so the page can tell the learner', async () => {
  const client = fakeClient({ failOn: 'portfolios.upsert' });
  await assert.rejects(saveCloudPortfolio(client, 'me', withTrades(), 0), /network down/);
  const loadFails = fakeClient({ failOn: 'portfolios.select' });
  await assert.rejects(loadCloudPortfolio(loadFails, 'me'), /network down/);
});
