'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';
import { loadChart } from '../load-chart';

export default function PageClient({ html }) {
  useEffect(() => {
    (async () => {
      await loadChart();
      
      const { showDataDate, formatDate } = await import('../../lib/asof.js');
      const { INSTRUMENTS } = await import('../../lib/universe.js');
      const { pricesInPaise } = await import('../../lib/prices.js');
      const { allocation, volatility, diversification, biggestDrop } = await import('../../lib/risk.js');
      const { newPortfolio, buy, sell, value, isPortfolio, maxBuyPaise, STARTING_CASH_PAISE } = await import('../../lib/portfolio.js');
      const { mountTutorial } = await import('../../lib/tutorial-ui.js');
      const { browserStorage, loadProgress, saveKeyFor, walletMode } = await import('../../lib/tutorial.js');
      
      const storage = browserStorage();
      // While a tutorial mission is on, trades go to the separate practice wallet.
      // The real portfolio key is not touched. Looked up each time, so it switches the moment the tutorial ends.
      const saveKey = () => saveKeyFor(loadProgress(storage));
      const $ = (id) => document.getElementById(id);
      const byId = Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, i]));
      
      const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
      const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const rupees = (paise) => '₹' + inr2.format(paise / 100);
      const rupeesRound = (paise) => '₹' + inr0.format(Math.round(paise / 100));
      const shares = (q) => q.toLocaleString('en-IN', { maximumFractionDigits: 4 });
      const signed = (paise) => (paise > 0 ? '+' : paise < 0 ? '−' : '') + rupeesRound(Math.abs(paise));
      
      let prices = {};
      let priceDate = null;
      let stocks = null;   // full price history, for "how bumpy is it"
      let forex = null;
      let portfolio = load();
      let tutorial = null;
      
      // ---- saving in the browser ----
      function load() {
        try {
          const saved = JSON.parse(storage.getItem(saveKey()));
          if (isPortfolio(saved)) return saved;
          if (saved !== null) console.warn('Saved portfolio looked damaged, starting fresh.');
        } catch { /* private window or blocked storage: just start fresh */ }
        return newPortfolio();
      }
      function save() {
        try { storage.setItem(saveKey(), JSON.stringify(portfolio)); } catch { /* not fatal */ }
      }
      
      // ---- drawing the page from the state ----
      function render() {
        const v = value(portfolio, prices);
        // To the paisa, so the three numbers on screen always add up exactly.
        $('cash').textContent = rupees(v.cashPaise);
        $('holdings').textContent = rupees(v.holdingsPaise);
        $('total').textContent = rupees(v.totalPaise);
        const change = v.totalPaise - STARTING_CASH_PAISE;
        $('vs-start').innerHTML = portfolio.trades.length
          ? `<span class="${change >= 0 ? 'up' : 'down'}">${signed(change)}</span> since you started`
          : '';
      
        $('owned').innerHTML = v.rows.length ? `
          <div class="table-box"><table>
            <thead><tr><th scope="col">Name</th><th scope="col">Shares</th><th scope="col">Worth</th>
              <th scope="col" class="wide-only">Paid</th><th scope="col">Up / down</th></tr></thead>
            <tbody>${v.rows.sort((a, b) => b.valuePaise - a.valuePaise).map((r) => `
              <tr><td><span class="name">${byId[r.symbol]?.name ?? r.symbol}</span>
                    <div class="ticker">${r.symbol} &middot; ${Math.round((r.valuePaise / v.totalPaise) * 100)}% of total</div></td>
                  <td>${shares(r.quantity)}</td>
                  <td>${rupeesRound(r.valuePaise)}</td>
                  <td class="wide-only">${rupeesRound(r.costPaise)}</td>
                  <td class="${r.gainPaise >= 0 ? 'up' : 'down'}">${signed(r.gainPaise)}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="empty">Nothing yet. All your money is cash.</p>';
      
        $('history').innerHTML = portfolio.trades.length ? `
          <div class="table-box"><table>
            <thead><tr><th scope="col">What</th><th scope="col">Price date</th><th scope="col">Shares</th>
              <th scope="col">Price</th><th scope="col">Total</th></tr></thead>
            <tbody>${portfolio.trades.slice().reverse().map((t) => `
              <tr><td><span class="side ${t.side}-tag">${t.side}</span> <span class="name">${byId[t.symbol]?.name ?? t.symbol}</span></td>
                  <td>${t.date ? formatDate(t.date) : ''}</td>
                  <td>${shares(t.quantity)}</td>
                  <td>${rupees(t.pricePaise)}</td>
                  <td>${rupeesRound(t.totalPaise)}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="empty">No trades yet.</p>';
      
        renderSplit();
        renderSpread();
        renderMoves();
        renderQuote();
        $('practice').hidden = !walletMode(loadProgress(storage));
        tutorial?.check();
      }
      
      // ---- a company's last 120 days ----
      let priceChart = null;
      let guessDate = null; // the day the learner tapped
      const priceHistory = () => stocks?.prices?.[$('chart-symbol').value]?.history ?? []; // newest first
      const shortDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      
      function pickDay(date) {
        guessDate = date;
        renderPriceChart();
        tutorial?.check();
      }
      
      function renderPriceChart() {
        const newestFirst = priceHistory();
        const days = newestFirst.slice().reverse(); // a line reads oldest to newest
        const tapped = days.findIndex((d) => d.date === guessDate);
        const t = tutorial?.state();
        const hideAnswer = !!t && t.active && t.step === 4 && !t.showCard; // don't spoil mission 5
      
        const parts = [];
        if (tapped > 0) {
          const move = (days[tapped].close / days[tapped - 1].close - 1) * 100;
          parts.push(`${formatDate(days[tapped].date)}: <span class="${move >= 0 ? 'up' : 'down'}">${move >= 0 ? '+' : '−'}${Math.abs(move).toFixed(1)}%</span> compared with the day before`);
        }
        const worst = biggestDrop(newestFirst);
        if (worst && !hideAnswer) parts.push(`Biggest one-day drop: <span class="down">−${Math.abs(worst.percent).toFixed(1)}%</span> on ${formatDate(worst.date)}`);
        $('price-note').innerHTML = parts.join(' · ') || (days.length ? 'Tap the line to pick a day.' : '');
      
        if (!window.Chart || !days.length) return;
        const data = {
          labels: days.map((d) => d.date),
          datasets: [{
            data: days.map((d) => d.close), borderColor: '#2563EB', borderWidth: 2, tension: 0,
            pointRadius: days.map((_, i) => (i === tapped ? 6 : 0)),
            pointBackgroundColor: days.map((_, i) => (i === tapped ? '#B42318' : '#2563EB')),
          }],
        };
        if (priceChart) {
          priceChart.data = data;
          priceChart.update('none');
          return;
        }
        priceChart = new Chart($('price-chart'), {
          type: 'line', data,
          options: {
            maintainAspectRatio: false, animation: false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            onClick: (event, _elements, c) => {
              const hit = c.getElementsAtEventForMode(event, 'nearest', { axis: 'x', intersect: false }, true)[0];
              if (hit) pickDay(c.data.labels[hit.index]);
            },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { title: (items) => formatDate(items[0].label), label: (c) => ` $${c.parsed.y.toFixed(2)}` } },
            },
            scales: {
              x: { ticks: { maxTicksLimit: 5, callback(v) { return shortDate(this.getLabelForValue(v)); } }, grid: { display: false } },
              y: { title: { display: true, text: 'US dollars' } },
            },
          },
        });
      }
      
      $('chart-symbol').addEventListener('change', () => { guessDate = null; renderPriceChart(); });
      
      // ---- where your money is ----
      // Fixed colours, so "Technology" is the same blue every time you look.
      const COLOURS = {
        USD: '#2563EB',
        'Single companies': '#F59E0B', 'Index funds': '#0D9488',
        Technology: '#2563EB', 'Internet & Media': '#DB2777', Consumer: '#F59E0B',
        'Everyday needs': '#65A30D', Healthcare: '#10B981',
        Financials: '#8B5CF6', Diversified: '#0D9488',
      };
      const NAMES = { USD: 'US dollars' };
      let split = 'kind';
      let chart = null;
      
      function renderSplit() {
        const a = allocation(portfolio, prices);
        const groups = a[split];
        $('split-cash').textContent = groups.length
          ? `Not invested: ${rupeesRound(a.cashPaise)} cash.`
          : 'Nothing invested yet. Buy something and your split shows up here.';
        $('split-chart').parentElement.hidden = !groups.length;
        const colour = (g) => COLOURS[g.label] ?? '#CBD5E1';
        const name = (g) => NAMES[g.label] ?? g.label;
        $('split-legend').innerHTML = groups.map((g) => `
          <li><span class="dot" style="background:${colour(g)}"></span><span>${name(g)}</span>
              <span class="pct">${g.percent}%</span><span class="rs">${rupeesRound(g.paise)}</span></li>`).join('');
      
        if (!window.Chart) return; // the list above still tells the whole story
        const data = {
          labels: groups.map(name),
          datasets: [{ data: groups.map((g) => g.paise), backgroundColor: groups.map(colour), borderColor: '#fff', borderWidth: 2 }],
        };
        const tooltip = { callbacks: { label: (c) => ` ${c.label}: ${groups[c.dataIndex].percent}%` } };
        if (chart) {
          chart.data = data;
          chart.options.plugins.tooltip = tooltip;
          chart.update();
          return;
        }
        chart = new Chart($('split-chart'), {
          type: 'doughnut', data,
          options: { cutout: '62%', maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false }, tooltip } },
        });
      }
      
      for (const b of document.querySelectorAll('[data-split]')) {
        b.addEventListener('click', () => {
          split = b.dataset.split;
          for (const other of document.querySelectorAll('[data-split]')) other.setAttribute('aria-pressed', String(other === b));
          renderSplit();
        });
      }
      
      // ---- how spread out is it ----
      function renderSpread() {
        const d = diversification(portfolio, prices);
        if (!d) {
          $('spread').innerHTML = '<p class="empty">Buy something to get your diversification score.</p>';
          return;
        }
        const tone = d.score >= 75 ? 'high' : d.score >= 40 ? 'mid' : 'low';
        $('spread').innerHTML = `
          <div class="score-row"><span class="score-num ${tone}">${d.score}<small> / 100</small></span>
            <span class="score-label ${tone}">${d.label}</span></div>
          <div class="bar" role="img" aria-label="Diversification score ${d.score} out of 100"><div class="${tone}" style="width:${d.score}%"></div></div>
          <p class="tip"><b>Tip:</b> ${d.nudge}</p>
          <p class="note" style="margin-top:12px">More different companies and more sectors give a higher score. An index fund counts as lots of companies. Cash doesn't count.</p>`;
      }
      
      // ---- how bumpy is it ----
      const LEVEL_WORDS = {
        Calm: 'Calm: small moves, like an index fund.',
        Medium: 'Medium: some ups and downs, like one steady big company.',
        Bumpy: 'Bumpy: big swings. Exciting, but it can drop fast.',
      };
      
      function renderMoves() {
        const v = stocks && volatility(portfolio, stocks, forex);
        if (!v) {
          $('moves').innerHTML = "<p class='empty'>Buy something and you'll see how much it moves.</p>";
          return;
        }
        const spy = volatility({ holdings: { SPY: { quantity: 1 } } }, stocks, forex);
        const months = Math.round(v.days / 21);
        $('moves').innerHTML = `
          <p class="big">On a normal day, your shares go up or down by about <strong>${rupeesRound(v.dailyPaise)}</strong>.</p>
          <div class="levels">${['Calm', 'Medium', 'Bumpy'].map((l) => `<span class="${l}${l === v.level ? ' on' : ''}">${l}</span>`).join('')}</div>
          <ul class="moves-facts">
            <li>${LEVEL_WORDS[v.level]}</li>
            <li>That's about ${v.dailyPercent.toFixed(1)}% a day.${spy ? ` An S&P 500 fund moves about ${spy.dailyPercent.toFixed(1)}%.` : ''}</li>
            <li>Worst day in the last ${months} months: <span class="down">${signed(v.worst.paise)}</span> on ${formatDate(v.worst.date)}.</li>
          </ul>
          <p class="note" style="margin-top:12px">Worked out from how the shares you own today moved over the last ${v.days} trading days.</p>`;
      }
      
      function renderQuote() {
        const symbol = $('symbol').value;
        const price = prices[symbol];
        const held = portfolio.holdings[symbol];
        $('sell-all').hidden = !held;
        if (!price) { $('quote').textContent = ''; return; }
        const parts = [`1 share costs ${rupees(price)}`];
        const qty = parseShares();
        if (Number.isInteger(qty) && qty > 1) parts.push(`${qty} cost ${rupees(qty * price)}`);
        const v = value(portfolio, prices);
        parts.push(`you can buy up to ${Math.floor(Math.min(v.cashPaise, maxBuyPaise(v.totalPaise)) / price)} in one go`);
        if (held) parts.push(`you own ${shares(held.quantity)}, worth ${rupeesRound(Math.round(held.quantity * price))}`);
        $('quote').textContent = parts.join(' · ');
      }
      
      function parseShares() {
        const n = Number($('qty').value.replace(/[,\s]/g, ''));
        return Number.isFinite(n) ? n : NaN;
      }
      
      function say(text, good) {
        $('msg').textContent = text;
        $('msg').className = 'msg ' + (good ? 'good' : 'bad');
        $('msg').hidden = false;
      }
      
      // ---- placing orders ----
      function trade(side, { all = false } = {}) {
        const symbol = $('symbol').value;
        const pricePaise = prices[symbol];
        const held = portfolio.holdings[symbol];
        let quantity;
      
        if (all) {
          quantity = held?.quantity ?? 0;
        } else {
          quantity = parseShares();
          if (!(quantity > 0)) return say('Type how many shares you want to ' + side + ', like 2.', false);
        }
      
        const order = { symbol, quantity, pricePaise, date: priceDate };
        const result = side === 'buy' ? buy(portfolio, order, prices) : sell(portfolio, order);
        if (!result.ok) return say(result.reason, false);
      
        portfolio = result.portfolio;
        save();
        const t = portfolio.trades.at(-1);
        say(`${side === 'buy' ? 'Bought' : 'Sold'} ${shares(t.quantity)} ${byId[symbol]?.name ?? symbol} for ${rupees(t.totalPaise)}.`, true);
        $('qty').value = '';
        render();
      }
      
      $('order').addEventListener('submit', (e) => { e.preventDefault(); trade('buy'); });
      $('sell').addEventListener('click', () => trade('sell'));
      $('sell-all').addEventListener('click', () => trade('sell', { all: true }));
      $('symbol').addEventListener('change', () => { $('msg').hidden = true; renderQuote(); });
      $('qty').addEventListener('input', renderQuote);
      
      // A confirm step built into the page, so one stray tap can't wipe it all.
      const confirming = (on) => { $('reset').hidden = on; $('reset-yes').hidden = !on; $('reset-no').hidden = !on; };
      $('reset').addEventListener('click', () => confirming(true));
      $('reset-no').addEventListener('click', () => confirming(false));
      $('reset-yes').addEventListener('click', () => {
        portfolio = newPortfolio();
        save();
        confirming(false);
        say('Fresh start: ₹10,00,000 in cash.', true);
        render();
      });
      
      // ---- start up ----
      async function start() {
        showDataDate('/data/meta.json');
        try {
          [stocks, forex] = await Promise.all([
            fetch('/data/stocks.json', { cache: 'no-cache' }).then((r) => r.json()),
            fetch('/data/forex.json', { cache: 'no-cache' }).then((r) => r.json()),
          ]);
          prices = pricesInPaise(stocks, forex);
          priceDate = stocks.asOf ?? null;
        } catch (error) {
          console.error(error);
          say('Could not load prices, so trading is paused. Try again in a minute.', false);
          return;
        }
      
        // Something you own but have no price for today would break the totals, so say so.
        const missing = Object.keys(portfolio.holdings).filter((s) => !prices[s]);
        if (missing.length) {
          say(`No price today for ${missing.join(', ')}, so totals are paused. Check back after tonight's update.`, false);
          return;
        }
      
        $('symbol').innerHTML = ['<optgroup label="Index funds">', ...INSTRUMENTS.filter((i) => i.kind === 'fund'),
          '</optgroup><optgroup label="Companies">', ...INSTRUMENTS.filter((i) => i.kind === 'stock'), '</optgroup>']
          .map((i) => typeof i === 'string' ? i
            : prices[i.symbol] ? `<option value="${i.symbol}">${i.name} (${i.symbol})</option>` : '')
          .join('');
        for (const id of ['symbol', 'qty', 'buy', 'sell']) $(id).disabled = false;
      
        const charted = INSTRUMENTS.filter((i) => stocks.prices?.[i.symbol]?.history?.length > 1);
        $('chart-symbol').innerHTML = charted.map((i) => `<option value="${i.symbol}">${i.name} (${i.symbol})</option>`).join('');
        if (charted.some((i) => i.symbol === 'TSLA')) $('chart-symbol').value = 'TSLA';
        $('chart-symbol').disabled = !charted.length;
      
        // Created last: the page is fully drawn before the tutorial dims it.
        tutorial = mountTutorial({
          page: 'trade.html',
          getContext: () => ({ portfolio, prices, history: priceHistory(), guessDate, symbol: $('chart-symbol').value }),
          onChange: () => { portfolio = load(); $('msg').hidden = true; render(); renderPriceChart(); },
        });
        render();
        renderPriceChart();
        tutorial.refocus(); // the page has only just taken its final shape
      }
      
      start();
    })();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
