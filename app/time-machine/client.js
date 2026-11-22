'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';

export default function PageClient({ html }) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { INSTRUMENTS } = await import('../../lib/universe.js');
      const { timeMachine } = await import('../../lib/timemachine.js');

      const BLUE = '#2563EB';
      const START = '2016-01-01';
      const SUGGESTED = ['AAPL', 'SPY', 'KO'];
      const MAX_RESULTS = 6;

      const $ = (id) => document.getElementById(id);
      const byName = Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, i]));

      // History prices are in US dollars, so every money number on this page is too.
      const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
      const short = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
      const signed = (n, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}%`;
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

      let history = null;
      // symbol -> number of whole shares. Starts empty on purpose.
      const holdings = {};

      // ---- the first month every chosen stock has a price ----
      function startDateFor(symbols) {
        if (!history || symbols.length === 0) return null;
        const sets = symbols.map((s) => new Set((history.prices[s] ?? []).filter((r) => r.date >= START).map((r) => r.date)));
        const common = [...sets[0]].filter((d) => sets.every((set) => set.has(d))).sort();
        return common[0] ?? null;
      }

      const priceOn = (symbol, date) => (history?.prices[symbol] ?? []).find((r) => r.date === date)?.close ?? null;

      // ---- search ----
      function search(query) {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return INSTRUMENTS
          .filter((i) => [i.name, i.symbol, i.sector, i.kind].some((t) => t.toLowerCase().includes(q)))
          .sort((a, b) => {
            // Names and tickers that START with the search come first.
            const rank = (i) => (i.symbol.toLowerCase().startsWith(q) || i.name.toLowerCase().startsWith(q) ? 0 : 1);
            return rank(a) - rank(b);
          })
          .slice(0, MAX_RESULTS);
      }

      // The first price we have on or after January 2016, for the search list.
      const price2016 = (symbol) => (history?.prices[symbol] ?? []).find((r) => r.date >= START)?.close ?? null;

      function drawResults() {
        const query = $('search').value;
        const found = search(query);
        if (!query.trim()) { $('results').innerHTML = ''; return; }
        $('results').innerHTML = found.length === 0
          ? '<li class="none">Nothing found. Try a company name or a ticker like AAPL.</li>'
          : found.map((i) => `
              <li>
                <button type="button" class="result" data-add="${i.symbol}" ${holdings[i.symbol] ? 'disabled' : ''}>
                  <span class="name">${esc(i.name)}${i.kind === 'fund' ? '<span class="tag">fund</span>' : ''}
                    <span class="ticker">${i.symbol} &middot; ${esc(i.sector)}</span></span>
                  <span class="right">
                    <span class="was">${price2016(i.symbol) === null ? '…' : usdCents.format(price2016(i.symbol))}
                      <span class="when">in Jan 2016</span></span>
                    <span class="add">${holdings[i.symbol] ? 'Added' : '+ Add'}</span>
                  </span>
                </button>
              </li>`).join('');
      }

      function addStock(symbol) {
        if (!byName[symbol] || holdings[symbol]) return;
        holdings[symbol] = 1;
        $('search').value = '';
        drawResults();
        drawHoldings();
        update();
      }

      // ---- the "your stocks" table ----
      function drawHoldings() {
        const symbols = Object.keys(holdings);
        $('holdings-box').hidden = symbols.length === 0;
        const date = startDateFor(symbols);
        $('start-label').textContent = date ? date.slice(0, 7) : START.slice(0, 7);

        $('holdings').innerHTML = symbols.map((s) => {
          const price = date ? priceOn(s, date) : null;
          return `
            <tr>
              <td class="name">${esc(byName[s].name)}${byName[s].kind === 'fund' ? '<span class="tag">fund</span>' : ''}
                <div class="ticker">${s} &middot; ${price === null ? '…' : usdCents.format(price)} a share</div></td>
              <td class="pct-cell">
                <input class="shares" type="number" min="1" max="100000" step="1" value="${holdings[s]}"
                       inputmode="numeric" data-symbol="${s}" aria-label="Shares of ${esc(byName[s].name)}"> shares
              </td>
              <td class="cost" data-cost="${s}">${price === null ? '' : usd.format(price * holdings[s])}</td>
              <td class="remove-cell"><button type="button" class="remove" data-remove="${s}"
                      aria-label="Remove ${esc(byName[s].name)}">&times;</button></td>
            </tr>`;
        }).join('');
      }

      // Remembers the chart that is on screen so the hover code can find the nearest month.
      let current = null;
      const monthName = (date) => new Date(`${date}T00:00:00Z`)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

      // ---- the line chart: same blue line as the markets page, just bigger ----
      // With no stocks it draws an empty chart: a flat line at $0 and a hint.
      function lineChart(values, amount) {
        const W = 640, H = 260, L = 52, R = 16, T = 14, B = 30;
        const empty = values.length === 0;

        let dates;
        let min, max;
        if (empty) {
          const thisYear = new Date().getFullYear();
          dates = [];
          for (let y = 2016; y <= thisYear; y++) dates.push(`${y}-01-01`);
          min = 0; max = 100;
        } else {
          dates = values.map((v) => v.date);
          const nums = values.map((v) => v.value);
          min = Math.min(...nums, amount);
          max = Math.max(...nums, amount);
        }
        const span = max - min || 1;
        const count = dates.length;

        const x = (i) => L + (i / (count - 1 || 1)) * (W - L - R);
        const y = (v) => T + (1 - (v - min) / span) * (H - T - B);

        const ticks = [min, (min + max) / 2, max].map((t) =>
          `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="#E3E8EF"/>
           <text x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">$${short.format(t)}</text>`).join('');

        let lastYear = null;
        const years = dates.map((date, i) => {
          const year = Number(date.slice(0, 4));
          if (year === lastYear) return '';
          lastYear = year;
          if (year % 2 !== 0) return '';
          return `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${year}</text>`;
        }).join('');

        if (empty) {
          return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Empty chart. You own 0 stocks yet.">
                    ${ticks}
                    <line x1="${L}" x2="${W - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"
                          stroke="${BLUE}" stroke-width="2" stroke-linecap="round"/>
                    <text x="${(W + L - R) / 2}" y="${H / 2 - 6}" text-anchor="middle" class="hint">0 stocks</text>
                    <text x="${(W + L - R) / 2}" y="${H / 2 + 14}" text-anchor="middle">Add a stock above to see your line grow</text>
                    ${years}
                  </svg>`;
        }

        current = { values, amount, x, y, W, H, L, R };
        const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v.value).toFixed(1)}`).join(' ');
        const first = values[0].date.slice(0, 7);
        const last = values.at(-1).date.slice(0, 7);

        return `<svg viewBox="0 0 ${W} ${H}" role="img"
                     aria-label="Line chart of the value of your stocks every month, from ${first} to ${last}">
                  ${ticks}
                  <line x1="${L}" x2="${W - R}" y1="${y(amount).toFixed(1)}" y2="${y(amount).toFixed(1)}"
                        stroke="#5A6578" stroke-dasharray="4 4"/>
                  <polyline points="${points}" fill="none" stroke="${BLUE}"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  ${years}
                  <line id="hover-line" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#5A6578" stroke-width="1" visibility="hidden"/>
                  <circle id="hover-dot" r="5" fill="${BLUE}" stroke="#fff" stroke-width="2" visibility="hidden"/>
                </svg>
                <div class="tip" id="tip" hidden></div>`;
      }

      function showEmpty() {
        current = null;
        $('problem').hidden = true;
        $('suggest').hidden = false;
        $('s-value').textContent = usd.format(0);
        $('s-value-sub').textContent = 'You own 0 stocks';
        $('s-total').textContent = '—';
        $('s-yearly').textContent = '—';
        $('s-drop').textContent = '—';
        $('total').textContent = '';
        $('chart').innerHTML = lineChart([], 0);
      }

      // ---- redraw the numbers and the chart whenever the stocks or shares change ----
      function update() {
        const symbols = Object.keys(holdings);
        if (symbols.length === 0 || !history) return showEmpty();

        const fail = (message) => {
          $('problem').textContent = message;
          $('problem').hidden = false;
        };

        const date = startDateFor(symbols);
        if (!date) return fail('These stocks do not have prices from the same month. Try removing one.');

        // What each holding cost on the first day: shares x price. Those costs become the weights.
        const costs = Object.fromEntries(symbols.map((s) => [s, holdings[s] * priceOn(s, date)]));
        const amount = Object.values(costs).reduce((a, b) => a + b, 0);
        const weights = Object.fromEntries(symbols.map((s) => [s, costs[s] / amount]));

        let result;
        try {
          result = timeMachine(history, weights, amount, START);
        } catch (error) {
          return fail(error.message);
        }

        $('problem').hidden = true;
        $('suggest').hidden = true;
        for (const s of symbols) {
          const cell = document.querySelector(`[data-cost="${s}"]`);
          if (cell) cell.textContent = usd.format(costs[s]);
        }
        $('total').textContent = `You would have paid ${usd.format(amount)} in ${date.slice(0, 7)}`;

        $('s-value').textContent = usd.format(result.endValue);
        $('s-value-sub').textContent = `You put in ${usd.format(amount)}`;
        $('s-total').textContent = signed(result.totalReturnPct, 0);
        $('s-yearly').textContent = result.yearlyReturnPct === null ? '—' : signed(result.yearlyReturnPct);
        $('s-drop').textContent = `−${result.worstDropPct.toFixed(0)}%`;
        $('chart').innerHTML = lineChart(result.values, amount);
      }

      // ---- hover / touch on the chart: show the month, the value and the gain ----
      function hideTip() {
        const line = $('hover-line'), dot = $('hover-dot'), tip = $('tip');
        if (line) line.setAttribute('visibility', 'hidden');
        if (dot) dot.setAttribute('visibility', 'hidden');
        if (tip) tip.hidden = true;
      }

      function moveTip(e) {
        const svg = $('chart').querySelector('svg');
        if (!current || !svg) return;
        const { values, amount, x, y, W, L, R } = current;
        const box = svg.getBoundingClientRect();
        const vx = ((e.clientX - box.left) / box.width) * W;
        const i = Math.max(0, Math.min(values.length - 1, Math.round(((vx - L) / (W - L - R)) * (values.length - 1))));
        const { date, value } = values[i];
        const gain = value - amount;

        const line = $('hover-line'), dot = $('hover-dot'), tip = $('tip');
        line.setAttribute('x1', x(i)); line.setAttribute('x2', x(i));
        dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(value));
        line.setAttribute('visibility', 'visible');
        dot.setAttribute('visibility', 'visible');

        tip.innerHTML = `<b>${monthName(date)}</b><span>${usd.format(value)}</span>
          <span class="${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : '−'}${usd.format(Math.abs(gain))}
          (${signed((value / amount - 1) * 100, 0)})</span>`;
        tip.hidden = false;
        const px = (x(i) / W) * box.width;
        tip.style.left = `${px}px`;
        tip.style.transform = px > box.width * 0.65 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
      }

      $('chart').addEventListener('pointermove', moveTip);
      $('chart').addEventListener('pointerdown', moveTip);
      $('chart').addEventListener('pointerleave', hideTip);

      // ---- events ----
      $('search').addEventListener('input', drawResults);
      $('results').addEventListener('click', (e) => {
        const button = e.target.closest('[data-add]');
        if (button) addStock(button.dataset.add);
      });
      $('holdings').addEventListener('input', (e) => {
        const box = e.target.closest('.shares');
        if (!box) return;
        const n = Math.floor(Number(box.value));
        holdings[box.dataset.symbol] = n >= 1 ? Math.min(n, 100000) : 1;
        update();
      });
      $('holdings').addEventListener('click', (e) => {
        const button = e.target.closest('[data-remove]');
        if (!button) return;
        delete holdings[button.dataset.remove];
        drawHoldings();
        drawResults();
        update();
      });

      $('chips').innerHTML = SUGGESTED.filter((s) => byName[s]).map((s) =>
        `<button type="button" class="preset" data-add="${s}">+ ${esc(byName[s].name)}</button>`).join('');
      $('chips').addEventListener('click', (e) => {
        const button = e.target.closest('[data-add]');
        if (button) addStock(button.dataset.add);
      });

      // The chart is on screen straight away, with zero stocks.
      showEmpty();

      try {
        const response = await fetch('/data/history.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        history = await response.json();
        if (cancelled) return;
        $('loading').hidden = true;
        drawHoldings();
        drawResults();
        update();
      } catch (error) {
        console.error(error);
        $('loading').textContent = 'Could not load the price history.';
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
