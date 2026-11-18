# Elric & Company

A static website with five finance projects:

| Page | What it does |
|---|---|
| `dcf.html` | Givaudan discounted cash flow valuation: scenarios, WACC, two terminal value methods, sensitivities, football field |
| `lbo.html` | Temenos take private leveraged buyout: sources and uses, debt schedule with cash sweep, returns, bid ceiling |
| `monte-carlo.html` | Correlated portfolio simulation (geometric Brownian motion and block bootstrap) and a stochastic DCF |
| `portfolio.html` | Portfolio risk (VaR, CVaR, drawdown, beta, risk attribution, stress tests) and mean variance optimisation |
| `earnings.html` | Earnings preview with next report date, consensus, track record and bull, base and bear scenarios |

`downloads/` holds the two pitch decks (PowerPoint and PDF) and the two Excel models. The Excel models, the decks and
the website all use the same inputs (`js/data/`) and tie out to the last digit.

## Put it online (about 10 minutes, free)

1. Create a GitHub account if you do not have one, then a new **public** repository, for example `finance-lab`.
2. Upload the whole content of this folder to the repository (drag and drop in the browser works; include the hidden `.github` folder, or run `git init`, `git add .`, `git commit`, `git push`).
3. In the repository: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Your site appears at `https://<your-user>.github.io/finance-lab/` after a minute.
4. In the repository: **Settings > Actions > General > Workflow permissions: Read and write permissions**. Then open the **Actions** tab, select **Refresh market data** and press **Run workflow**. This downloads prices and earnings data and commits them to `data/`. From then on it runs automatically every weekday.
5. Edit `js/config.js` (your name, email, LinkedIn) and `pipeline/watchlist.json` (tickers you want covered).

Until step 4 has run, the price based pages show simulated demo prices and the earnings page shows a fictional sample
company. Both are clearly labelled on the page.

## Market data

* **Daily data (default, no key needed).** `pipeline/fetch_prices.py` and `pipeline/earnings_preview.py` use
  [yfinance](https://github.com/ranaroussi/yfinance) to download three years of daily prices and an earnings briefing
  for every ticker in `pipeline/watchlist.json`. A GitHub Action runs them every weekday and commits JSON files to
  `data/`, which the site reads. Swiss tickers work (for example `NESN.SW`).
* **Live data (optional).** For tickers outside the watchlist, visitors can add free API keys through the Data button
  in the header: Twelve Data for price history, Finnhub for quotes and earnings. Keys can also be set in
  `js/config.js`; they are visible in the page source, so only use free tier keys there.

Run the pipeline locally with `pip install -r pipeline/requirements.txt`, then `python pipeline/fetch_prices.py` and
`python pipeline/earnings_preview.py`. Preview the site with `python -m http.server` and open `http://localhost:8000`.

## Methods and credits

The methods follow three open source skill collections:

* DCF model, LBO model and both pitch decks: [anthropics/financial-services](https://github.com/anthropics/financial-services)
  (`dcf-model`, `lbo-model`, `pitch-deck`, `pptx-author`, `xlsx-author`, `ib-check-deck`), Apache 2.0.
  Conventions used: formulas instead of hardcoded results, blue inputs with source comments, scenario blocks with a
  case selector, sensitivity tables that recalculate the full model, one message per slide, numbers traced to the model.
* Earnings preview: [himself65/finance-skills](https://github.com/himself65/finance-skills) (`earnings-preview`), MIT.
  The bull, base and bear scenario layer and the price reaction study are additions.
* Monte Carlo, portfolio risk and optimisation: [JoelLewis/finance_skills](https://github.com/JoelLewis/finance_skills)
  (`forward-risk`, `historical-risk`, `performance-metrics`, `asset-allocation`), MIT. The JavaScript engine in
  `js/engine/risk.js` was checked against the reference Python scripts of that repository.

Charts: [Plotly.js](https://plotly.com/javascript/) (MIT), bundled in `vendor/`.

## Disclaimer

Educational project. Nothing here is investment advice. Company figures come from public filings and press reports as
cited on each page; forecasts are the author's assumptions. The Temenos buyout is an illustrative exercise and does not
describe an actual transaction.
