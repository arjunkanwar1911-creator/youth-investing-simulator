// Draws the tutorial on top of a real page: dims everything except the control
// the mission is about, shows a coach card at the bottom, and moves on only when
// tutorial.js says the step is really done.
//
// The rules live in tutorial.js (and are tested there). This file is just the
// screen. A page hands over a `getContext()` that describes what the learner has
// done so far, and calls `check()` whenever that might have changed.

import {
  MISSIONS, loadProgress, saveProgress, completeMission, nextCard, skipMission, leaveTutorial,
  dots, cardFacts, syncWallet, browserStorage,
} from './tutorial.js';

const PAGE_NAMES = { 'calculator.html': 'the Calculator page', 'trade.html': 'the Trade page' };

/**
 * page      this page's file name, like 'trade.html'
 * getContext()  what the learner has done so far (see MISSIONS[n].done in tutorial.js)
 * prepare(step) optional; called when a mission starts on this page, to set the page up
 * onChange()    optional; called after progress changes, so the page can re-read its data
 */
export function mountTutorial({ page, getContext, prepare, onChange }) {
  const storage = browserStorage();
  let progress = loadProgress(storage);
  let dom = null;
  let timer = null;
  let lastKey = '';

  const live = () => progress.phase === 'missions' && progress.active;
  const here = () => live() && MISSIONS[progress.step].page === page;

  // ---- changing progress ----
  function update(next) {
    const before = progress;
    progress = next;
    syncWallet(storage, before, next);
    saveProgress(storage, next);
    onChange?.();
    if (navigate()) return;
    render();
  }

  /**
   * After a change: go to the page the next thing happens on, if it is not this one.
   * Only called after the learner presses something. Just opening a page never redirects.
   */
  function navigate() {
    const dest = live() ? MISSIONS[progress.step].page : progress.phase === 'after' ? 'learn.html' : null;
    if (dest && dest !== page) { location.href = dest; return true; }
    return false;
  }

  function check() {
    if (!here() || progress.showCard) return;
    const result = completeMission(progress, getContext());
    if (result.ok) update(result.progress);
    else setText('.tut-hint', result.reason);
  }

  // ---- drawing ----
  function build() {
    const el = (cls) => Object.assign(document.createElement('div'), { className: cls });
    dom = { blocks: ['t', 'b', 'l', 'r'].map(() => el('tut-block')), ring: el('tut-ring'), coach: Object.assign(document.createElement('aside'), { className: 'tut-coach' }) };
    dom.coach.setAttribute('role', 'region');
    dom.coach.setAttribute('aria-label', 'Tutorial');
    document.body.append(...dom.blocks, dom.ring, dom.coach);
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    timer = setInterval(place, 250); // the page can change shape under us (a score appears, a table grows)
  }

  function teardown() {
    if (!dom) return;
    clearInterval(timer);
    window.removeEventListener('scroll', place);
    window.removeEventListener('resize', place);
    dom.blocks.forEach((b) => b.remove());
    dom.ring.remove();
    dom.coach.remove();
    document.body.style.paddingBottom = '';
    dom = null;
    lastKey = '';
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const setText = (selector, text) => { const n = dom?.coach.querySelector(selector); if (n && n.textContent !== text) n.textContent = text; };

  function dotsHtml() {
    return `<span class="tut-dots" aria-hidden="true">${dots(progress).map((d) => `<i class="tut-dot ${d}"></i>`).join('')}</span>`;
  }

  function render() {
    if (!live()) return teardown();
    if (!dom) build();
    const mission = MISSIONS[progress.step];
    const count = `Mission ${progress.step + 1} of ${MISSIONS.length}`;
    const key = [progress.step, progress.showCard, progress.card, here()].join('|');

    if (!here()) {
      // The mission is on the other page: no dimming, just a way there.
      dom.blocks.forEach((b) => { b.style.display = 'none'; });
      dom.ring.style.display = 'none';
      dom.coach.innerHTML = `<div class="tut-inner">
        <div class="tut-top">${dotsHtml()}<span class="tut-count">${count}</span></div>
        <h2 class="tut-title">${esc(mission.title)}</h2>
        <p class="tut-goal">This mission is on ${PAGE_NAMES[mission.page] ?? mission.page}.</p>
        <div class="tut-actions"><a class="tut-btn" href="${mission.page}">Go there &rarr;</a>
          <button type="button" class="tut-link" data-act="leave">Leave tutorial</button></div></div>`;
    } else if (key !== lastKey) {
      if (progress.showCard) {
        const card = mission.cards[progress.card];
        const last = progress.card === mission.cards.length - 1;
        const facts = last || mission.cards.length === 1 ? cardFacts(progress.step, getContext()) : null;
        const label = !last ? 'Next' : progress.step === MISSIONS.length - 1 ? 'Take the final quiz &rarr;' : 'Next mission &rarr;';
        dom.coach.innerHTML = `<div class="tut-inner">
          <div class="tut-top">${dotsHtml()}<span class="tut-count">${count} &middot; done</span></div>
          <h2 class="tut-title">${esc(card.title)}</h2>
          <p class="tut-text">${esc(card.text)}</p>
          ${facts ? `<p class="tut-facts">${esc(facts)}</p>` : ''}
          <div class="tut-actions"><button type="button" class="tut-btn" data-act="next">${label}</button>
            <button type="button" class="tut-link" data-act="leave">Leave tutorial</button></div></div>`;
      } else {
        dom.coach.innerHTML = `<div class="tut-inner">
          <div class="tut-top">${dotsHtml()}<span class="tut-count">${count}</span></div>
          <h2 class="tut-title">${esc(mission.title)}</h2>
          <p class="tut-goal">${esc(mission.goal)}</p>
          <p class="tut-hint" role="status"></p>
          ${mission.freshWallet || progress.step >= 1 ? '<p class="tut-safe">Practice money: your real portfolio is safe.</p>' : ''}
          <div class="tut-actions"><button type="button" class="tut-link" data-act="skip">Skip this mission</button>
            <button type="button" class="tut-link" data-act="leave">Leave tutorial</button></div></div>`;
        prepare?.(progress.step); // runs once per mission: this branch only draws when the key changes
        setText('.tut-hint', mission.hint(getContext()));
      }
      lastKey = key;
      document.body.style.paddingBottom = dom.coach.offsetHeight + 'px';
      refocus();
    }
    place();
  }

  /** Scroll so the lit-up control is near the top, clear of the coach card at the bottom. */
  function refocus() {
    if (!here()) return;
    const mission = MISSIONS[progress.step];
    const first = document.querySelector((progress.showCard ? mission.cardTarget : mission.target)[0]);
    const stickyBar = document.querySelector('.money')?.offsetHeight ?? 0; // the trade page's cash bar stays on screen
    const gap = Math.max(100, stickyBar + 16);
    if (first) window.scrollTo({ top: Math.max(0, first.getBoundingClientRect().top + window.scrollY - gap), behavior: 'smooth' });
  }

  /** Cut a hole in the dimmed screen around the control(s) the mission is about. */
  function place() {
    if (!dom || !here()) return;
    const mission = MISSIONS[progress.step];
    const rects = (progress.showCard ? mission.cardTarget : mission.target)
      .map((s) => document.querySelector(s)).filter((n) => n && n.getClientRects().length).map((n) => n.getBoundingClientRect());
    document.body.style.paddingBottom = dom.coach.offsetHeight + 'px';
    const [t, b, l, r] = dom.blocks;
    if (!rects.length) { // nothing to light up: don't trap the learner behind a dim screen
      dom.blocks.forEach((n) => { n.style.display = 'none'; });
      dom.ring.style.display = 'none';
      return;
    }
    const pad = 8;
    const top = Math.max(0, Math.min(...rects.map((x) => x.top)) - pad);
    const bottom = Math.min(innerHeight, Math.max(...rects.map((x) => x.bottom)) + pad);
    const left = Math.max(0, Math.min(...rects.map((x) => x.left)) - pad);
    const right = Math.min(innerWidth, Math.max(...rects.map((x) => x.right)) + pad);
    const box = (n, x, y, w, h) => Object.assign(n.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
    box(t, 0, 0, innerWidth, Math.max(0, Math.min(top, innerHeight)));
    box(b, 0, bottom, innerWidth, innerHeight - bottom);
    box(l, 0, top, left, bottom - top);
    box(r, right, top, innerWidth - right, bottom - top);
    box(dom.ring, left, top, right - left, bottom - top);
  }

  // ---- buttons on the coach card ----
  document.addEventListener('click', (e) => {
    const act = e.target.closest?.('[data-act]')?.dataset.act;
    if (!act || !dom?.coach.contains(e.target)) return;
    if (act === 'leave') update(leaveTutorial(progress));
    if (act === 'skip') { const r = skipMission(progress); if (r.ok) update(r.progress); }
    if (act === 'next') { const r = nextCard(progress); if (r.ok) update(r.progress); }
  });

  render();

  return {
    check,
    /** For the page: call once everything has been drawn, so the scroll lands in the right place. */
    refocus,
    /** For the page: is the overlay on here, and which mission is it showing? */
    state: () => ({ active: here(), step: progress.step, showCard: progress.showCard }),
  };
}
