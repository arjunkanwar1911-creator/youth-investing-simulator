# Youth Investing Simulator — Build Plan

A paper trading app on real stock and forex data that teaches young people compound
interest, risk and diversification. Measured by one thing: how many people learn to
invest responsibly with it.

| | |
|---|---|
| **Prepared by** | Sahil |
| **Builder** | Arjun |
| **Goal** | Build a paper trading app on real market data that teaches compound interest, risk and diversification, ship it on one link, and get it used by real young learners, with the learning measured. |
| **Data** | Frankfurter (forex, free, no key) and Twelve Data (stocks, free key, no card) |
| **Stack** | GitHub, GitHub Pages, GitHub Actions, Next.js on Vercel, Supabase, Google sign in. All free plans. |

## How the milestones work

**One link, always.** The link from M1 is the only link Arjun shares. It never changes;
it just gets better.

**Update after every milestone.** Same link, plus what was added and what was learned.
Sent to Sahil on WhatsApp.

**Judged by what works.** A milestone is done when Sahil can check the "Done when" line
on the live link. Not by hours spent.

## The community impact scale

The app is the means. The outcome is learners. A learner counts once they have finished
at least one lesson and one simulation.

| Level | Name | What it means | Reached at |
|---|---|---|---|
| Level 0 | Built | It works for Arjun | M1 to M10 |
| Level 1 | Friends | 10 learners finish a lesson and a simulation | M13 |
| Level 2 | Classroom | 30 learners, quiz improvement measured | M14 |
| Level 3 | School | 100+ learners, a teacher uses it on their own | M16 |
| Level 4 | Community | 500+ learners across several schools or groups | Next phase |

## Milestone update

```
Milestone N done
Link: (the one link)
New: (2 or 3 things anyone can try)
Learned: (1 or 2 things)
Learners so far: (from the impact page, from M12)
Next: Milestone N+1
```

Nothing shipped this week? Say so in one line, and say why. That's fine; silence isn't.

---

# STAGE 1 — Foundations

A live link, the maths of money, and real market data flowing in by itself.

## M1 Repo and live link

Get the project on the internet on day one, with one link that never changes.

- GitHub repo `youth-investing-simulator` with a README that says who it is for and why
- A landing page on GitHub Pages: name, one line mission, and a Build log section
- Works on a phone

**Done when:** Sahil opens the link on his phone. This is the link Arjun shares at every
milestone from now on.

**Learn:** terminal, git, GitHub, how a repo becomes a website

## M2 Compound interest calculator

The first thing every young investor should feel: time matters more than timing.

- Inputs: starting amount, monthly top up, yearly return, years
- A growth chart, and a side by side line showing what starting 5 years later costs
- The maths lives in its own file, separate from the page, with tests

**Done when:** 1,000 at 8% a year for 10 years shows 2,158.92. Three test cases pass from
the terminal.

**Learn:** functions, the compound interest formula, separating logic from UI, Chart.js

## M3 Real market data, refreshed by itself

Real prices, free, updated every night without Arjun touching anything.

- Forex from Frankfurter (free, no key): USD, EUR, GBP against INR
- Daily prices for a starter list of about 20 well known stocks and index funds from
  Twelve Data's free plan (free key, no card)
- A GitHub Action that runs nightly and saves the prices as JSON; every page shows
  `Data as of <date>`
- The API key lives in GitHub Secrets, never in the code

**Done when:** The Action runs on its own for 3 nights in a row and the date on the site
moves forward.

**Learn:** APIs, JSON, scheduled jobs, keeping a key secret

---

# STAGE 2 — The simulator

Paper trading that teaches, not paper trading that gambles.

## M4 Paper trading core

Every learner starts with 1,00,000 of pretend money.

- Buy and sell at the latest closing price; holdings, cash and total value always visible
- Trade history with date, price and quantity
- Saved in the browser so it survives a refresh
- Simple rules on purpose: no borrowing, no short selling, no leverage

**Done when:** Sahil makes 20 trades with no glitches, and cash plus holdings always
equals total value.

**Learn:** state, edge cases (selling more than you own, spending more than you have)

## M5 Risk and diversification

Show learners what their choices actually mean.

- Portfolio split by asset, sector and currency as a chart
- Risk shown as how much the portfolio moves day to day (volatility), in plain words
- A diversification score from 0 to 100, with a gentle nudge like
  `70% of your money is in one stock`

**Done when:** Three test portfolios (one stock, five stocks, a mix with an index fund)
get scores that make sense and the same score every time.

**Learn:** averages, standard deviation, explaining a number to a non expert

## M6 Learn mode

Five short lessons, each under five minutes, each ending in a quiz.

- Compound interest → Risk → Diversification → How forex works → Investing vs trading
- A short starter quiz before the first lesson and the same quiz after the last one
- Lessons link straight into the simulator: `now try it`

**Done when:** A friend with no finance background finishes lesson 1 in under 5 minutes
and gets the quiz right.

**Learn:** writing for beginners, measuring learning with a before and after

