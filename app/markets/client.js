'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';

export default function PageClient({ html }) {
  useEffect(() => {
    (async () => {
      const { showDataDate } = await import('../../lib/asof.js');
      const { INSTRUMENTS } = await import('../../lib/universe.js');

      const SPARK_DAYS = 30;
      const BLUE = '#2563EB';

      const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

      /** A tiny line, no axes, no labels — shape only. */
      function sparkline(closes, width = 96, height = 26) {
        if (closes.length < 2) return '';
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const span = max - min || 1;
        const step = width / (closes.length - 1);

        const points = closes
          .map((close, i) => `${(i * step).toFixed(1)},${(height - ((close - min) / span) * (height - 4) - 2).toFixed(1)}`)
          .join(' ');

        return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
                     aria-hidden="true" focusable="false">
                  <polyline points="${points}" fill="none" stroke="${BLUE}"
                            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
      }

      function renderForex(forex) {
        document.getElementById('fx').innerHTML = Object.entries(forex.rates)
          .map(([code, { inr: rate }]) => `
            <div class="fx-card">
              <p class="pair">1 ${code} buys</p>
              <div class="rate">&#8377;${usd.format(rate)}</div>
            </div>`)
          .join('');
      }

      function renderInstruments(stocks, usdToInr) {
        const rows = INSTRUMENTS.map((instrument) => {
          const entry = stocks.prices[instrument.symbol];
          if (!entry?.history?.length) {
            return `<tr><td class="name">${instrument.name}
                      <div class="ticker">${instrument.symbol}</div></td>
                    <td colspan="4" class="error">no price yet</td></tr>`;
          }

          // History is newest first. Oldest-to-newest is what a line wants.
          const window = entry.history.slice(0, SPARK_DAYS).reverse();
          const closes = window.map((row) => row.close);
          const latest = closes.at(-1);
          const first = closes[0];
          const changePct = ((latest - first) / first) * 100;
          const up = changePct >= 0;

          return `<tr>
            <td class="name">${instrument.name}${instrument.kind === 'fund' ? '<span class="tag">fund</span>' : ''}
              <div class="ticker">${instrument.symbol} &middot; ${instrument.sector}</div></td>
            <td>$${usd.format(latest)}</td>
            <td>&#8377;${inr.format(latest * usdToInr)}</td>
            <td>${sparkline(closes)}</td>
            <td class="chg"><span class="arrow">${up ? '▲' : '▼'}</span>
                ${up ? '+' : ''}${changePct.toFixed(1)}%</td>
          </tr>`;
        });

        document.getElementById('rows').innerHTML = rows.join('');
      }

      async function load() {
        await showDataDate('/data/meta.json');

        try {
          const [forex, stocks] = await Promise.all([
            fetch('/data/forex.json', { cache: 'no-cache' }).then((r) => r.json()),
            fetch('/data/stocks.json', { cache: 'no-cache' }).then((r) => r.json()),
          ]);

          renderForex(forex);
          renderInstruments(stocks, forex.rates.USD.inr);
        } catch (error) {
          console.error(error);
          document.getElementById('fx').innerHTML =
            '<p class="error">Could not load the rates. The nightly job may not have run yet.</p>';
          document.getElementById('rows').innerHTML =
            '<tr><td colspan="5" class="error">Could not load prices.</td></tr>';
        }
      }

      load();
    })();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
