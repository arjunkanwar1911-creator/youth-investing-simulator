# Progress

**Impact level:** Level 0 — Built
**Current milestone:** M5 — Risk and diversification
**Current part:** M5 part 1 — not started

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

## Next step (exact)
M5 part 1 (allocation chart): explain the plan and files, wait for Arjun's go, get his
3 "what should happen if" checks. Read the M5 section of PLAN.md
(split by asset/sector/currency chart, volatility in plain words, diversification score
0–100 with a gentle nudge). Still open from 19 Oct: cron `30 2 * * *` -> 03:15?

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

## Note on how we work
Arjun asked (12 Oct 2026) that Claude run the terminal commands rather than handing them
over, and report progress as a ticked checklist.

## Milestones
- [x] M1 Repo and live link
- [x] M2 Compound interest calculator
- [x] M3 Real market data, refreshed by itself
- [x] M4 Paper trading core
- [ ] M5 Risk and diversification
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
