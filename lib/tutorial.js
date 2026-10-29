// The guided tutorial: 5 missions played inside the real app.
//
// This file is only the rules: what each mission asks for, when it counts as
// done, what the learner has finished, and where it is saved. It knows nothing
// about the page. The page code in tutorial-ui.js draws the dimmed screen and
// the coach card from whatever this says.
//
// Every function that changes progress returns a NEW progress object, the same
// way portfolio.js does, so the page can simply save what comes out.
//
// Mission money is a separate wallet under its own key. The real portfolio key
// is only ever *named* here (saveKeyFor), never written.

import { findInstrument } from './universe.js';
import { newPortfolio, isPortfolio, value, PORTFOLIO_KEY } from './portfolio.js';
import { diversification, biggestDrop } from './risk.js';
import { project } from './compound.js';
import { formatDate } from './asof.js';
import { scoreQuiz } from './quiz.js';

export const PROGRESS_KEY = 'yis.tutorial.progress.v1';
export const WALLET_KEY = 'yis.tutorial.wallet.v1';

export const START_YEARS = 5;          // mission 1 starts the slider here
export const TARGET_YEARS = 20;        // ...and is done when it gets here
const ONE_STOCK_PAISE = 50000 * 100;   // mission 3: about 50,000 rupees in one company
const GREEN_FROM = 75;                 // same line the trade page uses for a green score
const SECTORS_NEEDED = 3;              // mission 4
// Mission 5: tapping a thin line is fiddly, and the lowest point of a dip comes a few days after
// its worst day, which is where people naturally tap. So a tap anywhere on the dip counts.
const TAP_DAYS_BEFORE = 2;
const TAP_DAYS_AFTER = 5;

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupees = (paise) => '₹' + inr0.format(Math.round(paise / 100));
const plural = (n, one, many) => (n === 1 ? one : many);

/** What the learner owns in their mission wallet, one row per holding. */
function rowsOf(ctx) {
  if (!ctx?.portfolio || !ctx?.prices) return [];
  try { return value(ctx.portfolio, ctx.prices).rows; } catch { return []; } // a missing price: treat as nothing to judge yet
}
const kindOf = (symbol) => findInstrument(symbol)?.kind;
const stockSectors = (rows) => new Set(rows.filter((r) => kindOf(r.symbol) === 'stock').map((r) => findInstrument(r.symbol).sector));

