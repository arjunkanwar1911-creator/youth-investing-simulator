# Progress

**Impact level:** Level 0 — Built
**Current milestone:** M6 — Learn mode
**Current part:** M6 built on branch `m6-tutorial` (29 Oct), waiting for Arjun to run `npm test`, check it in the browser, then commit and push

## Done
- First session setup: project folder, docs/plan.pdf, PLAN.md, CLAUDE.md, PROGRESS.md, LEARNED.md
- **M1 Repo and live link** — public repo, README, mobile-first landing page with progress
  strip and Build log, live on GitHub Pages at
  https://arjunkanwar1911-creator.github.io/youth-investing-simulator
  — **signed off by Sahil**
- **M3 Real market data, refreshed by itself** — `scripts/fetch-prices.mjs` (forex from
  Frankfurter, 20 instruments from Twelve Data, 120 days of history each, retries on
  failure), nightly GitHub Action at 02:30 UTC, `markets.html`, and "Data as of" on every
  page. Key is in GitHub Secrets. The Action was run once by hand on 12 Oct: it fetched
  20/20, committed `Prices as of 2026-10-09` and pushed by itself. CI (`npm test`) green.
  **Verified 19 Oct:** the Action ran on schedule 13–18 Oct, all six runs green, and the
  live site's date moved to 16 Oct (Friday's close). M3 closed.
- **M2 Compound interest calculator** — `lib/compound.js` with 5 passing tests
  (`npm test`), `calculator.html` with four sliders, a Chart.js growth chart and the
  cost-of-waiting comparison. Node.js 24.20.0 (ARM64) installed.

- **M4 part 1 — buy/sell engine** (19 Oct) — `lib/portfolio.js`: money in paise, fractional
  shares to 6 decimals, friendly refusal messages, average cost kept on partial sells.
  12 tests in `test/portfolio.test.js` including 200 random trades. `npm test` 17/17.

- **M4 part 2 — trade page** (19 Oct) — `trade.html` + `lib/prices.js` (close × exchange
  rate in paise). Arjun's choice: part shares allowed (defaulted while he was away; one line
  to change). Order in rupees, sell-all button, sticky cash/holdings/total bar to the paisa,
  history, saved in localStorage, reset with a confirm step. Shares now 8 decimals (6 made
  ₹7,500 cost ₹7,500.01). Headless Edge drove 20 trades: total exact after every one,
  survives refresh, no errors at 390px.

- **M4 closed** (20 Oct) — mutation check on `lib/compound.js` and `lib/portfolio.js`:
  5 of 6 planted bugs caught; the missed one (`toMoney` rounding down) now has its own
  test, 22/22. Sahil made 20 trades on the live link: no glitches, cash plus holdings always
  equalled total. Build log entry added, strip at 4/16.

- **M4 rule change** (25 Oct) — Arjun's choices: whole shares only, ₹10,00,000 to start
  (was 1 lakh: whole shares + a 25% cap blocked the index funds), and no single buy over
  25% of total value. Trade page orders in shares, save key `yis.portfolio.v2`.
  `npm test` 26/26, checked by Arjun in the browser.

- **M5 part 1 — "Where your money is" chart** (25 Oct) — `lib/risk.js` `allocation()`
  splits total value (cash included) by asset type, sector and currency, with whole
  percents that always add to 100 (largest remainder). Doughnut + legend on `trade.html`
  with three tabs. Browser test caught 101% before the fix. `npm test` 33/33. Arjun asked
  to test each part himself before moving on, and said the "what should happen if"
  question was not useful, so Claude writes the checks. Then, on Arjun's call: cash taken
  off the ring (shown as its own line), and simple sector labels with "Internet & Media"
  (Google, Meta, Netflix, Disney) and "Everyday needs" (Coca-Cola). Arjun checked it live.

- **M5 part 2 — "How bumpy is it?"** (25 Oct) — `volatility()` in `lib/risk.js`: today's
  holdings priced over the 120-day history, standard deviation of daily moves -> "on a
  normal day your shares go up or down by about ₹X", Calm (<1%) / Medium / Bumpy (>=2%),
  worst day, S&P 500 comparison. Browser test: Tesla 3.1% Bumpy, SPY 0.8% Calm, mix of 5
  0.7% Calm. Caught an apostrophe that broke the page script. `npm test` 42/42.
  Arjun checked it live: "looks good".

- **M5 part 3 — "How spread out is it?"** (25 Oct) — `diversification()` in
  `lib/risk.js`: 60 points from the effective number of pieces (index fund = 20 pieces,
  full marks at 15) + 40 from the effective number of sectors (fund spread over all, full
  at 4). Cash ignored. One gentle tip, biggest problem first (one company >= 40%, one
  sector >= 60%, no index fund, else "nicely spread"). Done-when in the browser at real
  prices: one stock 0, five stocks 57, mix with SPY 94, same after refresh. 51/51.

