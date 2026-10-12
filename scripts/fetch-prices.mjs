#!/usr/bin/env node
// Fetches yesterday's closing prices and saves them as JSON.
//
// Runs on a GitHub Action every night. Nobody has to remember to do it.
//
//   node scripts/fetch-prices.mjs
//
// The Twelve Data key comes from the TWELVE_DATA_KEY environment variable:
// GitHub Secrets in the Action, .env.local on this laptop. Never from a file in git.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { INSTRUMENTS, SYMBOLS, CURRENCIES } from '../lib/universe.js';

const FRANKFURTER = 'https://api.frankfurter.dev/v1';
const TWELVE_DATA = 'https://api.twelvedata.com/time_series';
const DATA_DIR = new URL('../data/', import.meta.url);

// The free Twelve Data plan allows 8 symbols a minute. Ask for 8, then wait.
const BATCH_SIZE = 8;
const BATCH_PAUSE_MS = 61_000;

// How much history to keep per symbol. Enough for M5's volatility maths.
const HISTORY_DAYS = 120;

const log = (...args) => console.log('·', ...args);

// Networks fail. This job runs at 2am with nobody watching, so it retries
// before giving up, waiting longer each time.
const RETRIES = 3;

async function getJSON(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        const wait = attempt * 5_000;
        console.warn(`  ~ ${label} attempt ${attempt} failed (${error.message}), retrying in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
  }

  throw new Error(`${label}: ${lastError.message} after ${RETRIES} attempts`);
}

/** Read whatever we saved last time, so a bad night never wipes good data. */
async function readExisting(name) {
  try {
    return JSON.parse(await readFile(new URL(name, DATA_DIR), 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- forex

async function fetchForex() {
  const rates = {};

  for (const currency of CURRENCIES) {
    const data = await getJSON(
      `${FRANKFURTER}/latest?base=${currency}&symbols=INR`,
      `Frankfurter ${currency}`,
    );
    rates[currency] = { inr: data.rates.INR, date: data.date };
    log(`1 ${currency} = ${data.rates.INR} INR  (${data.date})`);
  }

  return rates;
}

// ---------------------------------------------------------------- stocks

function toBatches(items, size) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/**
 * One symbol comes back as { meta, values }. Several come back keyed by symbol.
 * Flatten both into the same shape so the rest of the code never has to care.
 */
function normalise(payload, requested) {
  if (requested.length === 1) return { [requested[0]]: payload };
  return payload;
}

async function fetchStocks(apiKey) {
  const batches = toBatches(SYMBOLS, BATCH_SIZE);
  const prices = {};
  const failed = [];

  for (const [index, batch] of batches.entries()) {
    log(`batch ${index + 1} of ${batches.length}: ${batch.join(', ')}`);

    try {
      const url = `${TWELVE_DATA}?symbol=${batch.join(',')}&interval=1day`
        + `&outputsize=${HISTORY_DAYS}&apikey=${apiKey}`;
      const payload = normalise(await getJSON(url, 'Twelve Data'), batch);

      for (const symbol of batch) {
        const entry = payload[symbol];

        if (!entry || entry.status === 'error' || !Array.isArray(entry.values)) {
          failed.push(symbol);
          console.warn(`  ! ${symbol}: ${entry?.message ?? 'no data came back'}`);
          continue;
        }

        // Twelve Data returns newest first. Keep it that way: index 0 is "latest".
        prices[symbol] = {
          currency: entry.meta?.currency ?? 'USD',
          exchange: entry.meta?.exchange ?? null,
          history: entry.values.map((row) => ({
            date: row.datetime,
            close: Number(row.close),
          })),
        };
      }
    } catch (error) {
      failed.push(...batch);
      console.warn(`  ! batch ${index + 1} failed: ${error.message}`);
    }

    if (index < batches.length - 1) {
      log(`waiting ${BATCH_PAUSE_MS / 1000}s for the rate limit to reset`);
      await sleep(BATCH_PAUSE_MS);
    }
  }

  return { prices, failed };
}

// ---------------------------------------------------------------- main

async function main() {
  const apiKey = process.env.TWELVE_DATA_KEY;
  if (!apiKey) {
    console.error('No TWELVE_DATA_KEY found. Put it in .env.local or GitHub Secrets.');
    process.exit(1);
  }

  await mkdir(DATA_DIR, { recursive: true });

  log('forex from Frankfurter (no key needed)');
  const forex = await fetchForex();

  log('prices from Twelve Data');
  const { prices, failed } = await fetchStocks(apiKey);

  // Anything that failed tonight keeps yesterday's number rather than vanishing.
  const previous = await readExisting('stocks.json');
  let reused = 0;
  for (const symbol of failed) {
    if (previous?.prices?.[symbol]) {
      prices[symbol] = previous.prices[symbol];
      reused++;
    }
  }
  if (reused) log(`kept yesterday's data for ${reused} symbol(s) that failed`);

  const got = Object.keys(prices).length;
  if (got === 0) {
    console.error('Every symbol failed and there was nothing saved before. Not writing.');
    process.exit(1);
  }

  // "As of" is the newest close we actually hold, not the day the job ran.
  const asOf = Object.values(prices)
    .map((p) => p.history[0]?.date)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const fetchedAt = new Date().toISOString();

  await writeFile(new URL('forex.json', DATA_DIR),
    JSON.stringify({ fetchedAt, base: 'INR', rates: forex }, null, 2) + '\n');

  await writeFile(new URL('stocks.json', DATA_DIR),
    JSON.stringify({ fetchedAt, asOf, prices }, null, 2) + '\n');

  await writeFile(new URL('meta.json', DATA_DIR), JSON.stringify({
    fetchedAt,
    asOf,
    instruments: INSTRUMENTS.length,
    withPrices: got,
    failed,
    forexDate: forex.USD?.date ?? null,
  }, null, 2) + '\n');

  log(`saved ${got} of ${INSTRUMENTS.length} instruments, as of ${asOf}`);
  if (failed.length) log(`still missing: ${failed.join(', ')}`);
}

main().catch((error) => {
  console.error('Fetch failed:', error.message);
  process.exit(1);
});
