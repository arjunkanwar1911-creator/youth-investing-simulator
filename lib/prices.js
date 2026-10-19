// Turns the nightly data files into "what does one share cost in rupees today",
// which is the only price the trading engine needs.

import { INSTRUMENTS } from './universe.js';

/**
 * stocks.json + forex.json -> { AAPL: 3261493, ... } in paise per share.
 * History is newest first, so the latest close is history[0].
 * Anything without a price or an exchange rate is simply left out.
 */
export function pricesInPaise(stocks, forex) {
  const prices = {};
  for (const { symbol, currency } of INSTRUMENTS) {
    const close = stocks?.prices?.[symbol]?.history?.[0]?.close;
    const rate = currency === 'INR' ? 1 : forex?.rates?.[currency]?.inr;
    if (Number.isFinite(close) && close > 0 && Number.isFinite(rate) && rate > 0) {
      prices[symbol] = Math.round(close * rate * 100);
    }
  }
  return prices;
}
