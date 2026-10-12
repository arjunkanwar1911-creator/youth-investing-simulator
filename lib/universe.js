// The starter list every learner can trade. Deliberately small and deliberately
// boring: companies a 15 year old has actually heard of, plus index funds, so the
// difference between "one bet" and "the whole market" is visible in M5.
//
// `sector` and `currency` are here for the diversification score later.

export const INSTRUMENTS = [
  // --- Technology ---
  { symbol: 'AAPL',  name: 'Apple',            kind: 'stock', sector: 'Technology',  currency: 'USD' },
  { symbol: 'MSFT',  name: 'Microsoft',        kind: 'stock', sector: 'Technology',  currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)',kind: 'stock', sector: 'Technology',  currency: 'USD' },
  { symbol: 'NVDA',  name: 'Nvidia',           kind: 'stock', sector: 'Technology',  currency: 'USD' },
  { symbol: 'META',  name: 'Meta (Instagram)', kind: 'stock', sector: 'Technology',  currency: 'USD' },

  // --- Things people buy ---
  { symbol: 'AMZN',  name: 'Amazon',           kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'TSLA',  name: 'Tesla',            kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'NFLX',  name: 'Netflix',          kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'DIS',   name: 'Disney',           kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'NKE',   name: 'Nike',             kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'SBUX',  name: 'Starbucks',        kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'MCD',   name: "McDonald's",       kind: 'stock', sector: 'Consumer',    currency: 'USD' },
  { symbol: 'KO',    name: 'Coca-Cola',        kind: 'stock', sector: 'Consumer',    currency: 'USD' },

  // --- The quieter corners of the market ---
  { symbol: 'JNJ',   name: 'Johnson & Johnson',kind: 'stock', sector: 'Healthcare',  currency: 'USD' },
  { symbol: 'V',     name: 'Visa',             kind: 'stock', sector: 'Financials',  currency: 'USD' },

  // --- Index funds: one purchase, hundreds of companies ---
  { symbol: 'SPY',   name: 'S&P 500 (500 biggest US companies)', kind: 'fund', sector: 'Diversified', currency: 'USD' },
  { symbol: 'VOO',   name: 'S&P 500, cheaper version',           kind: 'fund', sector: 'Diversified', currency: 'USD' },
  { symbol: 'QQQ',   name: 'Nasdaq 100 (mostly tech)',           kind: 'fund', sector: 'Diversified', currency: 'USD' },
  { symbol: 'VTI',   name: 'The entire US stock market',         kind: 'fund', sector: 'Diversified', currency: 'USD' },
  { symbol: 'INDA',  name: 'India (MSCI India fund)',            kind: 'fund', sector: 'Diversified', currency: 'USD' },
];

/** The currencies we quote against the rupee. */
export const CURRENCIES = ['USD', 'EUR', 'GBP'];

export const SYMBOLS = INSTRUMENTS.map((i) => i.symbol);

export function findInstrument(symbol) {
  return INSTRUMENTS.find((i) => i.symbol === symbol);
}
