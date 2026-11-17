"""Shared helpers for the data pipeline."""
import json, math, os, re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get("FIN_DATA_DIR") or os.path.join(ROOT, "data")


def watchlist():
    with open(os.path.join(ROOT, "pipeline", "watchlist.json")) as f:
        return json.load(f)


def file_name(sym):
    return re.sub(r"[^A-Za-z0-9.\-^=]", "_", sym)


def clean(v):
    """Make a value JSON safe: NaN and inf become None, numpy and pandas scalars become Python types."""
    if v is None:
        return None
    if hasattr(v, "item"):
        try:
            v = v.item()
        except Exception:
            pass
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"), default=clean)


def update_index(key, symbols):
    path = os.path.join(DATA, "index.json")
    ix = {}
    if os.path.exists(path):
        with open(path) as f:
            ix = json.load(f)
    ix[key] = sorted(symbols)
    ix["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ix["source"] = "Yahoo Finance via yfinance"
    write_json(path, ix)