// `target` is what stays lit and clickable while the learner does the step;
// `cardTarget` is what stays lit while the explanation card is open.
export const MISSIONS = [
  {
    id: 'time',
    page: 'calculator.html',
    title: 'Time does the work',
    goal: 'Drag "For how long" from 5 years to 20 years.',
    target: ['[data-tut="years"]'],
    cardTarget: ['#final'],
    freshWallet: false,
    done: (ctx) => ctx?.years >= TARGET_YEARS,
    hint: (ctx) => (ctx?.years > START_YEARS
      ? `It is at ${ctx.years} years. Keep dragging right until it says ${TARGET_YEARS}.`
      : `Drag the "For how long" slider to the right, from ${START_YEARS} to ${TARGET_YEARS} years.`),
    cards: [{
      title: 'Time does the work',
      text: 'Same money, more time, much more growth. This is compound interest: your growth starts earning growth of its own, so the later years add far more than the early ones.',
    }],
  },
  {
    id: 'fund',
    page: 'trade.html',
    title: 'One share, many companies',
    goal: 'Buy 1 share of an index fund.',
    target: ['#order'],
    cardTarget: ['#owned'],
    freshWallet: true,
    done: (ctx) => rowsOf(ctx).some((r) => kindOf(r.symbol) === 'fund'),
    hint: (ctx) => (rowsOf(ctx).length
      ? 'That is a single company. An index fund has a name like "S&P 500" or "entire US stock market". Pick one in the "What" box.'
      : 'Open the "What" box, pick an index fund (try the S&P 500), type 1 and tap Buy.'),
    cards: [
      {
        title: 'One share, many companies',
        text: 'An index fund is a basket that holds hundreds of companies. One share means a slice of all of them, so if one does badly, the others hold you up.',
      },
      {
        title: 'Where the dollars come in',
        text: 'You paid in rupees, but this fund is priced in US dollars, so the app swapped rupees for dollars at the exchange rate. That swap is called forex, short for foreign exchange. If the dollar gets pricier in rupees, your share is worth more rupees even though its dollar price did not move. If the dollar gets cheaper, it works the other way.',
      },
    ],
  },
  {
    id: 'concentration',
    page: 'trade.html',
    title: 'All in one company',
    goal: 'Put about ₹50,000 into one single company, and nothing else.',
    target: ['#order', '#spread'],
    cardTarget: ['#spread'],
    freshWallet: true,
    done: (ctx) => {
      const rows = rowsOf(ctx);
      return rows.length === 1 && kindOf(rows[0].symbol) === 'stock' && rows[0].valuePaise >= ONE_STOCK_PAISE;
    },
    hint: (ctx) => {
      const rows = rowsOf(ctx);
      if (!rows.length) return 'Pick one company in the "What" box and type enough shares that the cost under it is about ₹50,000 or more.';
      if (rows.length > 1) return `You own ${rows.length} different things. For this mission use just one company. "Sell all of it" clears the extras.`;
      if (kindOf(rows[0].symbol) !== 'stock') return 'An index fund is lots of companies. Pick one single company instead.';
      return `You have ${rupees(rows[0].valuePaise)} in it. Buy more shares until it reaches ₹50,000.`;
    },
    cards: [{
      title: 'All your eggs in one basket',
      text: 'Your score is red because everything rides on one company. That is concentration risk: if that company has a bad day, most of your money has a bad day too.',
    }],
  },
  {
    id: 'spread',
    page: 'trade.html',
    title: 'Spread it out',
    goal: 'Spread across 3 sectors, with an index fund, until the score turns green.',
    target: ['#order', '#spread'],
    cardTarget: ['#spread'],
    freshWallet: false,
    done: (ctx) => {
      const rows = rowsOf(ctx);
      const d = rows.length ? diversification(ctx.portfolio, ctx.prices) : null;
      return !!d && d.score >= GREEN_FROM && stockSectors(rows).size >= SECTORS_NEEDED;
    },
    hint: (ctx) => {
      const rows = rowsOf(ctx);
      const sectors = stockSectors(rows).size;
      const d = rows.length ? diversification(ctx.portfolio, ctx.prices) : null;
      if (sectors < SECTORS_NEEDED) {
        const more = SECTORS_NEEDED - sectors;
        return `Your shares cover ${sectors} ${plural(sectors, 'sector', 'sectors')}. Add ${more} more ${plural(more, 'sector', 'sectors')}. The "Sector" tab on the ring shows which sector each company is in.`;
      }
      if (!rows.some((r) => kindOf(r.symbol) === 'fund')) return 'An index fund holds hundreds of companies, so adding one lifts the score the most.';
      return `Your score is ${d?.score ?? 0}. It turns green at ${GREEN_FROM}, so spread a little more.`;
    },
    cards: [{
      title: 'Now it turns green',
      text: 'A sector is a kind of business, like technology or healthcare. Different sectors, plus an index fund, do not all fall at the same time. That is diversification: spreading your money so no one thing can sink you.',
    }],
  },
  {
    id: 'swings',
    page: 'trade.html',
    title: 'Swings are normal',
    goal: 'Find the biggest one-day drop in a company\'s last 120 days and tap it on the line.',
    target: ['#history-chart-section'],
    cardTarget: ['#history-chart-section'],
    freshWallet: false,
    done: (ctx) => {
      const worst = biggestDrop(ctx?.history);
      if (!worst || !ctx.guessDate) return false;
      const dates = ctx.history.map((h) => h.date);
      const at = dates.indexOf(worst.date);
      const tapped = dates.indexOf(ctx.guessDate);
      // dates are newest first, so a later day has a smaller index
      return tapped >= 0 && tapped - at >= -TAP_DAYS_AFTER && tapped - at <= TAP_DAYS_BEFORE;
    },
    hint: (ctx) => (ctx?.guessDate
      ? 'Not quite. Look for the steepest fall in a single day and tap on it, or just after it. The note under the chart shows how far the tapped day moved.'
      : 'Pick a company, then tap the day on the line where the price fell the most in one day.'),
    cards: [{
      title: 'Swings are normal',
      text: 'Even strong companies have bad days. A drop is only a loss on paper until you sell. Selling in a panic locks the loss in, and you miss any recovery that follows.',
    }],
  },
];

