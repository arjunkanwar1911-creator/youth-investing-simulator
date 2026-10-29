import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSIONS, PROGRESS_KEY, WALLET_KEY, newProgress, isProgress, submitQuiz, completeMission, nextCard, skipMission,
  leaveTutorial, resumeTutorial, restart, earnedBadge, dots, walletMode, saveKeyFor, syncWallet, cardFacts,
  loadProgress, saveProgress, loadWallet, saveWallet,
} from '../lib/tutorial.js';
import { QUESTIONS } from '../lib/quiz.js';
import { newPortfolio, buy, PORTFOLIO_KEY, STARTING_CASH_PAISE } from '../lib/portfolio.js';
import { biggestDrop } from '../lib/risk.js';

// ---- things the tests are built from ----

// Round prices in paise, so the numbers are easy to check by hand.
const prices = { AAPL: 3000000, MSFT: 4000000, KO: 600000, SPY: 6000000, JNJ: 1500000, TSLA: 3500000 };

function own(...orders) {
  let p = newPortfolio();
  for (const [symbol, quantity] of orders) {
    const r = buy(p, { symbol, quantity, pricePaise: prices[symbol] }, prices);
    assert.equal(r.ok, true, r.reason);
    p = r.portfolio;
  }
  return p;
}

// Twelve days, newest first. The worst single day is 103 -> 90 on 5 October (about -12.6%).
const oldestFirst = [100, 101, 102, 103, 90, 91, 92, 93, 94, 95, 96, 97];
const history = oldestFirst.map((close, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, close })).reverse();
const WORST_DAY = '2026-10-05';

const plan = { startingAmount: 10000, monthlyTopUp: 2000, yearlyReturn: 0.08 };

/** For each mission, what the page would hand over once the learner has really done it. */
const doneContext = [
  { years: 20, plan },
  { portfolio: own(['SPY', 1]), prices },
  { portfolio: own(['AAPL', 2]), prices },
  { portfolio: own(['SPY', 3], ['AAPL', 2], ['JNJ', 4], ['KO', 10]), prices },
  { history, guessDate: WORST_DAY, symbol: 'TSLA' },
];
const nothingYet = { years: 5, plan, portfolio: newPortfolio(), prices, history, guessDate: null, symbol: 'TSLA' };

/** A learner part way through the missions. */
const at = (step, extra = {}) => ({ ...newProgress(), phase: 'missions', active: true, step, before: { correct: 2, total: 6 }, ...extra });
const wrongAnswers = QUESTIONS.map((q) => (q.answer + 1) % q.options.length);
const rightAnswers = QUESTIONS.map((q) => q.answer);

/** A stand-in for localStorage that remembers every key it was asked to write. */
function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  const writes = [];
  return {
    writes,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { writes.push(k); data.set(k, String(v)); },
    removeItem: (k) => { writes.push(k); data.delete(k); },
  };
}

// ---- you can't advance without doing the step ----

test('every mission refuses to finish until its step is done, and says what is missing', () => {
  MISSIONS.forEach((mission, step) => {
    const before = at(step);
    const r = completeMission(before, nothingYet);
    assert.equal(r.ok, false, mission.id);
    assert.ok(r.reason.length > 20, `${mission.id} should explain what to do`);
    assert.equal(r.progress, undefined);
    assert.equal(before.showCard, false);
    assert.equal(before.results[step], null);
  });
});

test('every mission finishes once the step is really done', () => {
  MISSIONS.forEach((mission, step) => {
    const r = completeMission(at(step), doneContext[step]);
    assert.equal(r.ok, true, `${mission.id}: ${r.reason}`);
    assert.equal(r.progress.showCard, true);
    assert.equal(r.progress.results[step], 'done');
    assert.equal(r.progress.step, step);
  });
});

test('the card cannot be moved past before the mission is done', () => {
  assert.equal(nextCard(at(0)).ok, false);
  assert.equal(completeMission(at(0, { showCard: true }), doneContext[0]).ok, false); // already done
});

