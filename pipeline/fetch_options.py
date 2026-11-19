"""Download option chains for the options page and write data/options/<SYMBOL>.json.

For every symbol in watchlist.json "options" it stores the spot price, the dividend yield and a set of
expiries spread from one week to about two years. For each expiry it keeps calls and puts with a quote
(bid, ask, last, volume, open interest and Yahoo's own implied volatility) between 50% and 170% of spot.

The website does not trust Yahoo's implied volatility: it backs out the forward price and discount
factor from put call parity and solves Black's formula for each mid price itself. Yahoo's number is kept
only as a cross check. Treasury yields (13 week, 5 and 10 year) are stored for the rate curve.

Data: Yahoo Finance via yfinance. Research and education only.
"""
import os
from datetime import datetime, timezone, date
import yfinance as yf
from common import DATA, watchlist, file_name, write_json, clean

TARGET_DAYS = [7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365, 450, 540, 730]


def pick_expiries(expiries, today):
    """Choose the listed expiry closest to each target maturity, without duplicates."""
    days = [(e, (datetime.strptime(e, "%Y-%m-%d").date() - today).days) for e in expiries]
    days = [(e, d) for e, d in days if d >= 3]
    out = []
    for t in TARGET_DAYS:
        if not days:
            break
        e, d = min(days, key=lambda x: abs(x[1] - t))
        if abs(d - t) <= max(5, 0.25 * t) and e not in out:
            out.append(e)
    return out


def side(df, spot):
    rows = []
    for _, r in df.iterrows():
        k = float(r["strike"])
        if k < 0.5 * spot or k > 1.7 * spot:
            continue
        bid, ask = clean(r.get("bid")), clean(r.get("ask"))
        if not bid and not ask and not clean(r.get("lastPrice")):
            continue
        rows.append([k, bid, ask, clean(r.get("lastPrice")), clean(r.get("volume")) or 0,
                     clean(r.get("openInterest")) or 0, clean(r.get("impliedVolatility"))])
    return rows


def rates():
    out = {}
    for sym, key in (("^IRX", "y13w"), ("^FVX", "y5"), ("^TNX", "y10")):
        try:
            h = yf.Ticker(sym).history(period="10d")
            out[key] = round(float(h["Close"].dropna().iloc[-1]) / 100, 5)
        except Exception as e:
            print("rate fail", sym, e)
    return out


def main():
    wl = watchlist()
    syms = wl.get("options", {}).get("symbols", [])
    today = date.today()
    r = rates()
    done = []
    for sym in syms:
        try:
            t = yf.Ticker(sym)
            h = t.history(period="5d")
            spot = round(float(h["Close"].dropna().iloc[-1]), 4)
            info = {}
            try:
                info = t.info or {}
            except Exception:
                pass
            exps = pick_expiries(list(t.options), today)
            chains = []
            for e in exps:
                try:
                    ch = t.option_chain(e)
                    chains.append({"expiry": e, "days": (datetime.strptime(e, "%Y-%m-%d").date() - today).days,
                                   "calls": side(ch.calls, spot), "puts": side(ch.puts, spot)})
                except Exception as ex:
                    print("chain fail", sym, e, ex)
            dy = clean(info.get("dividendYield"))
            write_json(os.path.join(DATA, "options", file_name(sym) + ".json"), {
                "symbol": sym, "name": clean(info.get("shortName") or sym), "currency": clean(info.get("currency")),
                "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "valueDate": today.isoformat(),
                "spot": spot, "dividendYield": (dy / 100 if dy is not None else None), "rates": r,
                "columns": ["strike", "bid", "ask", "last", "volume", "openInterest", "yahooIV"],
                "chains": chains})
            done.append(sym)
            print("ok", sym, spot, len(chains), "expiries")
        except Exception as e:
            print("fail", sym, e)
    write_json(os.path.join(DATA, "options", "index.json"), {"symbols": done, "rates": r,
               "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")})


if __name__ == "__main__":
    main()
