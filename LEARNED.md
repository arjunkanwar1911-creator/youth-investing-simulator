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
- **"rejected (fetch first)"** means GitHub has commits I don't have yet (the nightly price robot). `git pull --rebase` downloads them and puts my commit on top, then the push works.
- Rounding each slice on its own can make percents add up to 101. The **largest remainder** trick rounds everything down, then gives the spare points to the slices closest to rounding up, so it is always exactly 100.
- Browsers keep a **saved copy** of a site so it opens faster, so after an update I might see the old page. **Ctrl + Shift + R** fetches a fresh copy.
- A **sector** is the kind of business a company is in. The real world uses a list of 11 called GICS. I use simpler names, like "Everyday needs" for Coca-Cola, because people keep buying it even in bad times.
- **Volatility** is how much something moves on a normal day. Tesla moves about 3% a day, an S&P 500 fund about 0.8%.
- **Standard deviation** measures how far a typical day lands from the average day. Small means calm, big means bumpy.
- A mix of 5 different shares moved *less* per rupee than any single one of them, because when one falls another often doesn't. That is **diversification**.
- An apostrophe inside text wrapped in single quotes (`'you'll'`) ends the text early and breaks the whole page. The browser test caught it before anyone saw it.
- A **diversification score** turns "how spread out am I?" into one number. Mine gives 60 points for owning many different things and 40 for being in different sectors. One stock scores 0, five stocks 57, a mix with an index fund 94.
- The **effective number** of things you own counts big pieces more. 4 equal pieces counts as 4, but one huge piece and three tiny ones counts as about 1.
- A **tutorial overlay** puts a dim layer over the whole page and cuts a hole around one control. Four dark boxes (top, bottom, left, right) surround the hole, so clicks outside it hit a box instead of the page.
- A step only counts when the app **checks it really happened** (the slider is at 20, the fund is in the wallet). A Next button alone would let anyone skip, so the checks sit in one file with tests, and the screen just asks it.
- Keeping the **rules in one file and the drawing in another** means I can test the rules with no browser at all.
- A **separate save key** gives the tutorial its own practice wallet. The real portfolio has a different name in the browser's storage, so a mission trade can't land on it. The tests spy on every write to prove it.
- A before-and-after quiz only means something if it asks the **exact same questions** both times, so both quizzes are built from one list. A test checks they match.
- A quiz with blank answers is **refused**, not scored as 0. "Not sure" is an answer, but it counts as wrong.
- I assumed 3 shares in 3 sectors would turn the score green. The real numbers said **35**. It takes an index fund as well (80). Checking the maths before building saved a mission nobody could finish.
- A **fixture** is made-up data for a test, like round prices. I used round ones so I can check the expected answers by hand.
- The page keeps changing shape while it loads, so the tutorial scrolls to its target **again** once everything is drawn. The cash bar that sticks to the top also hides things, so the scroll leaves room for it.
- A **headless browser** is a real browser with no window. A script played the whole tutorial in it at phone size, clicking and tapping the chart, and found the scrolling problem before anyone else saw it.