/**
 * One extra line for a mission's card, worked out from what the learner just did
 * (or null). ctx is the same object the page hands to completeMission.
 */
export function cardFacts(step, ctx) {
  if (step === 0 && ctx?.plan) {
    const at = (years) => project({ ...ctx.plan, years }).finalValue;
    return `With your other sliders, ${START_YEARS} years ends at ${rupees(at(START_YEARS) * 100)} and ${TARGET_YEARS} years ends at ${rupees(at(TARGET_YEARS) * 100)}.`;
  }
  if (step === 2 || step === 3) {
    const rows = rowsOf(ctx);
    const d = rows.length ? diversification(ctx.portfolio, ctx.prices) : null;
    return d ? `Your diversification score is ${d.score} out of 100: ${d.label}.` : null;
  }
  if (step === 4) {
    const worst = biggestDrop(ctx?.history);
    if (!worst) return null;
    const name = findInstrument(ctx.symbol)?.name ?? ctx.symbol ?? 'This company';
    return `${name}'s biggest one-day drop was ${Math.abs(worst.percent).toFixed(1)}% on ${formatDate(worst.date)}.`;
  }
  return null;
}

// ---- progress ----

/**
 * phase   'before' (starter quiz) -> 'missions' -> 'after' (same quiz) -> 'done'
 * active  true while the dimmed overlay and mission wallet are on. "Leave the
 *         tutorial" turns it off without losing the place.
 * step    which mission, 0 to 4
 * showCard / card  the explanation card after a mission is done, and which one
 * results one of null / 'done' / 'skipped' for each mission
 */
export function newProgress() {
  return { version: 1, phase: 'before', active: false, step: 0, showCard: false, card: 0, results: MISSIONS.map(() => null), before: null, after: null };
}

const validScore = (s) => s === null || (!!s && Number.isInteger(s.correct) && Number.isInteger(s.total) && s.total > 0 && s.correct >= 0 && s.correct <= s.total);

/** Is this something we can save and load back safely? */
export function isProgress(p) {
  return !!p && p.version === 1 && ['before', 'missions', 'after', 'done'].includes(p.phase) &&
    typeof p.active === 'boolean' && Number.isInteger(p.step) && p.step >= 0 && p.step < MISSIONS.length &&
    typeof p.showCard === 'boolean' && Number.isInteger(p.card) && p.card >= 0 &&
    (!p.showCard || p.card < MISSIONS[p.step].cards.length) &&
    Array.isArray(p.results) && p.results.length === MISSIONS.length && p.results.every((r) => [null, 'done', 'skipped'].includes(r)) &&
    validScore(p.before) && validScore(p.after) &&
    (p.phase === 'before' ? p.before === null : p.before !== null) &&
    (p.phase === 'done' ? p.after !== null : true);
}

const fail = (reason) => ({ ok: false, reason });
const inMissions = (p) => p.phase === 'missions';

/** The starter quiz moves you into the missions; the final quiz finishes the tutorial. */
export function submitQuiz(progress, answers) {
  if (progress.phase !== 'before' && progress.phase !== 'after') return fail('There is no quiz to hand in right now.');
  const score = scoreQuiz(answers);
  if (!score.ok) return fail(score.reason);
  const saved = { correct: score.correct, total: score.total };
  return progress.phase === 'before'
    ? { ok: true, progress: { ...progress, phase: 'missions', active: true, step: 0, showCard: false, card: 0, before: saved }, score }
    : { ok: true, progress: { ...progress, phase: 'done', active: false, after: saved }, score };
}

