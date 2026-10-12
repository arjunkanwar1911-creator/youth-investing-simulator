# Progress

**Impact level:** Level 0 — Built
**Current milestone:** M4 — Paper trading core
**Current part:** Not started

## Done
- First session setup: project folder, docs/plan.pdf, PLAN.md, CLAUDE.md, PROGRESS.md, LEARNED.md
- **M1 Repo and live link** — public repo, README, mobile-first landing page with progress
  strip and Build log, live on GitHub Pages at
  https://arjunkanwar1911-creator.github.io/youth-investing-simulator
  — **signed off by Sahil**
- **M3 Real market data, refreshed by itself** — `scripts/fetch-prices.mjs` (forex from
  Frankfurter, 20 instruments from Twelve Data, 120 days of history each, retries on
  failure), nightly GitHub Action at 02:30 UTC, `markets.html`, and "Data as of" on every
  page. Key is in GitHub Secrets. **Awaiting the 3-nights-in-a-row check** — calendar time,
  nothing left to build.
- **M2 Compound interest calculator** — `lib/compound.js` with 5 passing tests
  (`npm test`), `calculator.html` with four sliders, a Chart.js growth chart and the
  cost-of-waiting comparison. Node.js 24.20.0 (ARM64) installed.

## Next step (exact)
M4 Paper trading core: buy and sell the 20 instruments in `lib/universe.js` at the latest
close from `data/stocks.json`, starting from 1,00,000 of pretend money. Holdings, cash and
total value always visible; trade history; saved in the browser so a refresh does not wipe
it. No borrowing, no short selling, no leverage.

Watch for: on the 13th, 14th and 15th of October, check the Action ran and the date on the
site moved. That closes M3's "Done when".

## Note on how we work
Arjun asked (12 Oct 2026) that Claude run the terminal commands rather than handing them
over, and report progress as a ticked checklist.

## Milestones
- [x] M1 Repo and live link
- [x] M2 Compound interest calculator
- [x] M3 Real market data, refreshed by itself *(pending the 3-night check)*
- [ ] M4 Paper trading core
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
