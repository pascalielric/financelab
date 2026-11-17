"""Download three years of daily adjusted closes for the watchlist and write data/prices/<SYMBOL>.json.

Run locally:  pip install -r pipeline/requirements.txt && python pipeline/fetch_prices.py
In production this runs every weekday in GitHub Actions (.github/workflows/refresh-data.yml).
"""
import os, sys
import yfinance as yf
from common import DATA, watchlist, file_name, write_json, update_index, clean


def to_series(df):
    """Return (dates, closes) from a single ticker history frame, dropping missing values."""
    s = df["Close"].dropna()
    return [d.strftime("%Y-%m-%d") for d in s.index], [round(float(v), 4) for v in s.values]


def main():
    wl = watchlist()
    symbols = list(dict.fromkeys(wl["benchmarks"] + wl["prices"] + wl["earnings"]))
    done = []
    for sym in symbols:
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="3y", interval="1d", auto_adjust=True)
            if hist is None or len(hist) < 60:
                print("skip", sym, "(no history)")
                continue
            dates, close = to_series(hist)
            info = {}
            try:
                info = t.info or {}
            except Exception:
                pass
            write_json(os.path.join(DATA, "prices", file_name(sym) + ".json"), {
                "symbol": sym,
                "name": clean(info.get("shortName") or info.get("longName") or sym),
                "currency": clean(info.get("currency")),
                "sector": clean(info.get("sector")),
                "dates": dates, "close": close,
            })
            done.append(sym)
            print("ok  ", sym, len(dates), "days, last", dates[-1], close[-1])
        except Exception as e:  # keep going: one bad ticker must not break the refresh
            print("fail", sym, e)
    update_index("prices", done)
    if not done:
        sys.exit("No price data downloaded")


if __name__ == "__main__":
    main()
