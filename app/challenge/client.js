'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';

export default function PageClient({ html }) {
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    (async () => {
      const { INSTRUMENTS } = await import('../../lib/universe.js');
      const { CHALLENGE_MONEY, weekNumber, weekStartDate, nextReset, scenarioForWeek, playChallenge } =
        await import('../../lib/challenge.js');

      const BLUE = '#2563EB';
      const ORANGE = '#D97706';
      const MAX_RESULTS = 6;

      const $ = (id) => document.getElementById(id);
      const byName = Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, i]));

      const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
      const short = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
      const signed = (n, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}%`;
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const monthName = (date) => new Date(`${date}T00:00:00Z`)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

      // ---- this week ----
      const week = weekNumber();
      const scenario = scenarioForWeek(week);
      const startDate = `${scenario.start}-01`;

      function drawWeekChip() {
        const ms = Math.max(0, nextReset(week).getTime() - Date.now());
        const days = Math.floor(ms / 86400000);
        const hours = Math.floor((ms % 86400000) / 3600000);
        const left = days > 0 ? `${days} day${days === 1 ? '' : 's'} ${hours} h` : `${hours} h`;
        const monday = new Date(`${weekStartDate(week)}T00:00:00Z`)
          .toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        $('week-chip').textContent = `Week of ${monday} · new patch in ${left}`;
      }
      drawWeekChip();
      timer = setInterval(drawWeekChip, 60000);

      let history = null;
      const holdings = {}; // symbol -> whole shares

      const priceAtStart = (symbol) =>
        (history?.prices[symbol] ?? []).find((r) => r.date === startDate)?.close ?? null;

      // ---- search ----
      function search(query) {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return INSTRUMENTS
          .filter((i) => [i.name, i.symbol, i.sector, i.kind].some((t) => t.toLowerCase().includes(q)))
          .sort((a, b) => {
            const rank = (i) => (i.symbol.toLowerCase().startsWith(q) || i.name.toLowerCase().startsWith(q) ? 0 : 1);
            return rank(a) - rank(b);
          })
          .slice(0, MAX_RESULTS);
      }

      function drawResults() {
        const query = $('search').value;
        if (!query.trim()) { $('results').innerHTML = ''; return; }
        const found = search(query);
        $('results').innerHTML = found.length === 0
          ? '<li class="none">Nothing found. Try a company name or a ticker like KO.</li>'
          : found.map((i) => {
              const price = priceAtStart(i.symbol);
              return `
              <li>
                <button type="button" class="result" data-add="${i.symbol}" ${holdings[i.symbol] ? 'disabled' : ''}>
                  <span class="name">${esc(i.name)}${i.kind === 'fund' ? '<span class="tag">fund</span>' : ''}
                    <span class="ticker">${i.symbol} &middot; ${esc(i.sector)}</span></span>
                  <span class="right">
                    <span class="was">${price === null ? '…' : usdCents.format(price)}
                      <span class="when">at the start</span></span>
                    <span class="add">${holdings[i.symbol] ? 'Added' : '+ Add'}</span>
                  </span>
                </button>
              </li>`;
            }).join('');
      }

      function addStock(symbol) {
        if (!byName[symbol] || holdings[symbol]) return;
        holdings[symbol] = 1;
        $('search').value = '';
        drawResults();
        drawHoldings();
        updateWallet();
      }

      function drawHoldings() {
        const symbols = Object.keys(holdings);
        $('holdings-box').hidden = symbols.length === 0;
        $('holdings').innerHTML = symbols.map((s) => {
          const price = priceAtStart(s);
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

      // ---- the money bar and the Lock in button ----
      function spent() {
        return Object.entries(holdings).reduce((sum, [s, n]) => sum + n * (priceAtStart(s) ?? 0), 0);
      }

      function updateWallet() {
        const cost = spent();
        const cash = CHALLENGE_MONEY - cost;
        const over = cash < -1e-9;
        $('w-spent').textContent = usd.format(cost);
        $('w-cash').textContent = usd.format(Math.max(cash, 0));
        $('wallet').classList.toggle('over', over);
        for (const s of Object.keys(holdings)) {
          const cell = document.querySelector(`[data-cost="${s}"]`);
          const price = priceAtStart(s);
          if (cell && price !== null) cell.textContent = usd.format(price * holdings[s]);
        }
        $('problem').hidden = !over;
        if (over) $('problem').textContent = `That costs ${usd.format(cost)}, but you only have ${usd.format(CHALLENGE_MONEY)}. Lower some shares.`;
        $('lock').disabled = !history || over;
      }

      // ---- the chart: two lines, you and the market ----
      let current = null;

      function chart(yours, market) {
        const W = 640, H = 260, L = 52, R = 16, T = 14, B = 30;
        const nums = [...yours, ...market].map((v) => v.value);
        const min = Math.min(...nums, CHALLENGE_MONEY);
        const max = Math.max(...nums, CHALLENGE_MONEY);
        const span = max - min || 1;
        const n = yours.length;
        const x = (i) => L + (i / (n - 1 || 1)) * (W - L - R);
        const y = (v) => T + (1 - (v - min) / span) * (H - T - B);
        current = { yours, market, x, y, W, L, R };

        const line = (series, color) => `<polyline points="${series.map((v, i) => `${x(i).toFixed(1)},${y(v.value).toFixed(1)}`).join(' ')}"
          fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

        const ticks = [min, (min + max) / 2, max].map((t) =>
          `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="#E3E8EF"/>
           <text x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">$${short.format(t)}</text>`).join('');
        const labels = yours.map((v, i) =>
          `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${monthName(v.date)}</text>`).join('');

        return `<svg viewBox="0 0 ${W} ${H}" role="img"
                     aria-label="Line chart of your value and the S&P 500 fund value, month by month">
                  ${ticks}
                  <line x1="${L}" x2="${W - R}" y1="${y(CHALLENGE_MONEY).toFixed(1)}" y2="${y(CHALLENGE_MONEY).toFixed(1)}"
                        stroke="#5A6578" stroke-dasharray="4 4"/>
                  ${line(market, ORANGE)}
                  ${line(yours, BLUE)}
                  ${labels}
                  <line id="hover-line" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#5A6578" visibility="hidden"/>
                  <circle id="hover-dot" r="5" fill="${BLUE}" stroke="#fff" stroke-width="2" visibility="hidden"/>
                </svg>
                <div class="tip" id="tip" hidden></div>`;
      }

      function hideTip() {
        for (const id of ['hover-line', 'hover-dot']) $(id)?.setAttribute('visibility', 'hidden');
        if ($('tip')) $('tip').hidden = true;
      }

      function moveTip(e) {
        const svg = $('chart').querySelector('svg');
        if (!current || !svg) return;
        const { yours, market, x, y, W, L, R } = current;
        const box = svg.getBoundingClientRect();
        const vx = ((e.clientX - box.left) / box.width) * W;
        const i = Math.max(0, Math.min(yours.length - 1, Math.round(((vx - L) / (W - L - R)) * (yours.length - 1))));
        $('hover-line').setAttribute('x1', x(i));
        $('hover-line').setAttribute('x2', x(i));
        $('hover-dot').setAttribute('cx', x(i));
        $('hover-dot').setAttribute('cy', y(yours[i].value));
        $('hover-line').setAttribute('visibility', 'visible');
        $('hover-dot').setAttribute('visibility', 'visible');
        const tip = $('tip');
        tip.innerHTML = `<b>${monthName(yours[i].date)}</b><span>You ${usd.format(yours[i].value)}</span>
          <span class="spread-line">S&amp;P 500 fund ${usd.format(market[i].value)}</span>`;
        tip.hidden = false;
        const px = (x(i) / W) * box.width;
        tip.style.left = `${px}px`;
        tip.style.transform = px > box.width * 0.65 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
      }

      // ---- lock in: replay the patch and show what happened ----
      function lockIn() {
        let r;
        try {
          r = playChallenge(history, scenario, { ...holdings });
        } catch (error) {
          $('problem').textContent = error.message;
          $('problem').hidden = false;
          return;
        }

        const { yours, market } = r;
        const from = monthName(startDate);
        const to = monthName(`${scenario.end}-01`);
        const gap = Math.abs(yours.totalReturnPct - market.totalReturnPct);

        $('verdict').className = `verdict ${r.survived ? 'win' : 'lose'}`;
        $('verdict').innerHTML = `
          <h3>${r.survived ? 'You survived!' : 'The market did better this time.'}</h3>
          <p>${esc(scenario.name)}, ${from} to ${to}. You went ${signed(yours.totalReturnPct)}; the S&amp;P 500 fund went
             ${signed(market.totalReturnPct)}. That is ${gap.toFixed(1)} points ${r.survived ? 'better' : 'worse'}.</p>
          <p class="lesson">${r.survived
            ? 'You lost less than the market. Cash and steady companies often fall less in a crash.'
            : 'The fund holds 500 companies, so no single one can pull it down far. Spreading out, or keeping some cash, can soften a fall.'}</p>`;

        $('r-yours').textContent = usd.format(yours.endValue);
        $('r-yours-sub').textContent = `${signed(yours.totalReturnPct)} from ${usd.format(CHALLENGE_MONEY)}`;
        $('r-market').textContent = usd.format(market.endValue);
        $('r-market-sub').textContent = `${signed(market.totalReturnPct)} from ${usd.format(CHALLENGE_MONEY)}`;
        $('r-drop').textContent = `−${yours.worstDropPct.toFixed(0)}%`;
        $('r-mdrop').textContent = `−${market.worstDropPct.toFixed(0)}%`;
        $('chart').innerHTML = chart(yours.values, market.values);

        $('result-section').hidden = false;
        $('result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

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
        updateWallet();
      });
      $('holdings').addEventListener('click', (e) => {
        const button = e.target.closest('[data-remove]');
        if (!button) return;
        delete holdings[button.dataset.remove];
        drawHoldings();
        drawResults();
        updateWallet();
      });
      $('lock').addEventListener('click', lockIn);
      $('again').addEventListener('click', () => {
        $('result-section').hidden = true;
        $('play').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      $('chart').addEventListener('pointermove', moveTip);
      $('chart').addEventListener('pointerdown', moveTip);
      $('chart').addEventListener('pointerleave', hideTip);

      updateWallet();

      try {
        const response = await fetch('/data/history.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        history = await response.json();
        if (cancelled) return;
        $('loading').hidden = true;
        drawHoldings();
        drawResults();
        updateWallet();
      } catch (error) {
        console.error(error);
        $('loading').textContent = 'Could not load the price history.';
      }
    })();

    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
