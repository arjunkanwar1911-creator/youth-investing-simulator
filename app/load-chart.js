// Chart.js is the drawing library for our charts. It comes from the same web address as before.
const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.1/chart.umd.min.js';

/** Resolves when Chart.js is ready. If it fails to load, resolves anyway: the pages already cope without charts. */
export function loadChart() {
  return new Promise((resolve) => {
    if (window.Chart) return resolve();
    const script = document.createElement('script');
    script.src = CHART_URL;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}
