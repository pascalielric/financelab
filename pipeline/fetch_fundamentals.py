"""Download company fundamentals for the valuation models and write them to data/fundamentals.json
and data/financials/<SYMBOL>.json.

For every symbol in the "fundamentals" groups of watchlist.json it stores:
  * market data from Yahoo Finance (market value, enterprise value, LTM EBITDA and revenue, debt, cash, P/E)
  * a regression beta computed here from weekly total returns against the iShares MSCI World ETF (URTH),
    over 2 and 5 years, so the number is reproducible and not a black box
  * the last four annual income statements, balance sheets and cash flow statements (where Yahoo has them)

The Excel models and the website read these files, so peer multiples and betas refresh with the data.
"""
import os
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import yfinance as yf
from common import DATA, watchlist, file_name, write_json, clean

MARKET = "URTH"
INFO_KEYS = ["shortName", "longName", "currency", "financialCurrency", "marketCap", "enterpriseValue", "ebitda",
             "totalRevenue", "totalDebt", "totalCash", "sharesOutstanding", "trailingPE", "forwardPE",
             "enterpriseToEbitda", "enterpriseToRevenue", "ebitdaMargins", "operatingMargins", "revenueGrowth",
             "beta", "currentPrice", "previousClose", "dividendYield", "country", "sector", "industry",
             "forwardEps", "trailingEps", "bookValue", "priceToBook", "fiftyTwoWeekLow", "fiftyTwoWeekHigh",
             "targetMeanPrice", "numberOfAnalystOpinions", "lastFiscalYearEnd", "heldPercentInsiders",
             "heldPercentInstitutions", "floatShares", "impliedSharesOutstanding"]
FIN_ROWS = {
    "income": ["Total Revenue", "Gross Profit", "EBITDA", "Normalized EBITDA", "EBIT", "Operating Income",
               "Interest Expense", "Pretax Income", "Tax Provision", "Net Income", "Diluted EPS",
               "Reconciled Depreciation", "Research And Development"],
    "balance": ["Cash And Cash Equivalents", "Accounts Receivable", "Inventory", "Total Current Assets",
                "Net PPE", "Goodwill", "Other Intangible Assets", "Total Assets", "Accounts Payable",
                "Current Deferred Revenue", "Total Current Liabilities", "Total Debt", "Long Term Debt",
                "Current Debt", "Stockholders Equity", "Total Liabilities Net Minority Interest",
                "Ordinary Shares Number", "Capital Lease Obligations"],
    "cashflow": ["Operating Cash Flow", "Capital Expenditure", "Free Cash Flow", "Depreciation And Amortization",
                 "Change In Working Capital", "Cash Dividends Paid", "Repurchase Of Capital Stock"],
}


def weekly_returns(sym, period):
    h = yf.Ticker(sym).history(period=period, interval="1wk", auto_adjust=True)
    if h is None or h.empty:
        return None
    s = h["Close"].dropna()
    s.index = s.index.tz_localize(None).normalize()
    return s.pct_change().dropna()


def beta(sym, mkt, period):
    r = weekly_returns(sym, period)
    if r is None:
        return None, 0
    df = pd.concat([r, mkt], axis=1, join="inner").dropna()
    df.columns = ["s", "m"]
    if len(df) < 40:
        return None, len(df)
    b = np.cov(df["s"], df["m"])[0, 1] / np.var(df["m"], ddof=1)
    return round(float(b), 3), int(len(df))


def statements(t):
    out = {}
    frames = {"income": t.income_stmt, "balance": t.balance_sheet, "cashflow": t.cashflow}
    for key, df in frames.items():
        try:
            if df is None or df.empty:
                continue
            cols = sorted(df.columns)[-4:]
            rec = {"years": [c.strftime("%Y-%m-%d") for c in cols]}
            for row in FIN_ROWS[key]:
                if row in df.index:
                    rec[row] = [clean(df.loc[row, c]) for c in cols]
            out[key] = rec
        except Exception as e:
            print("statement error", key, e)
    try:  # last eight quarters of the income statement, used to calendarise fiscal years
        q = t.quarterly_income_stmt
        if q is not None and not q.empty:
            cols = sorted(q.columns)[-8:]
            rec = {"quarters": [c.strftime("%Y-%m-%d") for c in cols]}
            for row in FIN_ROWS["income"]:
                if row in q.index:
                    rec[row] = [clean(q.loc[row, c]) for c in cols]
            out["quarterly"] = rec
    except Exception as e:
        print("quarterly error", e)
    return out


def main():
    wl = watchlist()
    groups = wl.get("fundamentals", {})
    mkt = {p: weekly_returns(MARKET, p) for p in ("2y", "5y")}
    result = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
              "source": "Yahoo Finance via yfinance; betas computed from weekly returns against " + MARKET,
              "market": MARKET, "groups": {}, "companies": {}}
    for g, syms in groups.items():
        result["groups"][g] = syms
        for sym in syms:
            if sym in result["companies"]:
                continue
            try:
                t = yf.Ticker(sym)
                info = {}
                try:
                    info = t.info or {}
                except Exception:
                    pass
                rec = {k: clean(info.get(k)) for k in INFO_KEYS}
                for p in ("2y", "5y"):
                    b, n = beta(sym, mkt[p], p) if mkt[p] is not None else (None, 0)
                    rec["beta" + p] = b
                    rec["betaObs" + p] = n
                result["companies"][sym] = rec
                st = statements(t)
                if st:
                    write_json(os.path.join(DATA, "financials", file_name(sym) + ".json"), {"symbol": sym, "currency": rec.get("financialCurrency"), **st})
                print("ok", sym, rec.get("enterpriseToEbitda"), rec.get("beta5y"))
            except Exception as e:
                print("fail", sym, e)
    write_json(os.path.join(DATA, "fundamentals.json"), result)


if __name__ == "__main__":
    main()