test('mission 1: the slider has to reach 20 years, and stopping short is told how far', () => {
  assert.equal(completeMission(at(0), { years: 19 }).ok, false);
  assert.match(completeMission(at(0), { years: 12 }).reason, /12 years/);
  assert.equal(completeMission(at(0), { years: 20 }).ok, true);
});

test('mission 2: only an index fund counts, not a single company', () => {
  const stockOnly = completeMission(at(1), { portfolio: own(['AAPL', 1]), prices });
  assert.equal(stockOnly.ok, false);
  assert.match(stockOnly.reason, /single company/);
  assert.equal(completeMission(at(1), { portfolio: own(['SPY', 1]), prices }).ok, true);
});

test('mission 3: one company, at least 50,000 rupees, nothing else', () => {
  const small = completeMission(at(2), { portfolio: own(['AAPL', 1]), prices }); // 30,000
  assert.equal(small.ok, false);
  assert.match(small.reason, /₹30,000/);
  assert.equal(completeMission(at(2), { portfolio: own(['AAPL', 2]), prices }).ok, true); // 60,000
  const two = completeMission(at(2), { portfolio: own(['AAPL', 2], ['KO', 10]), prices });
  assert.equal(two.ok, false);
  assert.match(two.reason, /2 different things/);
  const fund = completeMission(at(2), { portfolio: own(['SPY', 1]), prices });
  assert.equal(fund.ok, false);
  assert.match(fund.reason, /lots of companies/);
});

test('mission 4: a green score is not enough without 3 sectors, and 3 sectors are not enough without a green score', () => {
  const oneSector = completeMission(at(3), { portfolio: own(['SPY', 3], ['AAPL', 2]), prices }); // score is high, but 1 sector
  assert.equal(oneSector.ok, false);
  assert.match(oneSector.reason, /1 sector\. Add 2 more sectors/);
  const noFund = completeMission(at(3), { portfolio: own(['AAPL', 2], ['JNJ', 4], ['KO', 10]), prices }); // 3 sectors, low score
  assert.equal(noFund.ok, false);
  assert.match(noFund.reason, /index fund/);
  assert.equal(completeMission(at(3), doneContext[3]).ok, true);
});

test('mission 5: tap the worst day or the dip around it (2 days before to 5 days after), nothing else counts', () => {
  const tap = (guessDate) => completeMission(at(4), { history, guessDate }).ok;
  assert.equal(tap(WORST_DAY), true);
  assert.equal(tap('2026-10-03'), true);  // 2 days before
  assert.equal(tap('2026-10-02'), false); // 3 days before
  assert.equal(tap('2026-10-08'), true);  // 3 days after: the bottom of a dip is usually a few days later
  assert.equal(tap('2026-10-10'), true);  // 5 days after
  assert.equal(tap('2026-10-11'), false); // 6 days after
  assert.equal(tap('2026-10-01'), false);
  assert.equal(tap('2026-11-30'), false); // not a day on this chart
  assert.equal(tap(null), false);
  assert.match(completeMission(at(4), { history, guessDate: null }).reason, /Pick a company/);
  assert.match(completeMission(at(4), { history, guessDate: '2026-10-12' }).reason, /Not quite/);
});

test('a mission needs the learner to be in the missions, not in a quiz or already done', () => {
  assert.equal(completeMission(newProgress(), doneContext[0]).ok, false);
  assert.equal(completeMission({ ...at(0), phase: 'done', after: { correct: 3, total: 6 } }, doneContext[0]).ok, false);
});

// ---- the whole walk through ----

test('starter quiz, 5 missions, final quiz: the flow in order, ending with a badge', () => {
  let p = newProgress();
  assert.equal(p.phase, 'before');
  assert.equal(p.active, false);

  const started = submitQuiz(p, wrongAnswers);
  assert.equal(started.ok, true);
  p = started.progress;
  assert.deepEqual([p.phase, p.active, p.step, p.before], ['missions', true, 0, { correct: 0, total: 6 }]);

  MISSIONS.forEach((mission, step) => {
    assert.equal(p.step, step);
    p = completeMission(p, doneContext[step]).progress;
    for (let card = 0; card < mission.cards.length; card++) {
      assert.equal(p.showCard, true);
      assert.equal(p.card, card);
      p = nextCard(p).progress;
    }
  });
  assert.deepEqual([p.phase, p.active], ['after', false]);
  assert.deepEqual(p.results, ['done', 'done', 'done', 'done', 'done']);

  p = submitQuiz(p, rightAnswers).progress;
  assert.equal(p.phase, 'done');
  assert.deepEqual(p.after, { correct: 6, total: 6 });
  assert.deepEqual(p.before, { correct: 0, total: 6 });
  assert.equal(earnedBadge(p), true);
});

