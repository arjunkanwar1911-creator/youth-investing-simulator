'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';
import { loadChart } from '../load-chart';

export default function PageClient({ html }) {
  useEffect(() => {
    (async () => {
      await loadChart();
      
      const { project, costOfWaiting, toMoney } = await import('../../lib/compound.js');
      const { showDataDate } = await import('../../lib/asof.js');
      const { mountTutorial } = await import('../../lib/tutorial-ui.js');
      const { START_YEARS } = await import('../../lib/tutorial.js');
      
      showDataDate('/data/meta.json');
      
      const DELAY_YEARS = 5;
      const BLUE = '#2563EB';
      const AMBER = '#D97706';
      const INK_MUTED = '#5A6578';
      const GRID = '#F1F4F8';
      
      const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
      const money = (n) => '₹' + inr.format(Math.round(n));
      
      // Big numbers are hard to feel. "₹1.2 crore" lands; "₹12,04,55,120" doesn't.
      function readable(n) {
        if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2).replace(/\.00$/, '') + ' crore';
        if (n >= 100000) return '₹' + (n / 100000).toFixed(2).replace(/\.00$/, '') + ' lakh';
        return money(n);
      }
      
      // Name each line at its own end. The legend above covers narrow screens, where
      // there isn't room for this without labels landing on top of each other.
      const directLabels = {
        id: 'directLabels',
        afterDatasetsDraw(chart) {
          const { ctx, chartArea } = chart;
          if (chartArea.right - chartArea.left < 360) return;
      
          ctx.save();
          ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'right';
      
          chart.data.datasets.forEach((dataset, i) => {
            const points = chart.getDatasetMeta(i).data
              .filter((_, idx) => dataset.data[idx] !== null && dataset.data[idx] !== undefined);
            const last = points.at(-1);
            if (!last) return;
      
            const text = dataset.label;
            const width = ctx.measureText(text).width;
            const x = last.x - 8;
            const y = last.y + (i === 0 ? -15 : 17);
      
            // A soft pill keeps the text readable where it crosses a line or a fill.
            ctx.fillStyle = 'rgba(255,255,255,.9)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x - width - 20, y - 10, width + 26, 20, 10);
            else ctx.rect(x - width - 20, y - 10, width + 26, 20);
            ctx.fill();
      
            ctx.fillStyle = dataset.borderColor;   // the mark carries identity
            ctx.beginPath();
            ctx.arc(x - width - 9, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
      
            ctx.fillStyle = '#3D4759';             // the text stays ink
            ctx.fillText(text, x, y);
          });
      
          ctx.restore();
        },
      };
      
      const el = (id) => document.getElementById(id);
      const inputs = {
        start: el('start'), topup: el('topup'), rate: el('rate'), years: el('years'),
      };
      
      let chart;
      
      function buildChart(labels, onTime, delayed) {
        const shared = {
          borderWidth: 2, tension: .25, pointRadius: 0,
          pointHoverRadius: 8, pointHoverBorderWidth: 2, pointHoverBorderColor: '#fff',
          spanGaps: false,
        };
      
        const data = {
          labels,
          datasets: [
            { label: 'Started now', data: onTime, borderColor: BLUE,
              backgroundColor: 'rgba(37,99,235,.07)', fill: true,
              pointHoverBackgroundColor: BLUE, ...shared },
            { label: 'Started 5 years later', data: delayed, borderColor: AMBER,
              backgroundColor: 'transparent', fill: false,
              pointHoverBackgroundColor: AMBER, ...shared },
          ],
        };
      
        const options = {   // read once, when the chart is created
          responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 6, top: 10 } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },          // drawn in HTML above, so it never clips
            tooltip: {
              backgroundColor: '#0F172A', padding: 11, cornerRadius: 8,
              titleFont: { size: 13, weight: '700' }, bodyFont: { size: 13 },
              displayColors: true, boxWidth: 9, boxHeight: 9, boxPadding: 4, usePointStyle: false,
              callbacks: {
                title: (items) => 'Year ' + items[0].label,
                label: (item) => ' ' + item.dataset.label + ': ' + money(item.parsed.y),
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { color: '#E3E8EF' },
              ticks: { color: INK_MUTED, font: { size: 12 }, maxRotation: 0, autoSkipPadding: 18 },
              title: { display: true, text: 'Years from now', color: INK_MUTED, font: { size: 12 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: GRID, drawTicks: false },
              border: { display: false },
              ticks: {
                color: INK_MUTED, font: { size: 12 }, padding: 8,
                callback: (v) => v >= 10000000 ? (v / 10000000) + 'cr'
                               : v >= 100000  ? (v / 100000) + 'L'
                               : v >= 1000    ? (v / 1000) + 'k' : v,
              },
            },
          },
        };
      
        // The chart is the garnish; the numbers are the meal. If the chart library is
        // blocked, offline, or throws, say so and point at the table — never blank out.
        const giveUp = (why) => {
          console.error('Chart unavailable:', why);
          el('chart').hidden = true;
          el('chart-fallback').hidden = false;
          el('table-box').hidden = false;
          el('table-toggle').textContent = 'Hide the numbers';
          el('table-toggle').setAttribute('aria-expanded', 'true');
        };
      
        if (typeof Chart === 'undefined') return giveUp('the Chart.js script did not load');
      
        try {
          if (chart) {
            chart.data = data;
            chart.update();
          } else {
            chart = new Chart(el('chart'), {
              type: 'line', data, options, plugins: [directLabels],
            });
          }
        } catch (err) {
          chart = null;
          giveUp(err);
        }
      }
      
      function render() {
        const options = {
          startingAmount: Number(inputs.start.value),
          monthlyTopUp: Number(inputs.topup.value),
          yearlyReturn: Number(inputs.rate.value) / 100,
          years: Number(inputs.years.value),
        };
      
        // Echo the sliders back in words.
        el('start-out').textContent = money(options.startingAmount);
        el('topup-out').textContent = money(options.monthlyTopUp);
        el('rate-out').textContent = inputs.rate.value + '%';
        el('years-out').innerHTML = options.years + ' <small>year' + (options.years === 1 ? '' : 's') + '</small>';
      
        const waiting = costOfWaiting(options, DELAY_YEARS);
        const { onTime, delayed } = waiting;
      
        el('final').textContent = readable(onTime.finalValue);
        el('final-sub').textContent =
          money(toMoney(onTime.finalValue)) + ' after ' + options.years +
          (options.years === 1 ? ' year' : ' years') + ' at ' + inputs.rate.value + '% a year.';
      
        el('contributed').textContent = readable(onTime.totalContributed);
        el('growth').textContent = readable(onTime.totalGrowth);
      
        const multiple = onTime.totalContributed > 0
          ? onTime.totalGrowth / onTime.totalContributed : 0;
        el('growth-note').textContent = multiple > 0
          ? 'For every ₹1 you put in, the market added ₹' + multiple.toFixed(2) + '.'
          : 'Money the money made.';
      
        el('cost').textContent = readable(waiting.difference);
        el('cost-note').textContent = options.years <= DELAY_YEARS
          ? 'Waiting five years out of ' + options.years + ' means never starting at all — '
            + 'all you would have is the ' + money(options.startingAmount) + ' you began with.'
          : 'Same monthly habit, same return — just five fewer years of it. That is '
            + waiting.percentLost.toFixed(0) + '% of the pot, gone.';
      
        // Build the two lines. The late starter's years are shifted right so both
        // people finish on the same day.
        const labels = onTime.yearly.map((row) => row.year);
        const onTimeLine = onTime.yearly.map((row) => toMoney(row.value));
        const delayedLine = labels.map((year) => {
          if (year < DELAY_YEARS) return null;
          const row = delayed.yearly[year - DELAY_YEARS];
          return row ? toMoney(row.value) : null;
        });
      
        el('table-body').innerHTML = labels.map((year, i) => `<tr>
          <td>${year}</td>
          <td>${money(onTime.yearly[i].contributed)}</td>
          <td>${money(onTimeLine[i])}</td>
          <td>${delayedLine[i] === null ? '&mdash;' : money(delayedLine[i])}</td>
        </tr>`).join('');
      
        el('lesson').innerHTML = options.years > DELAY_YEARS
          ? `Both people save <strong>${money(options.monthlyTopUp)} a month</strong> and both earn
             <strong>${inputs.rate.value}% a year</strong>. The only difference is that one started
             five years earlier. Those five years are worth <strong>${readable(waiting.difference)}</strong>
             &mdash; more than the
             <strong>${money(options.monthlyTopUp * 12 * DELAY_YEARS)}</strong> of extra savings they
             explain, because the earliest money had the longest to grow. Time in the market beats
             timing the market.`
          : `Stretch the years slider past ${DELAY_YEARS} to see what waiting costs. Compounding needs
             time before it has anything to show you.`;
      
        // Last, on purpose. Everything above has already painted by now.
        buildChart(labels, onTimeLine, delayedLine);
      }
      
      Object.values(inputs).forEach((input) => input.addEventListener('input', render));
      
      // ---- the guided tutorial (mission 1 happens here) ----
      let tutorial = null;
      inputs.years.addEventListener('input', () => tutorial?.check());
      
      const toggle = el('table-toggle');
      toggle.addEventListener('click', () => {
        const showing = !el('table-box').hidden;
        el('table-box').hidden = showing;
        toggle.setAttribute('aria-expanded', String(!showing));
        toggle.textContent = showing ? 'Show the numbers' : 'Hide the numbers';
      });
      
      render();
      
      tutorial = mountTutorial({
        page: 'calculator.html',
        getContext: () => ({
          years: Number(inputs.years.value),
          plan: { startingAmount: Number(inputs.start.value), monthlyTopUp: Number(inputs.topup.value), yearlyReturn: Number(inputs.rate.value) / 100 },
        }),
        // Mission 1 starts with the slider at 5 years, so there is somewhere to drag it from.
        prepare: () => { inputs.years.value = START_YEARS; inputs.years.dispatchEvent(new Event('input')); },
      });
    })();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
