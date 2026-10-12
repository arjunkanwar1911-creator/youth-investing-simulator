# Progress

**Impact level:** Level 0 — Built
**Current milestone:** M3 — Real market data, refreshed by itself
**Current part:** Not started

## Done
- First session setup: project folder, docs/plan.pdf, PLAN.md, CLAUDE.md, PROGRESS.md, LEARNED.md
- **M1 Repo and live link** — public repo, README, mobile-first landing page with progress
  strip and Build log, live on GitHub Pages at
  https://arjunkanwar1911-creator.github.io/youth-investing-simulator
  — **signed off by Sahil**
- **M2 Compound interest calculator** — `lib/compound.js` with 5 passing tests
  (`npm test`), `calculator.html` with four sliders, a Chart.js growth chart and the
  cost-of-waiting comparison. Node.js 24.20.0 (ARM64) installed.

## Next step (exact)
M3: fetch forex from Frankfurter (no key needed) and daily stock prices from Twelve Data,
save them as JSON, and run it nightly with a GitHub Action.

**Blocked on Arjun:** a free Twelve Data API key from https://twelvedata.com/pricing
(free plan, no card). Once he has it, it goes into GitHub Secrets as `TWELVE_DATA_KEY`.
The Frankfurter half of M3 needs no key and can be built first.

## Note on how we work
Arjun asked (12 Oct 2026) that Claude run the terminal commands rather than handing them
over, and report progress as a ticked checklist.

## Milestones
- [x] M1 Repo and live link
- [x] M2 Compound interest calculator
- [ ] M3 Real market data, refreshed by itself
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