test('a blank quiz is refused and leaves the learner where they were', () => {
  const start = newProgress();
  const r = submitQuiz(start, QUESTIONS.map(() => null));
  assert.equal(r.ok, false);
  assert.match(r.reason, /blank/);
  assert.equal(start.phase, 'before');
  assert.equal(start.before, null);
  assert.equal(submitQuiz(at(0), rightAnswers).ok, false); // no quiz to hand in mid-missions
});

test('mission 2 has a forex card after the index fund card', () => {
  assert.equal(MISSIONS[1].cards.length, 2);
  assert.match(MISSIONS[1].cards[1].text, /forex/);
  assert.match(MISSIONS[1].cards[1].text, /exchange rate/);
});

test('skipping a mission is allowed, is remembered, and means no badge', () => {
  let p = at(0);
  p = skipMission(p).progress;
  assert.deepEqual([p.step, p.showCard, p.results[0]], [1, false, 'skipped']);
  assert.deepEqual(dots(p), ['skipped', 'now', 'todo', 'todo', 'todo']);

  for (let i = 1; i < MISSIONS.length; i++) p = skipMission(p).progress;
  assert.equal(p.phase, 'after');
  p = submitQuiz(p, rightAnswers).progress;
  assert.equal(p.phase, 'done');
  assert.equal(earnedBadge(p), false);
  assert.equal(skipMission(newProgress()).ok, false); // nothing to skip in a quiz
});

test('skipping from the card keeps the mission marked done', () => {
  const p = skipMission(completeMission(at(0), doneContext[0]).progress).progress;
  assert.equal(p.results[0], 'done');
  assert.equal(p.step, 1);
});

test('leaving keeps your place and resuming picks it up; restart starts clean', () => {
  const mid = at(3, { results: ['done', 'done', 'skipped', null, null] });
  const left = leaveTutorial(mid);
  assert.equal(left.active, false);
  assert.equal(left.step, 3);
  assert.equal(left.phase, 'missions');
  assert.equal(resumeTutorial(left).active, true);
  assert.deepEqual(restart(), newProgress());
  assert.equal(leaveTutorial(newProgress()).active, false); // nothing to leave in a quiz
});

// ---- mission money is separate from the real portfolio ----

test('mission money is only used while the missions are on', () => {
  assert.notEqual(WALLET_KEY, PORTFOLIO_KEY);
  assert.equal(saveKeyFor(newProgress()), PORTFOLIO_KEY);                       // starter quiz
  assert.equal(saveKeyFor(at(2)), WALLET_KEY);                                  // playing a mission
  assert.equal(saveKeyFor(leaveTutorial(at(2))), PORTFOLIO_KEY);                // left the tutorial
  assert.equal(saveKeyFor({ ...at(0), phase: 'after', active: false }), PORTFOLIO_KEY);
  assert.equal(saveKeyFor({ ...at(0), phase: 'done', active: false, after: { correct: 1, total: 6 } }), PORTFOLIO_KEY);
  assert.equal(walletMode(at(2)), true);
  assert.equal(walletMode(newProgress()), false);
});

