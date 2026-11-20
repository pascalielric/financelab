/* Home page: clickable case cards and live result lines for the analytics cards */
(function () {
  "use strict";
  const $ = function (id) { return document.getElementById(id); };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = function (iso) { const d = iso.slice(0, 10).split("-"); return (+d[2]) + " " + MON[+d[1] - 1] + " " + d[0]; };

  // Options: one month at the money implied volatility of SPY, from the same surface fit as the options page
  async function optionsLine() {
    const d = await fetch("data/options/SPY.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; });
    if (!d) throw new Error();
    const O = window.Options, r = d.rates.y13w, q = d.dividendYield || 0;
    const sl = d.chains.map(function (ch) { const T = Math.max(ch.days, 1) / 365; const s = O.slice(ch, d.spot, T, r, q); s.days = ch.days; s.T = T; s.svi = s.pts.length >= 6 ? O.fitSvi(s.pts, T) : null; return s; })
      .filter(function (s) { return s.svi && s.svi.rmse < 0.06; });
    let a = sl[0], b = sl[sl.length - 1];
    for (let i = 0; i < sl.length - 1; i++) if (sl[i].days <= 30 && sl[i + 1].days >= 30) { a = sl[i]; b = sl[i + 1]; break; }
    const wa = O.sviW(a.svi, 0), wb = O.sviW(b.svi, 0), x = (30 - a.days) / (b.days - a.days || 1), w = wa + x * (wb - wa);
    const v = Math.sqrt(w / (30 / 365));
    $("rOptions").innerHTML = "S&amp;P 500 one month implied volatility: <b>" + UI.pct(v, 1) + "</b> (expected move about ±" + UI.pct(v * Math.sqrt(30 / 365), 1) + ", " + day(d.asOf) + ")";
  }

  // Portfolio: historical 95% one day value at risk of the default model portfolio on the Portfolio Risk page
  async function portfolioLine() {
    const P = PF.PRESETS[2], syms = P.h.map(function (r) { return r[0]; });
    const h = await API.history(syms, 505);
    const al = RISK.align(h.data, syms);
    const R = al.prices.map(RISK.logReturns);
    const tot = P.h.reduce(function (s, r) { return s + r[1]; }, 0), w = P.h.map(function (r) { return r[1] / tot; });
    const rp = RISK.portfolioReturns(R, w);
    const v = RISK.historicalVar(rp, 1, 0.95, 1);
    $("rPortfolio").innerHTML = "95% one day value at risk: <b>" + UI.pct(v, 2) + "</b> of value for the " + P.name.toLowerCase() + " portfolio (two years of daily data)";
  }

  // Monte Carlo: the same 10,000 run Givaudan valuation (same seed) as the Monte Carlo page
  async function monteLine() {
    const G = window.GIVAUDAN, sc = G.scenarios.base;
    const price = G.referencePrice;
    const a = Object.assign({}, G.common, { base: G.base, years: G.years, growth: sc.growth, ebitdaMargin: sc.ebitdaMargin, tgr: sc.tgr, exitMultiple: sc.exitMultiple, netDebt: G.netDebt, otherClaims: G.otherClaims, sharesOut: G.sharesOut, price: G.referencePrice });
    const ds = { sg: 0.01, sm: 0.01, sw: 0.004, st: 0.0035, sx: 2 };
    const shifted = function (dg, dm, w, t, x) { return Object.assign({}, a, { growth: a.growth.map(function (v) { return v + dg; }), ebitdaMargin: a.ebitdaMargin.map(function (v) { return v + dm; }), waccOverride: w, tgr: t, exitMultiple: x }); };
    const w0 = DCF.run(a).r, rnd = UI.rng(13579), N = 10000; let above = 0;
    for (let i = 0; i < N; i++) {
      const t = Math.min(0.03, Math.max(0.005, a.tgr + ds.st * UI.gauss(rnd)));
      const wv = Math.max(t + 0.01, w0 + ds.sw * UI.gauss(rnd));
      if (DCF.run(shifted(ds.sg * UI.gauss(rnd), ds.sm * UI.gauss(rnd), wv, t, Math.max(8, a.exitMultiple + ds.sx * UI.gauss(rnd)))).blended.perShare > price) above++;
    }
    $("rMonte").innerHTML = "Givaudan valuation, 10,000 runs: <b>" + UI.pct(above / N, 0) + "</b> of outcomes above the share price of CHF " + UI.fmt(price) + " (" + G.referencePriceDate + ")";
  }

  // Earnings: the next report among the companies analysed on this site
  async function earningsLine() {
    const list = ["NKE", "GIVN.SW", "TEMN.SW", "ONON"];
    const ds = (await Promise.all(list.map(function (s) { return API.localEarnings(s); }))).filter(function (d) { return d && d.nextEarnings && d.nextEarnings.date; });
    const today = new Date().toISOString().slice(0, 10);
    const next = ds.filter(function (d) { return d.nextEarnings.date >= today; }).sort(function (x, y) { return x.nextEarnings.date < y.nextEarnings.date ? -1 : 1; })[0];
    if (!next) throw new Error();
    const e = next.eps && next.eps.quarter;
    const nm = (next.name || next.symbol).replace(/,? Inc\.?$/, "").replace(/ AG$/, "");
    $("rEarnings").innerHTML = "Next report: <b>" + UI.esc(nm) + ", " + day(next.nextEarnings.date) + "</b>" + (e && e.avg ? " · consensus earnings per share " + (e.currency || "") + " " + e.avg.toFixed(2) : "");
  }

  function safe(fn, id, fallback) { fn().catch(function () { $(id).textContent = fallback; }); }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".project-card.case").forEach(function (c) {
      c.addEventListener("click", function (e) { if (!e.target.closest("a")) location.href = c.getAttribute("data-href"); });
    });
    safe(optionsLine, "rOptions", "Live implied volatility surface for six underlyings");
    safe(portfolioLine, "rPortfolio", "Value at risk, drawdowns and the efficient frontier");
    safe(earningsLine, "rEarnings", "Consensus, track record and three scenarios");
    setTimeout(function () { safe(monteLine, "rMonte", "Distribution of value per share for Givaudan"); }, 300);
  });
})();
