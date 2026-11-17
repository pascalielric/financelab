"""Build a pre earnings briefing for each watchlist ticker and write data/earnings/<SYMBOL>.json.

Method follows the earnings-preview skill of github.com/himself65/finance-skills (MIT):
  1. date and context     report date and timing, price, 1 week and 1 month performance, market cap
  2. consensus estimates  EPS and revenue: average, low, high, analyst count, year ago, growth
  3. beat / miss record   estimate vs actual EPS and surprise % for recent quarters
  4. analyst sentiment    rating distribution and price target range
  5. what to watch        revenue growth and margin trends from the quarterly income statement
On top of the skill, this script measures the share price reaction to each past report (event study),
which the website uses for its bull / base / bear scenarios.

Data: Yahoo Finance via yfinance. Research and education only, not investment advice.
"""
import os, sys
from datetime import datetime, timezone
import pandas as pd
import yfinance as yf
from common import DATA, watchlist, file_name, write_json, update_index, clean


def row(df, key):
    """Row of an estimate frame as a clean dict, or None when missing."""
    try:
        if df is None or key not in df.index:
            return None
        return {k: clean(v) for k, v in df.loc[key].to_dict().items()}
    except Exception:
        return None


def reactions(earn_dates, hist):
    """One day share price reaction to each past report.

    A report at or after 16:00 exchange time is priced in on the next session, so the reaction is
    close(next session) / close(report day) - 1. Earlier reports are priced in on the same day:
    close(report day) / close(previous session) - 1.
    """
    out = []
    if earn_dates is None or hist is None or len(hist) < 5:
        return out
    closes = hist["Close"].dropna()
    days = [d.date() for d in closes.index]
    for ts, r in earn_dates.iterrows():
        actual = r.get("Reported EPS")
        if actual is None or pd.isna(actual):
            continue                                   # upcoming report, no reaction yet
        d = ts.date()
        if (pd.Timestamp.now().date() - d).days > 4 * 365:
            continue                                   # too old to say anything about the company today
        after_close = ts.hour >= 16
        idx = next((i for i, x in enumerate(days) if x >= d), None)
        if idx is None:
            continue
        a, b = (idx, idx + 1) if after_close else (idx - 1, idx)
        if a < 0 or b >= len(days):
            continue
        est = r.get("EPS Estimate")
        out.append({
            "date": d.isoformat(), "timing": "after close" if after_close else "before open",
            "estimate": clean(est), "actual": clean(actual),
            "surprisePct": clean((actual - est) / abs(est)) if est is not None and not pd.isna(est) and est != 0 else None,
            "move1d": round(float(closes.iloc[b] / closes.iloc[a] - 1), 5),
        })
    return out


def watch_points(q):
    """Plain language observations from the last quarters (the judgement part of the briefing)."""
    pts = []
    if len(q) >= 5 and q[0].get("revenue") and q[4].get("revenue") and q[1].get("revenue") and len(q) >= 6 and q[5].get("revenue"):
        g0 = q[0]["revenue"] / q[4]["revenue"] - 1
        g1 = q[1]["revenue"] / q[5]["revenue"] - 1
        word = "accelerated" if g0 > g1 + 0.005 else "decelerated" if g0 < g1 - 0.005 else "held steady"
        pts.append(f"Revenue growth {word}: {g0:+.1%} year on year in the latest quarter vs {g1:+.1%} in the prior one")
    if len(q) >= 2 and all(q[i].get("revenue") and q[i].get("operatingIncome") is not None for i in (0, 1)):
        m0 = q[0]["operatingIncome"] / q[0]["revenue"]
        m1 = q[1]["operatingIncome"] / q[1]["revenue"]
        pts.append(f"Operating margin {'expanded' if m0 > m1 else 'compressed'} to {m0:.1%} from {m1:.1%} quarter on quarter")
    if len(q) >= 2 and all(q[i].get("revenue") and q[i].get("grossProfit") for i in (0, 1)):
        g0 = q[0]["grossProfit"] / q[0]["revenue"]
        g1 = q[1]["grossProfit"] / q[1]["revenue"]
        if abs(g0 - g1) > 0.003:
            pts.append(f"Gross margin moved to {g0:.1%} from {g1:.1%}")
    return pts