---

# STAGE 3 — Real app

Accounts, a database and challenges, on free plans. The link from M1 keeps working.

## M7 Move to a real app

Same product, now on the stack real startups use.

- Rebuilt in Next.js and hosted on Vercel (free Hobby plan)
- The GitHub Pages link forwards to the new app
- Every push to GitHub creates a new version automatically

**Done when:** The old link opens the new app, and every feature from M1 to M6 still works.

**Learn:** frameworks, deployments, previews

## M8 Accounts with Google sign in

Learners keep their portfolio and progress on any device.

- Supabase (free plan) for the database and sign in
- Sign in with Google through Supabase Auth
- Portfolios, trades and quiz results saved per learner, with row level security so
  nobody sees anyone else's
- Keys in `.env.local` and Vercel settings only

**Done when:** A friend signs in, makes trades, and cannot see Arjun's portfolio. No key
appears anywhere on GitHub.

**Learn:** databases, SQL basics, OAuth, data privacy

## M9 Time machine and weekly challenge

Learn from history without waiting years.

- Time machine: invest 10,000 in 2016, see where it is today, with and without
  diversification
- Weekly challenge: the same starting scenario for everyone, resets every Monday

**Done when:** Sahil runs the time machine for 3 portfolios and the results match the
real price history.

**Learn:** historical data, seeded scenarios

## M10 A leaderboard that rewards being responsible

Rank learners on smart investing, not lucky bets.

- Score = return adjusted for risk, plus diversification, plus lessons completed
- Display names only, no real names or photos
- A short `why this ranking` note so learners see what is being rewarded

**Done when:** A portfolio that put everything in one lucky stock does not top the board.

**Learn:** designing incentives, ethics of ranking

---

# STAGE 4 — Community impact

The outcome is not the app. It is how many young people learn to invest responsibly with it.

## M11 Safe for young learners

Earn the trust of parents and teachers before reaching them.

- A clear line on every page: educational, pretend money, not financial advice
- A privacy page in plain words: what is stored, what is never stored, how to delete an
  account
- Only the data the app needs; no phone numbers, no real money, no bank links

**Done when:** A parent reads the privacy page and understands it in two minutes.

**Learn:** data minimisation, writing policy in plain language

## M12 Public impact page

Show the outcome, not just the features.

- A public `/impact` page with anonymous totals: learners, lessons completed,
  simulations run
- Average quiz improvement, before vs after (from M6)
- Updates by itself from the database

**Done when:** The numbers on `/impact` match the database, and no individual can be
identified.

**Learn:** aggregate queries, honest metrics

## M13 Pilot with 10 friends

Real users before more features.

- 10 friends sign up and complete at least one lesson and one simulation
- A free Google Form for feedback
- Fix the top 3 problems they hit

**Done when:** Impact Level 1 reached, and Arjun can name the top 3 fixes and why he
chose them.

**Learn:** user testing, prioritising

## M14 Classroom pack

Make it easy for a teacher to use with a whole class.

- Class codes: a teacher creates a class, learners join with a code
- A teacher view with class progress and quiz improvement
- A one page teacher guide

**Done when:** One class or club of about 30 uses it in a session. Impact Level 2.

**Learn:** roles and permissions, building for a second kind of user

## M15 Release v1.0 safely

Ship updates without fear.

- Version tags and short release notes for every release
- A before and after release checklist
- A known good version to roll back to on Vercel

**Done when:** Sahil can see what changed in each version, and one rollback has been
tested.

**Learn:** versioning, release discipline

## M16 Grow the reach

Take it beyond one school.

- Share with at least 3 schools, clubs or youth groups
- A one page impact report: learners reached, quiz improvement, what learners said
- A plan for the next 500 learners

**Done when:** Impact Level 3: 100+ learners, with the improvement measured.

**Learn:** presenting impact, partnerships

---

## What you'll learn while building

- **Money:** compound interest, risk, diversification, how currencies move, investing vs trading
- **Terminal and git:** working from the terminal, committing every step, releasing with tags
- **Data:** calling real APIs, scheduled pipelines, cleaning and storing data
- **Product:** a web app with accounts, a database, privacy and permissions
- **Analytics:** returns, volatility, scores, before and after measurement
- **Impact:** testing with real users, working with teachers, reporting outcomes honestly

## Scope notes

- Pretend money only. No real trading, no bank or broker links, ever.
- Educational, not financial advice. The app says so on every page.
- Free plans only. Nothing that needs a credit card, and no paid AI APIs.
- Daily closing prices are enough. Live tick by tick data is out of scope.
- Built for young learners, so privacy and safety come before growth.

## Guiding principle

Works for me → works for a friend → works for a class → then grow. Don't grow something
that doesn't work yet, and don't keep polishing something nobody is using.

## When unsure what to do next

1. Does it run on the live link?
2. Can a friend use it without being told how?
3. Does it teach something they didn't know?
4. Will one small change help more people learn?

If the answer to 1 or 2 is no, fix that first.
