// Every page has to say how fresh its numbers are. This is the one place that
// decides how that sentence reads, so it can never drift between pages.

/** 2026-10-09 -> "9 October 2026" */
export function formatDate(iso) {
  if (!iso) return 'unknown';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Fill every element carrying `data-asof` with the date of the latest prices.
 * Markets close at weekends, so this is usually a day or three behind today.
 */
export async function showDataDate(dataPath = './data/meta.json') {
  const targets = document.querySelectorAll('[data-asof]');
  if (!targets.length) return null;

  try {
    const response = await fetch(dataPath, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const meta = await response.json();
    const text = `Data as of ${formatDate(meta.asOf)}`;
    targets.forEach((el) => { el.textContent = text; });
    return meta;
  } catch (error) {
    console.error('Could not read the data date:', error);
    targets.forEach((el) => { el.textContent = 'Data date unavailable'; });
    return null;
  }
}