/**
 * The learner says "I did it". Only works if the step really is done in `ctx`;
 * otherwise nothing changes and the reason is a hint about what is missing.
 */
export function completeMission(progress, ctx) {
  if (!inMissions(progress) || progress.showCard) return fail('There is no mission waiting to be finished.');
  const mission = MISSIONS[progress.step];
  if (!mission.done(ctx)) return fail(mission.hint(ctx));
  const results = progress.results.slice();
  results[progress.step] = 'done';
  return { ok: true, progress: { ...progress, results, showCard: true, card: 0 } };
}

/** Next card, or on to the next mission (or the final quiz) after the last card. */
export function nextCard(progress) {
  if (!inMissions(progress) || !progress.showCard) return fail('There is no card to move past.');
  if (progress.card + 1 < MISSIONS[progress.step].cards.length) return { ok: true, progress: { ...progress, card: progress.card + 1 } };
  return { ok: true, progress: moveOn(progress) };
}

/** Skip this mission. It stays marked "skipped", so the badge stays unearned. */
export function skipMission(progress) {
  if (!inMissions(progress)) return fail('There is no mission to skip.');
  const results = progress.results.slice();
  if (!progress.showCard) results[progress.step] = 'skipped';
  return { ok: true, progress: moveOn({ ...progress, results }) };
}

function moveOn(progress) {
  const step = progress.step + 1;
  return step >= MISSIONS.length
    ? { ...progress, phase: 'after', active: false, showCard: false, card: 0 }
    : { ...progress, step, showCard: false, card: 0 };
}

export const leaveTutorial = (progress) => (inMissions(progress) ? { ...progress, active: false } : progress);
export const resumeTutorial = (progress) => (inMissions(progress) ? { ...progress, active: true } : progress);
export const restart = () => newProgress();

/** The badge is for doing all 5 missions, not skipping any. */
export const earnedBadge = (progress) => progress.phase === 'done' && progress.results.every((r) => r === 'done');

/** For the progress dots: 'done', 'skipped', 'now' or 'todo' for each mission. */
export function dots(progress) {
  return progress.results.map((r, i) => r ?? (inMissions(progress) && i === progress.step ? 'now' : 'todo'));
}

// ---- which wallet is in use ----

/** Mission money is only used while the overlay is on. */
export const walletMode = (progress) => inMissions(progress) && progress.active;

/** The save key the trade page must use right now. The tutorial never returns anything but these two. */
export const saveKeyFor = (progress) => (walletMode(progress) ? WALLET_KEY : PORTFOLIO_KEY);

/**
 * Called after every change of progress. Gives a clean ₹10,00,000 wallet when a
 * mission needs one, and throws the wallet away when the tutorial is over (or
 * restarted), so the next time it is ₹10,00,000 again.
 */
export function syncWallet(storage, before, after) {
  if (inMissions(after) && MISSIONS[after.step].freshWallet && (!inMissions(before) || before.step !== after.step)) {
    saveWallet(storage, newPortfolio());
  } else if (!inMissions(after) && inMissions(before)) {
    clearWallet(storage);
  }
}

// ---- saving in the browser ----

/** localStorage if it works, otherwise a plain in-memory stand-in (private windows can block it). */
export function browserStorage() {
  try {
    const probe = '__yis_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
  }
}

export function loadProgress(storage) {
  try {
    const saved = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (isProgress(saved)) return saved;
  } catch { /* nothing saved, or damaged: start fresh */ }
  return newProgress();
}
export function saveProgress(storage, progress) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* not fatal */ }
}

export function loadWallet(storage) {
  try {
    const saved = JSON.parse(storage.getItem(WALLET_KEY));
    if (isPortfolio(saved)) return saved;
  } catch { /* nothing saved, or damaged: a fresh wallet */ }
  return newPortfolio();
}
export function saveWallet(storage, wallet) {
  try { storage.setItem(WALLET_KEY, JSON.stringify(wallet)); } catch { /* not fatal */ }
}
export function clearWallet(storage) {
  try { storage.removeItem(WALLET_KEY); } catch { /* not fatal */ }
}
