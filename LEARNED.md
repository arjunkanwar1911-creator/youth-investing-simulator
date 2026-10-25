# What I learned

- **git commit** saves a snapshot of my files with a short note, so I can never lose work.
- **root-commit** in the output means it was the very first commit in this project.
- **A repo** is my project folder, with a copy on GitHub called `origin`.
- **git push** sends my commits up to GitHub. **GitHub Pages** then serves the files as a real website, free.
- **HTTP 404** means "not found" and **200** means "found it". Pages showed 404 for a minute while it built, then 200.

## M2 — Compound interest
- **Compound interest** means my growth also grows. 8% a year for 10 years turns 1,000 into 2,158.92, not 1,800.
- A **monthly rate** is not the yearly rate divided by 12. For 8% a year it's `(1.08 ^ (1/12)) - 1`, about 0.643% a month.
- **Separating logic from UI**: `lib/compound.js` does the maths and knows nothing about the page, so I can test it on its own.
- A **test** is code that checks my code. `npm test` runs all five of mine in under a second.
- The best test works the answer out a *different* way (I checked my loop against the textbook annuity formula), so one bug can't hide in both.
- **Time in the market beats timing the market**: waiting 5 years out of 20 skips only 1.2 lakh of saving but costs 4.78 lakh at the end.

## M3 — Real market data
- An **API** is a website built for programs instead of people. I ask a URL a question, it answers in **JSON**.
- A **rate limit** is the API saying "not so fast". Twelve Data's free plan allows 8 symbols a minute, so my script asks for 8, waits 61 seconds, asks again.
- An **API key** is a password. It lives in **GitHub Secrets** and in `.env.local` (which `.gitignore` keeps out of git). It is never in the code.
- A **GitHub Action** is a robot that runs my script on a schedule. Mine wakes at 02:30 UTC — 8am in India — every night.
- **cron** `30 2 * * *` means "minute 30, hour 2, every day". Five fields: minute, hour, day, month, weekday.
- Networks fail for no reason, so anything running unattended should **retry** before giving up. Mine tries 3 times with longer waits. My first run lost 4 symbols to one blip; with retries it got all 20.
- Prices are for **trading days**. Friday's close is still the latest on a Sunday — that's why the date says 9 October, not 12.
- GitHub's schedule is **best effort**: my 02:30 UTC job actually started between 07:00 and 09:30 UTC. It still runs every night, just not on the dot.

## M4 — Paper trading core
- **State** is everything the app has to remember: my cash, what I own, and every trade. Each trade makes a *new* state instead of changing the old one.
- Computers are bad at decimals (`0.1 + 0.2` is `0.30000000000000004`), so my money is stored in whole **paise**. Whole numbers never drift.
- An **edge case** is the weird input at the edges: buying with exactly all my cash, selling more than I own, a quantity of zero. Most bugs live there, so each one has a test.
- A **random test** fires 200 random trades and checks the rules after every single one. It found a weak spot in my *test* before it found anything in my code.
- **localStorage** is a small notebook each website gets inside my browser. My portfolio is saved there, so a refresh doesn't wipe it, but it stays on that one browser only.
- **Rounding adds up.** With shares rounded to 6 decimals, ₹7,500 of Apple cost ₹7,500.01. 8 decimals fixed it. Tiny errors matter when you're promising "it always adds up".
- A **browser test** clicks the real buttons in a hidden browser. Mine did Sahil's 20 trades and caught the paisa bug before he did.
- A **mutation check** plants a small bug on purpose to see if my tests notice. Rounding *down* instead of to the nearest paisa got past every test, because none of them used a number that rounds up. A test only protects the spot it actually looks at.
- A **position limit** caps how big one buy can be. Mine is a quarter of my total, so going all in on one stock takes four separate decisions instead of one tap.
- Rules fight each other: whole shares plus a ₹25,000 cap meant the index funds (₹72,000 a share) could never be bought. Checking the real prices *before* coding caught it, and 10 lakh fixed it.
- When the rules change, old saved data may not fit them. Giving the save a **new version name** (`v2`) means old part-share portfolios start fresh instead of breaking.
