/* Market data layer: Finnhub (quotes, earnings, profile) and Twelve Data (daily history).
   Responses are cached in localStorage. Without a Twelve Data key, history falls back to clearly labelled
   simulated demo prices so every tool still runs. */
(function () {
  "use strict";
  const FH = "https://finnhub.io/api/v1";
  const TD = "https://api.twelvedata.com";

  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

  function keys() {
    const user = load("fin_keys") || {};
    const cfg = window.SITE_CONFIG || {};
    return { finnhub: user.finnhub || cfg.finnhubKey || "", twelve: user.twelve || cfg.twelveDataKey || "" };
  }
  function setKeys(k) { store("fin_keys", k); }
  function hasLive() { const k = keys(); return !!(k.finnhub || k.twelve); }

  async function cached(key, ttlMin, fn) {
    const hit = load("c_" + key);
    if (hit && Date.now() - hit.t < ttlMin * 60000) return hit.v;
    const v = await fn();
    store("c_" + key, { t: Date.now(), v: v });
    return v;
  }

  async function fh(path, params) {
    const k = keys().finnhub;
    if (!k) throw new Error("No Finnhub key. Click Data in the header to add a free key.");
    const q = new URLSearchParams(Object.assign({}, params, { token: k }));
    const res = await fetch(FH + path + "?" + q.toString());
    if (res.status === 429) throw new Error("Finnhub rate limit reached, try again in a minute.");
    if (res.status === 401 || res.status === 403) throw new Error("Finnhub rejected the key or this symbol is not covered on the free plan.");
    if (!res.ok) throw new Error("Finnhub error " + res.status);
    return res.json();
  }

  const ttl = function () { return (window.SITE_CONFIG && window.SITE_CONFIG.cacheMinutes) || 30; };
  const iso = function (d) { return d.toISOString().slice(0, 10); };

  async function quote(sym) {
    return cached("q_" + sym, 2, async function () {
      const d = await fh("/quote", { symbol: sym });
      if (!d || !d.c) throw new Error("No quote for " + sym + " (free plans cover mainly US listings; try the US ADR).");
      return { price: d.c, change: d.d, pct: d.dp / 100, prevClose: d.pc, high: d.h, low: d.l, time: d.t * 1000 };
    });
  }
  async function profile(sym) { return cached("p_" + sym, 1440, function () { return fh("/stock/profile2", { symbol: sym }); }); }
  async function metrics(sym) { return cached("m_" + sym, 720, async function () { const d = await fh("/stock/metric", { symbol: sym, metric: "all" }); return d.metric || {}; }); }
  async function recommendation(sym) { return cached("r_" + sym, 720, function () { return fh("/stock/recommendation", { symbol: sym }); }); }
  async function epsHistory(sym) { return cached("e_" + sym, 720, function () { return fh("/stock/earnings", { symbol: sym }); }); }
  async function earningsCalendar(sym, fromDays, toDays) {
    const from = new Date(Date.now() + fromDays * 864e5), to = new Date(Date.now() + toDays * 864e5);
    return cached("cal_" + sym + fromDays + "_" + toDays, 720, async function () {
      const d = await fh("/calendar/earnings", { symbol: sym, from: iso(from), to: iso(to) });
      return (d && d.earningsCalendar) || [];
    });
  }

  /* Local data written by the daily pipeline (pipeline/*.py, yfinance, run by GitHub Actions).
     data/index.json lists the universe; data/prices/SYM.json holds daily closes; data/earnings/SYM.json the earnings briefing. */
  let _index;
  async function localIndex() {
    if (_index !== undefined) return _index;
    try { const r = await fetch("data/index.json", { cache: "no-cache" }); _index = r.ok ? await r.json() : null; } catch (e) { _index = null; }
    return _index;
  }
  function fileName(sym) { return sym.replace(/[^A-Za-z0-9.\-^=]/g, "_"); }
  async function localPrices(sym) {
    const ix = await localIndex();
    if (!ix || !ix.prices || ix.prices.indexOf(sym) < 0) return null;
    try {
      const r = await fetch("data/prices/" + fileName(sym) + ".json", { cache: "no-cache" });
      if (!r.ok) return null;
      const d = await r.json();
      return { meta: d, series: d.dates.map(function (dt, i) { return { date: dt, close: d.close[i], volume: 0 }; }) };
    } catch (e) { return null; }
  }
  async function localQuote(sym) {
    const p = await localPrices(sym);
    if (!p || !p.series.length) return null;
    const n = p.series.length, last = p.series[n - 1], prev = p.series[n - 2] || last;
    return { price: last.close, date: last.date, pct: last.close / prev.close - 1, currency: p.meta.currency, name: p.meta.name };
  }
  async function localEarnings(sym) {
    const ix = await localIndex();
    if (!ix || !ix.earnings || ix.earnings.indexOf(sym) < 0) return null;
    try { const r = await fetch("data/earnings/" + fileName(sym) + ".json", { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch (e) { return null; }
  }

  /* Daily history, ascending. Order of preference: local pipeline data, Twelve Data (if key), simulated demo. Returns { data: {SYM: [{date, close, volume}]}, demo: bool, errors: {} } */
  async function history(symbols, outputsize, onStatus) {
    outputsize = outputsize || 520;
    const k = keys().twelve;
    const syms = symbols.map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
    const data = {}, errors = {}, source = {};
    let todo = [];
    for (const s of syms) {
      const lp = await localPrices(s);
      if (lp && lp.series.length > 60) { data[s] = lp.series.slice(-outputsize); source[s] = "daily"; } else todo.push(s);
    }
    if (!k) {
      todo.forEach(function (s) { data[s] = demoSeries(s, outputsize); source[s] = "demo"; });
      return { data: data, demo: todo.length > 0, demoSymbols: todo, source: source, errors: {}, updated: (await localIndex() || {}).updated };
    }
    todo = todo.filter(function (s) {
      const hit = load("c_h_" + s + "_" + outputsize);
      if (hit && Date.now() - hit.t < ttl() * 60000) { data[s] = hit.v; source[s] = "live"; return false; }
      return true;
    });
    // Free plan: 8 credits per minute, one credit per symbol
    for (let i = 0; i < todo.length; i += 8) {
      if (i > 0) {
        for (let w = 61; w > 0; w--) { if (onStatus) onStatus("Free plan limit: waiting " + w + "s for the next batch"); await new Promise(function (r) { setTimeout(r, 1000); }); }
      }
      const chunk = todo.slice(i, i + 8);
      if (onStatus) onStatus("Loading " + chunk.join(", "));
      const q = new URLSearchParams({ symbol: chunk.join(","), interval: "1day", outputsize: String(outputsize), apikey: k, order: "ASC" });
      const res = await fetch(TD + "/time_series?" + q.toString());
      const body = await res.json();
      if (body && body.status === "error") { chunk.forEach(function (s) { errors[s] = body.message; }); continue; }
      const map = chunk.length === 1 ? { [chunk[0]]: body } : body;
      chunk.forEach(function (s) {
        const r = map[s];
        if (!r || r.status === "error" || !r.values) { errors[s] = (r && r.message) || "No data"; return; }
        const vals = r.values.map(function (v) { return { date: v.datetime, close: +v.close, volume: +v.volume || 0 }; });
        vals.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        data[s] = vals; source[s] = "live";
        store("c_h_" + s + "_" + outputsize, { t: Date.now(), v: vals });
      });
    }
    return { data: data, demo: false, demoSymbols: [], source: source, errors: errors, updated: (await localIndex() || {}).updated };
  }

  // Deterministic simulated prices (seeded by ticker) so the tools work without keys
  function demoSeries(sym, n) {
    let seed = 0; for (let i = 0; i < sym.length; i++) seed = (seed * 31 + sym.charCodeAt(i)) >>> 0;
    const rnd = UI.rng(seed + 7);
    const mkt = UI.rng(424242);
    const beta = 0.6 + (seed % 90) / 100;
    const idio = 0.010 + (seed % 17) / 1000;
    const drift = 0.0002 + ((seed % 11) - 4) / 25000;
    let p = 50 + (seed % 400);
    const out = [];
    const d = new Date(); d.setDate(d.getDate() - Math.round(n * 1.45));
    for (let i = 0; i < n; i++) {
      do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
      const m = UI.gauss(mkt) * 0.009;
      const r = drift + beta * m + idio * UI.gauss(rnd);
      p = p * Math.exp(r);
      out.push({ date: iso(d), close: +p.toFixed(2), volume: Math.round(1e6 * (1 + Math.abs(UI.gauss(rnd)))) });
    }
    return out;
  }

  window.API = { localIndex, localPrices, localQuote, localEarnings, keys, setKeys, hasLive, quote, profile, metrics, recommendation, epsHistory, earningsCalendar, history };
})();