test('mission trades never touch the real portfolio', () => {
  const real = own(['KO', 5], ['MSFT', 2]);
  const realJson = JSON.stringify(real);
  const storage = fakeStorage({ [PORTFOLIO_KEY]: realJson });

  // Walk through every mission, trading in the practice wallet the way the page would.
  syncWallet(storage, at(0), at(1));
  let wallet = loadWallet(storage);
  assert.equal(wallet.cashPaise, STARTING_CASH_PAISE);          // practice money, not the real portfolio's cash
  assert.deepEqual(wallet.holdings, {});
  wallet = buy(wallet, { symbol: 'SPY', quantity: 1, pricePaise: prices.SPY }, prices).portfolio;
  saveWallet(storage, wallet);
  syncWallet(storage, at(1), at(2));
  wallet = buy(loadWallet(storage), { symbol: 'AAPL', quantity: 2, pricePaise: prices.AAPL }, prices).portfolio;
  saveWallet(storage, wallet);
  syncWallet(storage, at(2), at(3));
  syncWallet(storage, at(3), at(4));
  syncWallet(storage, at(4), { ...at(4), phase: 'after', active: false });

  assert.equal(storage.getItem(PORTFOLIO_KEY), realJson);       // byte for byte the same
  assert.ok(!storage.writes.includes(PORTFOLIO_KEY), 'nothing was ever written to the real portfolio key');
  assert.ok(storage.writes.every((k) => k === WALLET_KEY), 'only the practice wallet was written');
});

test('the progress saver never writes to the real portfolio either', () => {
  const storage = fakeStorage({ [PORTFOLIO_KEY]: 'real' });
  saveProgress(storage, at(1));
  syncWallet(storage, newProgress(), at(1));
  assert.deepEqual([...new Set(storage.writes)].sort(), [PROGRESS_KEY, WALLET_KEY].sort());
  assert.equal(storage.getItem(PORTFOLIO_KEY), 'real');
});

test('a fresh 10 lakh wallet for missions 2 and 3, kept for mission 4, thrown away at the end', () => {
  const storage = fakeStorage();
  const withShares = (...o) => saveWallet(storage, own(...o));
  const shares = () => Object.keys(loadWallet(storage).holdings);

  withShares(['MSFT', 1]);                       // leftovers from an earlier try
  syncWallet(storage, at(0), at(1));
  assert.deepEqual(shares(), []);                // mission 2 starts clean

  withShares(['SPY', 1]);
  syncWallet(storage, at(1), at(2));
  assert.deepEqual(shares(), []);                // mission 3 starts clean again, so the score can go red

  withShares(['AAPL', 2]);
  syncWallet(storage, at(2), at(3));
  assert.deepEqual(shares(), ['AAPL']);          // mission 4 builds on mission 3

  syncWallet(storage, at(3), leaveTutorial(at(3)));
  assert.deepEqual(shares(), ['AAPL']);          // leaving does not wipe it; resuming carries on
  syncWallet(storage, leaveTutorial(at(3)), resumeTutorial(at(3)));
  assert.deepEqual(shares(), ['AAPL']);

  syncWallet(storage, at(4), { ...at(4), phase: 'after', active: false });
  assert.equal(storage.getItem(WALLET_KEY), null); // tutorial over
  assert.deepEqual(loadWallet(storage), newPortfolio());
  assert.equal(loadWallet(storage).cashPaise, STARTING_CASH_PAISE);
});

test('starting over mid-tutorial also puts the wallet back to 10 lakh', () => {
  const storage = fakeStorage();
  saveWallet(storage, own(['AAPL', 2]));
  syncWallet(storage, at(3), restart());
  assert.deepEqual(loadWallet(storage), newPortfolio());
});

// ---- progress survives a reload ----

test('progress survives a reload, mid-mission and mid-card', () => {
  const storage = fakeStorage();
  const reload = () => loadProgress(storage); // a new page load reads from the same storage

  let p = submitQuiz(newProgress(), wrongAnswers).progress;
  saveProgress(storage, p);
  assert.deepEqual(reload(), p);

  p = completeMission(nextCard(completeMission(p, doneContext[0]).progress).progress, doneContext[1]).progress; // mission 2 done, first card showing
  saveProgress(storage, p);
  assert.deepEqual(reload(), p);
  assert.deepEqual([reload().step, reload().showCard, reload().card], [1, true, 0]);

  p = nextCard(reload()).progress;               // on to the forex card
  saveProgress(storage, p);
  assert.deepEqual([reload().step, reload().card], [1, 1]);
  assert.deepEqual(reload().results, ['done', 'done', null, null, null]);
  assert.deepEqual(reload().before, { correct: 0, total: 6 });

  p = nextCard(reload()).progress;               // and out of the card into mission 3
  assert.deepEqual([p.step, p.showCard], [2, false]);
});