def quarterly(t):
    out = []
    try:
        inc = t.quarterly_income_stmt
        if inc is None or inc.empty:
            return out
        def get(name, col):
            return clean(inc.loc[name, col]) if name in inc.index else None
        for col in list(inc.columns)[:8]:
            out.append({
                "period": col.strftime("%Y-%m-%d"),
                "revenue": get("Total Revenue", col), "grossProfit": get("Gross Profit", col),
                "operatingIncome": get("Operating Income", col), "netIncome": get("Net Income", col),
                "eps": get("Diluted EPS", col) or get("Basic EPS", col),
            })
    except Exception as e:
        print("  quarterly statements unavailable:", e)
    return out


def build(sym):
    t = yf.Ticker(sym)
    info = t.info or {}
    hist = t.history(period="3y", interval="1d", auto_adjust=True)
    closes = hist["Close"].dropna()
    price = float(closes.iloc[-1])
    perf = lambda n: float(price / closes.iloc[-1 - n] - 1) if len(closes) > n else None

    earn_dates = None
    try:
        earn_dates = t.get_earnings_dates(limit=16)
    except Exception as e:
        print("  earnings dates unavailable:", e)

    nxt = None
    if earn_dates is not None and len(earn_dates):
        upcoming = earn_dates[earn_dates["Reported EPS"].isna()]
        now = pd.Timestamp.now(tz=upcoming.index.tz) if len(upcoming) else None
        upcoming = upcoming[upcoming.index >= now - pd.Timedelta(days=1)] if len(upcoming) else upcoming
        if len(upcoming):
            ts = upcoming.index.min()
            nxt = {"date": ts.date().isoformat(), "timing": "after close" if ts.hour >= 16 else "before open", "confirmed": True}
    if nxt is None:
        try:
            cal = t.calendar or {}
            ed = cal.get("Earnings Date") or []
            if ed:
                nxt = {"date": clean(ed[0]), "timing": None, "confirmed": len(ed) == 1,
                       "rangeEnd": clean(ed[-1]) if len(ed) > 1 else None}
        except Exception:
            pass

    hist_rows = []
    try:
        eh = t.earnings_history
        if eh is not None and len(eh):
            for q, r in eh.iterrows():
                hist_rows.append({"quarter": clean(q) if not hasattr(q, "strftime") else q.strftime("%Y-%m-%d"),
                                  "estimate": clean(r.get("epsEstimate")), "actual": clean(r.get("epsActual")),
                                  "surprisePct": clean(r.get("surprisePercent"))})
    except Exception as e:
        print("  earnings history unavailable:", e)

    targets = None
    try:
        pt = t.analyst_price_targets
        if pt:
            targets = {k: clean(pt.get(k)) for k in ("current", "low", "high", "mean", "median")}
    except Exception:
        pass

    ratings = None
    try:
        rec = t.recommendations
        if rec is not None and len(rec):
            r0 = rec.iloc[0]
            ratings = {k: clean(r0.get(k)) for k in ("strongBuy", "buy", "hold", "sell", "strongSell")}
    except Exception:
        pass

    q = quarterly(t)
    return {
        "symbol": sym, "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance via yfinance",
        "name": clean(info.get("shortName") or info.get("longName") or sym),
        "sector": clean(info.get("sector")), "industry": clean(info.get("industry")),
        "currency": clean(info.get("currency")), "price": round(price, 4),
        "perf1w": perf(5), "perf1m": perf(21), "perf1y": perf(252),
        "marketCap": clean(info.get("marketCap")),
        "trailingPE": clean(info.get("trailingPE")), "forwardPE": clean(info.get("forwardPE")),
        "trailingEps": clean(info.get("trailingEps")), "forwardEps": clean(info.get("forwardEps")),
        "nextEarnings": nxt,
        "eps": {"quarter": row(getattr(t, "earnings_estimate", None), "0q"), "year": row(getattr(t, "earnings_estimate", None), "0y"),
                "nextYear": row(getattr(t, "earnings_estimate", None), "+1y")},
        "revenue": {"quarter": row(getattr(t, "revenue_estimate", None), "0q"), "year": row(getattr(t, "revenue_estimate", None), "0y")},
        "history": hist_rows,
        "reactions": reactions(earn_dates, hist),
        "targets": targets, "ratings": ratings,
        "quarterly": q, "watch": watch_points(q),
    }


def main():
    done = []
    for sym in watchlist()["earnings"]:
        try:
            write_json(os.path.join(DATA, "earnings", file_name(sym) + ".json"), build(sym))
            done.append(sym)
            print("ok  ", sym)
        except Exception as e:
            print("fail", sym, e)
    update_index("earnings", done)
    if not done:
        sys.exit("No earnings data built")


if __name__ == "__main__":
    main()
