#!/usr/bin/env node
// Downloads month-end closing prices from January 2016 to today, for every
// instrument in lib/universe.js, and saves them to data/history.json.
//
//   npm run history
//
// The Twelve Data key comes from TWELVE_DATA_API_KEY in .env.local (or the
// environment). Prices are adjusted for share splits, so a company that split
// its shares does not look like it crashed.

import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { INSTRUMENTS, SYMBOLS } from '../lib/universe.js';

const TWELVE_DATA = 'https://api.twelvedata.com/time_series';
const DATA_DIR = new URL('../data/', import.meta.url);
const START_DATE = '2016-01-01';

// Free plan: 8 a minute. Ask for 8 symbols, then wait 60 seconds.
const BATCH_SIZE = 8;
const BATCH_PAUSE_MS = 60_000;

const log = (...args) => console.log('·', ...args);

// Load .env.local if it is there (the key may also come from the environment).
try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {
  // No .env.local: fine, we check for the key below.
}

function toBatches(items, size) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** One symbol comes back as { meta, values }. Several come back keyed by symbol. */
function normalise(payload, requested) {
  if (requested.length === 1) return { [requested[0]]: payload };
  return payload;
}

async function getJSON(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    console.error('No TWELVE_DATA_API_KEY found. Put it in .env.local first.');
    process.exit(1);
  }

  const batches = toBatches(SYMBOLS, BATCH_SIZE);
  const prices = {};
  const missing = [];

  for (const [index, batch] of batches.entries()) {
    log(`batch ${index + 1} of ${batches.length}: ${batch.join(', ')}`);

    try {
      const url = `${TWELVE_DATA}?symbol=${batch.join(',')}&interval=1month`
        + `&start_date=${START_DATE}&adjust=splits&order=asc&outputsize=5000`
        + `&apikey=${apiKey}`;
      const payload = normalise(await getJSON(url), batch);

      // A whole-request error (bad key, rate limit) has no per-symbol entries.
      if (payload.status === 'error' && !payload[batch[0]]) {
        throw new Error(payload.message ?? 'Twelve Data returned an error');
      }

      for (const symbol of batch) {
        const entry = payload[symbol];
        if (!entry || entry.status === 'error' || !Array.isArray(entry.values) || entry.values.length === 0) {
          missing.push(symbol);
          console.warn(`  ! ${symbol}: ${entry?.message ?? 'no data came back'}`);
          continue;
        }

        // Oldest first, whatever order the API used.
        prices[symbol] = entry.values
          .map((row) => ({ date: row.datetime, close: Number(row.close) }))
          .filter((row) => Number.isFinite(row.close))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (prices[symbol].length === 0) {
          delete prices[symbol];
          missing.push(symbol);
        }
      }
    } catch (error) {
      missing.push(...batch.filter((s) => !missing.includes(s)));
      console.warn(`  ! batch ${index + 1} failed: ${error.message}`);
    }

    if (index < batches.length - 1) {
      log(`waiting ${BATCH_PAUSE_MS / 1000}s for the rate limit to reset`);
      await sleep(BATCH_PAUSE_MS);
    }
  }

  const got = Object.keys(prices).length;
  if (got === 0) {
    console.error('No symbol returned any data. Not writing data/history.json.');
    process.exit(1);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    new URL('history.json', DATA_DIR),
    JSON.stringify({ fetchedAt: new Date().toISOString(), prices }, null, 2) + '\n',
  );

  log(`saved ${got} of ${INSTRUMENTS.length} instruments to data/history.json`);
  if (missing.length) log(`no data for: ${missing.join(', ')}`);
}

main().catch((error) => {
  console.error('Fetch failed:', error.message);
  process.exit(1);
});
