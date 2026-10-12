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