test('the finished tutorial, with both scores and the badge, survives a reload', () => {
  const storage = fakeStorage();
  let p = submitQuiz(newProgress(), wrongAnswers).progress;
  MISSIONS.forEach((m, step) => {
    p = completeMission(p, doneContext[step]).progress;
    for (let i = 0; i < m.cards.length; i++) p = nextCard(p).progress;
  });
  p = submitQuiz(p, rightAnswers).progress;
  saveProgress(storage, p);
  const back = loadProgress(storage);
  assert.deepEqual(back, p);
  assert.equal(earnedBadge(back), true);
  assert.deepEqual([back.before.correct, back.after.correct], [0, 6]);
});

test('damaged, tampered or blocked storage starts fresh instead of breaking', () => {
  assert.deepEqual(loadProgress(fakeStorage({ [PROGRESS_KEY]: '{not json' })), newProgress());
  assert.deepEqual(loadProgress(fakeStorage()), newProgress());
  assert.deepEqual(loadProgress(fakeStorage({ [PROGRESS_KEY]: JSON.stringify({ ...at(0), step: 9 }) })), newProgress());
  assert.deepEqual(loadProgress(fakeStorage({ [PROGRESS_KEY]: JSON.stringify({ ...at(0), results: ['done', 'cheated', null, null, null] }) })), newProgress());
  assert.deepEqual(loadWallet(fakeStorage({ [WALLET_KEY]: '[]' })), newPortfolio());
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadProgress(blocked), newProgress());
  assert.doesNotThrow(() => { saveProgress(blocked, at(0)); saveWallet(blocked, newPortfolio()); syncWallet(blocked, at(0), at(1)); });
});

test('only sensible progress is accepted', () => {
  assert.equal(isProgress(newProgress()), true);
  assert.equal(isProgress(at(2)), true);
  assert.equal(isProgress(null), false);
  assert.equal(isProgress({ ...at(0), showCard: true, card: 1 }), false);     // mission 1 has only one card
  assert.equal(isProgress({ ...newProgress(), phase: 'missions' }), false);   // missions without a starter score
  assert.equal(isProgress({ ...newProgress(), phase: 'done', before: { correct: 1, total: 6 } }), false); // done without a final score
  assert.equal(isProgress({ ...at(0), before: { correct: 7, total: 6 } }), false);
});

// ---- the little facts on the cards ----

test('card facts: the numbers on the cards come from what the learner did', () => {
  const years = cardFacts(0, doneContext[0]);
  const [five, twenty] = [...years.matchAll(/₹([\d,]+)/g)].map((m) => Number(m[1].replaceAll(',', '')));
  assert.ok(five > 0 && twenty > five * 3, years);
  assert.match(cardFacts(2, doneContext[2]), /score is 0 out of 100: Not spread out/);
  assert.match(cardFacts(3, doneContext[3]), /Well spread/);
  const swing = cardFacts(4, doneContext[4]);
  assert.match(swing, /Tesla/);
  assert.match(swing, /12\.6%/);
  assert.match(swing, /5 October 2026/);
  assert.equal(cardFacts(1, doneContext[1]), null);
});

// ---- the biggest drop in a history ----

test('biggestDrop finds the worst single day', () => {
  const worst = biggestDrop(history);
  assert.equal(worst.date, WORST_DAY);
  assert.ok(Math.abs(worst.percent - (90 / 103 - 1) * 100) < 1e-9);
});

test('biggestDrop copes with too little or damaged history', () => {
  assert.equal(biggestDrop([]), null);
  assert.equal(biggestDrop([{ date: '2026-10-01', close: 5 }]), null);
  assert.equal(biggestDrop(undefined), null);
  const broken = [{ date: 'c', close: 50 }, { date: 'b', close: null }, { date: 'a', close: 100 }];
  assert.equal(biggestDrop(broken), null); // no two good days next to each other
  assert.equal(biggestDrop([{ date: 'b', close: 110 }, { date: 'a', close: 100 }]).percent > 0, true); // a rise is still the "worst" of one
});