- **M5 closed** (25 Oct) — Arjun checked part 3 live. Done-when re-run on the live link:
  0 / 57 / 94, same after refresh, no errors. Build log entry added, strip at 5/16.
  27 Oct: LEARNED question asked (Claude explained the answer on request), update sent to Sahil.

- **M6 Learn mode, built as a guided tutorial** (29 Oct, branch `m6-tutorial`, not yet run by
  Arjun, not committed). Plan change agreed with Arjun: instead of 5 text lessons, 5 missions
  played inside the real app, each dimming the screen and lighting up one control; Continue only
  unlocks once the step is really done. Forex is a second card inside mission 2; mission 5 uses a
  new "last 120 days" chart on the trade page (Arjun chose chart over list). Missions: 1 calculator
  years 5->20, 2 buy an index fund, 3 about 50,000 in one company (score red), 4 three sectors plus
  an index fund (score green), 5 tap the biggest one-day drop. Same 6-question quiz before mission 1
  and after mission 5, before vs after shown, badge only if no mission was skipped.
  Practice wallet is its own key (`yis.tutorial.wallet.v1`), starts at 10 lakh, reset for missions
  2 and 3, thrown away when the tutorial ends. Progress: `yis.tutorial.progress.v1`.
  New: `lib/quiz.js`, `lib/tutorial.js`, `lib/tutorial-ui.js`, `tutorial.css`, `learn.html`,
  `test/quiz.test.js`, `test/tutorial.test.js`; changed: `calculator.html`, `trade.html`,
  `index.html` (link), `lib/portfolio.js` (`PORTFOLIO_KEY`), `lib/risk.js` (`biggestDrop`).
  Checked in headless Edge at 390px: 61 of 62 browser checks passed (the 62nd was a typo in the
  check, the page was right). Tests written but `npm test` NOT run, per Arjun's request.
  Note: PLAN.md still lists the old lesson names (forex, investing vs trading as lessons) and was
  not edited. Mission 4 needs an index fund as well as 3 sectors: three stocks alone score 35, not green.

## Next step (exact)
M6: Arjun runs `npm test` (expect the old 51 plus the new quiz and tutorial tests), plays the
tutorial from `learn.html` on his phone or browser, then commits and pushes the `m6-tutorial`
branch. If all is well: check the "Done when" on the live link (a friend finishes mission 1 in under
5 minutes and gets the quiz right), add the Build log entry, move the strip to 6 of 16, then the
LEARNED question and the update to Sahil. Still open from 19 Oct: cron `30 2 * * *` -> 03:15?

To check the nightly robot any time: `gh run list --workflow=prices.yml --limit 5`

## Session log
- **12 Oct 2026** — setup + M1 + M2 + M3 in one sitting. Node 24.20.0 installed.
  Sahil signed off M1. Stopped here; M3's remaining check is calendar time, not work.
- **19 Oct 2026** — M3 closed: six nightly runs in a row, all green. M4 parts 1 and 2 built
  and live. Stopped here. Waiting on: Sahil's 20 trades, Arjun's answer to the cron question
  (`30 2 * * *` -> 03:15?), and whether he wants whole shares instead of part shares.
- **20 Oct 2026** — mutation check (5/6 caught, gap fixed with a new test). Sahil's 20
  trades clean. M4 closed.
- **25 Oct 2026** — M4 rule change: whole shares, 10 lakh, 25% per-buy cap. 26/26 green.
  Then all of M5 in three parts, each checked by Arjun live. M5 closed. 51/51.

- **29 Oct 2026** — M6 designed with Arjun (guided missions instead of text lessons), branch
  `m6-tutorial` made, everything built and browser-checked. Stopped before `npm test`, commit and push.

## Note on how we work
Arjun asked (12 Oct 2026) that Claude run the terminal commands rather than handing them
over, and report progress as a ticked checklist.

## Milestones
- [x] M1 Repo and live link
- [x] M2 Compound interest calculator
- [x] M3 Real market data, refreshed by itself
- [x] M4 Paper trading core
- [x] M5 Risk and diversification
- [ ] M6 Learn mode
- [ ] M7 Move to a real app
- [ ] M8 Accounts with Google sign in
- [ ] M9 Time machine and weekly challenge
- [ ] M10 A leaderboard that rewards being responsible
- [ ] M11 Safe for young learners
- [ ] M12 Public impact page
- [ ] M13 Pilot with 10 friends
- [ ] M14 Classroom pack
- [ ] M15 Release v1.0 safely
- [ ] M16 Grow the reach
