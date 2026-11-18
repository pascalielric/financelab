/* Earnings page controller */
(function () {
  "use strict";
  const $ = function (id) { return document.getElementById(id); };
  const big = function (v, cur) { if (v == null) return "n.a."; const a = Math.abs(v); return (cur ? cur + " " : "") + (a >= 1e12 ? (v / 1e12).toFixed(2) + " tn" : a >= 1e9 ? (v / 1e9).toFixed(1) + " bn" : a >= 1e6 ? (v / 1e6).toFixed(0) + " m" : UI.fmt(v)); };
  const num = function (v, d) { return v == null ? "n.a." : v.toFixed(d == null ? 2 : d); };

  // Fictional company so the page can be explored before any data source is connected
  const SAMPLE = {
    symbol: "SAMPLE", name: "Helvetia Software AG (fictional sample)", sector: "Technology", industry: "Software", currency: "CHF", price: 142.5,
    perf1w: 0.012, perf1m: 0.046, perf1y: 0.18, marketCap: 2.1e10, trailingPE: 31.0, forwardPE: 26.5, sample: true,
    nextEarnings: { date: "2027-02-10", timing: "before open", confirmed: true },
    eps: { quarter: { numberOfAnalysts: 18, avg: 1.42, low: 1.31, high: 1.53, yearAgoEps: 1.26, growth: 0.127 }, year: { numberOfAnalysts: 22, avg: 5.38, low: 5.1, high: 5.7, growth: 0.12 }, nextYear: { numberOfAnalysts: 22, avg: 6.05, low: 5.6, high: 6.5, growth: 0.125 } },
    revenue: { quarter: { numberOfAnalysts: 16, avg: 6.4e8, low: 6.2e8, high: 6.6e8, yearAgoRevenue: 5.8e8, growth: 0.103 } },
    history: [],
    reactions: [["2026-11-04", 1.33, 1.38, 0.031], ["2026-08-05", 1.28, 1.27, -0.042], ["2026-05-06", 1.2, 1.26, 0.055], ["2026-02-11", 1.22, 1.26, 0.012], ["2025-11-05", 1.15, 1.21, 0.047], ["2025-08-06", 1.1, 1.08, -0.061], ["2025-05-07", 1.04, 1.09, 0.022], ["2025-02-12", 1.05, 1.1, 0.038]]
      .map(function (r) { return { date: r[0], timing: "before open", estimate: r[1], actual: r[2], surprisePct: (r[2] - r[1]) / r[1], move1d: r[3] }; }),
    targets: { current: 142.5, low: 118, mean: 158, median: 160, high: 185 }, ratings: { strongBuy: 6, buy: 9, hold: 6, sell: 1, strongSell: 0 },
    quarterly: [["2026-09-30", 6.1e8, 1.52e8], ["2026-06-30", 5.9e8, 1.4e8], ["2026-03-31", 5.7e8, 1.35e8], ["2025-12-31", 5.8e8, 1.42e8], ["2025-09-30", 5.5e8, 1.27e8], ["2025-06-30", 5.3e8, 1.2e8]].map(function (q) { return { period: q[0], revenue: q[1], operatingIncome: q[2] }; }),
    watch: ["Revenue growth decelerated: +10.9% year on year in the latest quarter vs +11.3% in the prior one", "Operating margin expanded to 24.9% from 23.7% quarter on quarter", "Guidance for the next quarter usually moves the share price more than the reported EPS"]
  };

  function status(msg, cls) { const s = $("status"); s.className = "status " + (cls || ""); s.textContent = msg; s.classList.toggle("hidden", !msg); }

  // Finnhub fallback for tickers outside the daily watchlist, mapped to the same structure
  async function fromFinnhub(sym) {
    const res = await Promise.all([API.quote(sym), API.profile(sym).catch(function () { return {}; }), API.epsHistory(sym).catch(function () { return []; }),
      API.earningsCalendar(sym, -1, 120).catch(function () { return []; }), API.recommendation(sym).catch(function () { return []; }), API.metrics(sym).catch(function () { return {}; })]);
    const q = res[0], p = res[1], eh = res[2] || [], cal = (res[3] || []).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0], rec = (res[4] || [])[0], m = res[5];
    return {
      symbol: sym, name: p.name || sym, sector: p.finnhubIndustry, industry: null, currency: p.currency || "USD", price: q.price, source: "Finnhub (live)",
      marketCap: p.marketCapitalization ? p.marketCapitalization * 1e6 : null, trailingPE: m.peTTM || null, forwardPE: m.peTTM ? m.peTTM * 0.92 : null,
      perf1w: m["5DayPriceReturnDaily"] != null ? m["5DayPriceReturnDaily"] / 100 : null, perf1m: m["monthToDatePriceReturnDaily"] != null ? m["monthToDatePriceReturnDaily"] / 100 : null,
      nextEarnings: cal ? { date: cal.date, timing: cal.hour === "amc" ? "after close" : cal.hour === "bmo" ? "before open" : null, confirmed: true } : null,
      eps: { quarter: cal && cal.epsEstimate != null ? { avg: cal.epsEstimate } : (eh[0] ? { avg: eh[0].estimate } : {}), year: {} },
      revenue: { quarter: cal && cal.revenueEstimate ? { avg: cal.revenueEstimate } : null },
      history: eh.map(function (e) { return { quarter: e.period, estimate: e.estimate, actual: e.actual, surprisePct: e.surprisePercent != null ? e.surprisePercent / 100 : null }; }).reverse(),
      reactions: [], targets: null, ratings: rec ? { strongBuy: rec.strongBuy, buy: rec.buy, hold: rec.hold, sell: rec.sell, strongSell: rec.strongSell } : null, quarterly: [], watch: []
    };
  }

  async function load(sym) {
    sym = sym.trim().toUpperCase();
    if (!sym) return;
    status("Loading " + sym + "…");
    try {
      let d = sym === "SAMPLE" ? SAMPLE : await API.localEarnings(sym);
      if (!d) d = await fromFinnhub(sym);
      status("");
      render(d);
    } catch (e) { status(e.message, "err"); }
  }

  function render(d) {
    // Keep only reports from the last four years: older rows say nothing about the company today
    const cutoff = new Date(Date.now() - 4 * 365 * 864e5).toISOString().slice(0, 10);
    d = Object.assign({}, d, { reactions: (d.reactions || []).filter(function (r) { return r.date >= cutoff; }) });
    const A = EARN.analyse(d), cur = d.currency || "", q = (d.eps && d.eps.quarter) || {};
    const thin = A.consensus == null || A.n < 4;   // typical for Swiss companies that report half yearly
    $("out").classList.remove("hidden");
    $("srcNote").innerHTML = d.sample ? '<div class="callout warn" style="margin-top:16px"><strong>Illustrative sample.</strong> This company and all its figures are invented to show how the page works. Real companies appear in the list once the daily data refresh has run, or type a US ticker after adding a free Finnhub key via the Data button.</div>' :
      '<p class="note" style="margin-top:14px">Data: ' + UI.esc(d.source || "") + (d.asOf ? ", refreshed " + d.asOf.slice(0, 10) : "") + ". Estimates can change until the report date.</p>";
    $("coName").textContent = d.name + (d.sample ? "" : " (" + d.symbol + ")");
    $("coMeta").textContent = [d.sector, d.industry, "Market cap " + big(d.marketCap, cur)].filter(Boolean).join(" · ");
    const lc = A.lean === "Positive" ? "buy" : A.lean === "Negative" ? "sell" : "hold";
    $("lean").innerHTML = '<span class="badge ' + lc + '">Model lean: ' + A.lean + '</span> &nbsp;<span class="note">Confidence ' + A.confidence.toLowerCase() + "</span>";

    const ne = d.nextEarnings, days = ne && ne.date ? Math.round((new Date(ne.date) - new Date()) / 864e5) : null;
    $("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">Next earnings report</div><div class="value" style="font-size:1.45rem">' + (ne && ne.date ? new Date(ne.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not scheduled") + '</div><div class="sub">' + (ne ? [(days != null ? (days >= 0 ? "in " + days + " days" : Math.abs(days) + " days ago") : ""), ne.timing, ne.confirmed === false ? "estimated window" : ""].filter(Boolean).join(", ") : "") + "</div></div>" +
      '<div class="kpi"><div class="label">Share price</div><div class="value">' + cur + " " + num(d.price) + '</div><div class="sub">1 week ' + UI.signPct(d.perf1w) + ", 1 month " + UI.signPct(d.perf1m) + "</div></div>" +
      '<div class="kpi"><div class="label">Consensus EPS</div><div class="value">' + num(A.consensus) + '</div><div class="sub">' + (q.numberOfAnalysts ? q.numberOfAnalysts + " analysts, " : "") + (q.growth != null ? UI.signPct(q.growth) + " year on year" : "") + "</div></div>" +
      '<div class="kpi"><div class="label">Probability of a beat</div><div class="value">' + (thin ? "n.a." : UI.pct(A.pBeat, 0)) + '</div><div class="sub">' + (A.n ? A.beats + " beats in last " + A.n + " reports" : "no history") + "</div></div>" +
      '<div class="kpi"><div class="label">Typical move on results</div><div class="value">' + (thin ? "n.a." : "±" + UI.pct(A.absMove)) + '</div><div class="sub">' + (thin ? "" : cur + " " + num(A.impliedRange[0]) + " to " + num(A.impliedRange[1])) + "</div></div>";

    const col = { bull: "#2F4A36", base: "#00011F", bear: "#7A1E1E" };
    if (thin) {
      $("scen").innerHTML = "";
      $("pred").innerHTML = "<strong>No scenario for the next report.</strong> The data source has no quarterly EPS consensus or fewer than four recent reports for this company, which is typical for Swiss companies that report half yearly. A beat probability or price reaction estimate would be guesswork, so none is shown. The twelve month view, analyst targets and ratings below are still available.";
      $("scenCharts").classList.add("hidden");
      $("lean").innerHTML = "";
    } else {
      $("scenCharts").classList.remove("hidden");
      $("scen").innerHTML = A.scenarios.map(function (s) {
        return '<div class="card" style="border-top:2px solid ' + col[s.key] + '"><div class="row" style="justify-content:space-between"><h3 style="margin:0;font-size:1.4rem;text-transform:none;letter-spacing:0;color:#111111">' + s.label + ' case</h3><span class="badge" style="background:' + col[s.key] + ';color:#fff">' + UI.pct(s.prob, 0) + " probability</span></div>" +
          '<p style="min-height:42px">' + s.story + '</p><div class="grid g2" style="gap:10px"><div class="kpi"><div class="label">EPS</div><div class="value" style="font-size:1.4rem">' + num(s.eps) + '</div><div class="sub">' + UI.signPct(s.surprise) + ' vs. consensus</div></div>' +
          '<div class="kpi"><div class="label">Next day price</div><div class="value ' + UI.cls(s.move) + '" style="font-size:1.4rem">' + num(s.price) + '</div><div class="sub">' + UI.signPct(s.move) + "</div></div></div></div>";
      }).join("");
      $("pred").innerHTML = "<strong>Prediction.</strong> The model expects EPS of about " + num(A.predictedEps) + " against consensus of " + num(A.consensus) + " (" + UI.signPct(A.expSurprise) + "), a " + UI.pct(A.pBeat, 0) + " probability of a beat, and a probability weighted next day move of " + UI.signPct(A.expMove) +
        " to about " + cur + " " + num(A.expPrice) + ". " + (A.reaction.fitted ? "Past reports show that a 1 point EPS surprise moved the share price by about " + (A.reaction.b).toFixed(2) + " points (R² " + num(A.reaction.r2) + ", " + A.reaction.n + " reports)." : (A.reaction.n >= 4 ? "Past reports show no reliable positive link between the size of the surprise and the share price move" : "There are too few past reactions for a regression") + ", so the average absolute move is scaled by the surprise.") +
        (A.spread != null && A.spread > 0.2 ? " The analyst range is wider than 20% of consensus, which signals unusual uncertainty." : "");

      drawScenarios(A, d, cur);
    }
    drawTwelve(d, A, cur, null);
    API.localPrices(d.symbol).then(function (lp) {
      if (!lp || lp.series.length < 200) return;
      const yr = lp.series.slice(-252).map(function (p) { return p.close; });
      drawTwelve(d, A, cur, [Math.min.apply(null, yr), Math.max.apply(null, yr)]);
    });

    // Consensus
    const rq = (d.revenue && d.revenue.quarter) || {}, ey = (d.eps && d.eps.year) || {};
    const rowE = function (name, o, f) { return [name, f(o.avg), f(o.low), f(o.high), o.numberOfAnalysts != null ? String(Math.round(o.numberOfAnalysts)) : "n.a.", f(o.yearAgoEps != null ? o.yearAgoEps : o.yearAgoRevenue), o.growth != null ? UI.signPct(o.growth) : "n.a."]; };
    const f2 = function (v) { return num(v); }, fb = function (v) { return big(v); };
    UI.table("consTable", ["Consensus", "Average", "Low", "High", "Analysts", "Year ago", "Growth"].map(function (h, i) { return { h: h, n: i > 0, f: function (x) { return x[i]; } }; }),
      [rowE("EPS, this quarter", q, f2), rowE("Revenue, this quarter", rq, fb), rowE("EPS, this fiscal year", ey, f2)]);
    const tg = d.targets, rt = d.ratings;
    UI.table("sentTable", [{ h: "Analyst sentiment", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }], [
      ["Price target, mean", tg && tg.mean ? cur + " " + num(tg.mean) + " (" + UI.signPct(tg.mean / d.price - 1) + ")" : "n.a."],
      ["Price target, range", tg && tg.low ? num(tg.low) + " to " + num(tg.high) : "n.a."],
      ["Forward / trailing P/E", (d.forwardPE ? d.forwardPE.toFixed(1) + "x" : "n.a.") + " / " + (d.trailingPE ? d.trailingPE.toFixed(1) + "x" : "n.a.")],
      ["Ratings", rt ? (rt.strongBuy + rt.buy) + " buy, " + rt.hold + " hold, " + (rt.sell + rt.strongSell) + " sell" : "n.a."]
    ]);
    if (rt) drawRatings(rt);
    else $("chRate").innerHTML = "";


    // Track record
    const ev = (d.reactions || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    const rec = ev.length ? ev.map(function (r) { return { label: r.date.slice(0, 7), date: r.date, estimate: r.estimate, actual: r.actual, s: r.surprisePct, move: r.move1d, timing: r.timing }; }) : (d.history || []).map(function (h) { return { label: String(h.quarter).slice(0, 7), date: h.quarter, estimate: h.estimate, actual: h.actual, s: h.surprisePct, move: null }; });
    drawSurprises(rec);
    drawReactions(rec, A);
    UI.table("histTable", [{ h: "Report", f: function (r) { return (r.date || r.label) + (r.timing ? ' <span class="note">' + r.timing + "</span>" : ""); } }, { h: "Consensus EPS", n: 1, f: function (r) { return num(r.estimate); } }, { h: "Reported EPS", n: 1, f: function (r) { return num(r.actual); } },
      { h: "Surprise", n: 1, f: function (r) { return r.s == null ? "n.a." : '<span class="' + UI.cls(r.s) + '">' + UI.signPct(r.s) + "</span>"; } }, { h: "Result", f: function (r) { return r.s == null ? "" : r.s > 0 ? '<span class="badge buy">Beat</span>' : r.s < 0 ? '<span class="badge sell">Miss</span>' : '<span class="badge hold">In line</span>'; } },
      { h: "Next day move", n: 1, f: function (r) { return r.move == null ? "n.a." : '<span class="' + UI.cls(r.move) + '">' + UI.signPct(r.move) + "</span>"; } }], rec.slice().reverse());

    // What to watch
    const w = (d.watch || []).slice();
    if (A.spread != null) w.push("Analyst EPS range spans " + UI.pct(A.spread, 0) + " of consensus (" + num(q.low) + " to " + num(q.high) + ")" + (A.spread > 0.2 ? ", an unusually wide spread" : ""));
    if (A.n) w.push("Average EPS surprise over the last " + A.n + " reports: " + UI.signPct(A.meanSurprise) + ", with a beat in " + A.beats + " of them");
    if (d.perf1m != null && Math.abs(d.perf1m) > 0.08) w.push("The share price has moved " + UI.signPct(d.perf1m) + " in the past month, so a good part of expectations may already be in the price");
    $("watch").innerHTML = w.length ? w.map(function (x) { return "<li style=\"margin-bottom:8px\">" + UI.esc(x) + "</li>"; }).join("") : "<li>No statement data available for this ticker.</li>";
    drawQuarters(d, cur);
  }

  // ---------- Charts. Shared rules: one message per chart, labels on the data, no second axis that competes. ----------
  const C = { bull: "#2F4A36", base: "#00011F", bear: "#7A1E1E", grey: "#9C978C", light: "#CFC9BC", paper: "#FCFBF8" };
  const mon = function (dt) { const x = new Date(dt); return isNaN(x) ? String(dt) : x.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); };

  function drawScenarios(A, d, cur) {
    const S = A.scenarios, keys = ["bull", "base", "bear"];
    const sc = keys.map(function (k) { return S.find(function (x) { return x.key === k; }); });
    // Left: how likely each outcome is
    const pmax = Math.max.apply(null, sc.map(function (x) { return x.prob; }));
    UI.plot("chScen", [{ type: "bar", orientation: "h", y: keys, x: sc.map(function (x) { return x.prob; }), width: 0.5,
      marker: { color: keys.map(function (k) { return C[k]; }) }, text: sc.map(function (x) { return UI.pct(x.prob, 0); }), textposition: "outside", cliponaxis: false,
      textfont: { size: 15, color: "#111111" }, hovertemplate: "%{x:.0%}<extra></extra>" }], {
      height: 300, margin: { l: 190, r: 40, t: 10, b: 30 }, showlegend: false,
      xaxis: { range: [0, Math.min(1, pmax * 1.3)], tickformat: ".0%", showgrid: false, zeroline: false, showticklabels: false },
      yaxis: { tickvals: keys, autorange: "reversed", ticks: "", showgrid: false, tickfont: { size: 15 },
        ticktext: sc.map(function (x) { return x.label + " case<br><span style=\"font-size:12px;color:#6E6A61\">EPS " + num(x.eps) + ", " + UI.signPct(x.surprise) + " vs. consensus</span>"; }) }
    });
    // Right: where the share price could go the day after the report
    const p0 = d.price, prices = sc.map(function (x) { return x.price; }).concat([p0, A.expPrice]);
    const lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices), span = Math.max(hi - lo, p0 * 0.01);
    const rows = keys.concat(["exp"]);
    const ann = sc.map(function (x, i) {
      return { x: Math.max(x.price, p0), y: keys[i], xanchor: "left", xshift: 8, showarrow: false, bgcolor: C.paper,
        text: cur + " " + num(x.price) + " &nbsp;<span style=\"color:#6E6A61\">" + UI.signPct(x.move) + "</span>", font: { size: 14, color: "#111111" } };
    });
    ann.push({ x: Math.max(A.expPrice, p0), y: "exp", xanchor: "left", xshift: 12, showarrow: false, bgcolor: C.paper,
      text: "<i>" + cur + " " + num(A.expPrice) + " &nbsp;" + UI.signPct(A.expMove) + "</i>", font: { size: 14, color: "#111111" } });
    ann.push({ x: p0, yref: "paper", y: 1, yanchor: "bottom", showarrow: false, text: "Today " + cur + " " + num(p0), font: { size: 13, color: "#6E6A61" }, bgcolor: C.paper });
    UI.plot("chPath", [
      { type: "bar", orientation: "h", y: keys, base: sc.map(function () { return p0; }), x: sc.map(function (x) { return x.price - p0; }), width: 0.5,
        marker: { color: keys.map(function (k) { return C[k]; }) }, hoverinfo: "skip" },
      { type: "scatter", mode: "markers", y: ["exp"], x: [A.expPrice], marker: { size: 13, color: "#00011F", symbol: "diamond" }, hoverinfo: "skip" }
    ], {
      height: 300, margin: { l: 150, r: 30, t: 30, b: 30 }, showlegend: false,
      xaxis: { range: [lo - span * 0.5, hi + span * 1.4], showgrid: false, zeroline: false, showticklabels: false },
      yaxis: { tickvals: rows, ticktext: ["Bull case", "Base case", "Bear case", "<i>Probability weighted</i>"], autorange: "reversed", ticks: "", showgrid: false, tickfont: { size: 15 } },
      shapes: [{ type: "line", x0: p0, x1: p0, yref: "paper", y0: 0, y1: 1, line: { color: "#6E6A61", width: 1, dash: "dot" } }],
      annotations: ann
    });
  }

  function drawTwelve(d, A, cur, w52) {
    const t = A.twelve, tg = d.targets, p0 = d.price;
    if (!t && !(tg && tg.low)) { $("chTwelve").innerHTML = '<p class="note">Forward earnings estimates and analyst targets are not available for this ticker.</p>'; $("twelveNote").textContent = ""; return; }
    const rows = [];
    if (t) { const bull = t.find(function (x) { return x.key === "bull"; }), base = t.find(function (x) { return x.key === "base"; }), bear = t.find(function (x) { return x.key === "bear"; });
      rows.push({ k: "m", label: "Model scenarios", sub: "Bear to bull; marker at base case", lo: bear.value, hi: bull.value, mid: base.value, col: "#00011F" }); }
    if (tg && tg.low && tg.high) rows.push({ k: "a", label: "Analyst price targets", sub: "Low to high; marker at mean", lo: tg.low, hi: tg.high, mid: tg.mean, col: "#8C877C" });
    if (w52) rows.push({ k: "w", label: "52 week trading range", sub: "Daily closing prices", lo: w52[0], hi: w52[1], mid: null, col: "#CFC9BC" });
    const all = rows.reduce(function (a, r) { return a.concat([r.lo, r.hi]); }, [p0]);
    const lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), span = hi - lo;
    const ann = [];
    rows.forEach(function (r) {
      ann.push({ x: r.lo, y: r.k, xanchor: "right", xshift: -8, text: num(r.lo) + " <span style=\"color:#6E6A61\">" + UI.signPct(r.lo / p0 - 1, 0) + "</span>", showarrow: false, font: { size: 14 }, bgcolor: C.paper });
      ann.push({ x: r.hi, y: r.k, xanchor: "left", xshift: 8, text: num(r.hi) + " <span style=\"color:#6E6A61\">" + UI.signPct(r.hi / p0 - 1, 0) + "</span>", showarrow: false, font: { size: 14 }, bgcolor: C.paper });
    });
    ann.push({ x: p0, yref: "paper", y: 1, yanchor: "bottom", showarrow: false, text: "Share price today " + cur + " " + num(p0), font: { size: 13, color: "#7A1E1E" }, bgcolor: C.paper });
    const mids = rows.filter(function (r) { return r.mid != null; });
    UI.plot("chTwelve", [
      { type: "bar", orientation: "h", y: rows.map(function (r) { return r.k; }), base: rows.map(function (r) { return r.lo; }), x: rows.map(function (r) { return r.hi - r.lo; }), width: 0.42,
        marker: { color: rows.map(function (r) { return r.col; }) }, hovertemplate: "%{customdata}<extra></extra>", customdata: rows.map(function (r) { return r.label + ": " + num(r.lo) + " to " + num(r.hi); }) },
      { type: "scatter", mode: "markers", y: mids.map(function (r) { return r.k; }), x: mids.map(function (r) { return r.mid; }), marker: { symbol: "line-ns", size: 26, line: { width: 3, color: "#FCFBF8" } },
        hovertemplate: "%{x:.2f}<extra></extra>" }
    ], {
      height: 110 + rows.length * 70, margin: { l: 220, r: 30, t: 34, b: 40 }, showlegend: false,
      xaxis: { range: [lo - span * 0.32, hi + span * 0.32], tickformat: ",.0f", zeroline: false, title: "Value per share, " + cur },
      yaxis: { tickvals: rows.map(function (r) { return r.k; }), ticktext: rows.map(function (r) { return r.label + "<br><span style=\"font-size:12px;color:#6E6A61\">" + r.sub + "</span>"; }), autorange: "reversed", ticks: "", showgrid: false, tickfont: { size: 15 } },
      shapes: [{ type: "line", x0: p0, x1: p0, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", width: 1.5, dash: "dot" } }],
      annotations: ann
    });
    $("twelveNote").textContent = t ? "Model value = forward EPS \u00d7 price to earnings (P/E) ratio. " + t.map(function (x) { return x.label + ": EPS " + num(x.eps) + " \u00d7 " + x.pe.toFixed(1) + "x = " + num(x.value); }).join("; ") + "." : "";
  }

  function drawRatings(rt) {
    const parts = [["Strong buy", rt.strongBuy || 0, "#2F4A36"], ["Buy", rt.buy || 0, "#7D8F80"], ["Hold", rt.hold || 0, "#CFC9BC"], ["Sell", rt.sell || 0, "#B07A72"], ["Strong sell", rt.strongSell || 0, "#7A1E1E"]];
    const tot = parts.reduce(function (a, p) { return a + p[1]; }, 0) || 1;
    UI.plot("chRate", parts.map(function (p, i) {
      return { type: "bar", orientation: "h", y: [""], x: [p[1] / tot], name: p[0] + " (" + p[1] + ")", marker: { color: p[2], line: { color: "#FCFBF8", width: 1 } },
        text: [p[1] ? String(p[1]) : ""], textposition: "inside", insidetextanchor: "middle", textfont: { size: 14, color: i < 2 || i === 4 ? "#FCFBF8" : "#111111" }, hovertemplate: p[0] + ": " + p[1] + "<extra></extra>" };
    }), { barmode: "stack", height: 130, margin: { l: 4, r: 4, t: 4, b: 4 }, xaxis: { visible: false, range: [0, 1] }, yaxis: { visible: false }, legend: { orientation: "h", y: -0.35, traceorder: "normal", font: { size: 13 } } });
  }

  function drawSurprises(rec) {
    const r = rec.filter(function (x) { return x.s != null; });
    if (!r.length) { $("chEps").innerHTML = '<p class="note">No earnings history available.</p>'; return; }
    const beats = r.filter(function (x) { return x.s > 0; }).length, avg = r.reduce(function (a, x) { return a + x.s; }, 0) / r.length;
    $("epsHead").textContent = "Beat consensus in " + beats + " of " + r.length + " reports";
    $("epsSub").textContent = "Reported earnings per share (EPS) versus the analyst consensus, as % of consensus. Dotted line: average surprise of " + UI.signPct(avg) + ".";
    const xs = r.map(function (x) { return x.date || x.label; }), every = r.length > 10 ? 2 : 1;
    const ymax = Math.max.apply(null, r.map(function (x) { return x.s; }).concat([0])), ymin = Math.min.apply(null, r.map(function (x) { return x.s; }).concat([0]));
    const pad = (ymax - ymin) * 0.2 || 0.02;
    UI.plot("chEps", [{ type: "bar", x: xs, y: r.map(function (x) { return x.s; }), marker: { color: r.map(function (x) { return x.s >= 0 ? "#00011F" : "#7A1E1E"; }) }, width: 0.6,
      text: r.length <= 12 ? r.map(function (x) { return UI.signPct(x.s, 1); }) : null, textposition: "outside", cliponaxis: false, textfont: { size: 12 },
      customdata: r.map(function (x) { return mon(x.date) + ": EPS " + num(x.actual) + " vs. " + num(x.estimate); }), hovertemplate: "%{customdata}<br>surprise %{y:.1%}<extra></extra>" }], {
      height: 340, margin: { l: 56, r: 20, t: 20, b: 50 }, showlegend: false,
      xaxis: { type: "category", tickvals: xs.filter(function (_, i) { return (r.length - 1 - i) % every === 0; }), ticktext: xs.filter(function (_, i) { return (r.length - 1 - i) % every === 0; }).map(mon), tickangle: 0, showgrid: false },
      yaxis: { tickformat: ".0%", range: [Math.min(0, ymin - pad), ymax + pad], zeroline: true, zerolinecolor: "#111111" },
      shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: avg, y1: avg, line: { color: "#8C6D3F", width: 1, dash: "dot" } }]
    });
  }

  function drawReactions(rec, A) {
    const r = rec.filter(function (x) { return x.move != null && x.s != null; });
    if (!r.length) { $("chReact").innerHTML = '<p class="note">Share price reactions are measured by the daily data refresh and are not available for tickers loaded live.</p>'; $("reactHead").textContent = "How the share price reacted"; $("reactSub").textContent = ""; return; }
    const q = function (f) { return r.filter(f).length; };
    const bu = q(function (x) { return x.s > 0 && x.move > 0; }), bd = q(function (x) { return x.s > 0 && x.move <= 0; }), mu = q(function (x) { return x.s <= 0 && x.move > 0; }), md = q(function (x) { return x.s <= 0 && x.move <= 0; });
    const avgAbs = r.reduce(function (a, x) { return a + Math.abs(x.move); }, 0) / r.length;
    $("reactHead").textContent = bu + bd ? "After a beat, the shares rose " + bu + " of " + (bu + bd) + " times" : "How the share price reacted";
    $("reactSub").textContent = "Each dot is one report: EPS surprise against the share price move on the next trading day. Average move " + UI.pct(avgAbs) + " either way.";
    const latest = r[r.length - 1];
    const xs = r.map(function (x) { return x.s; }), ys = r.map(function (x) { return x.move; });
    const xr = Math.max(0.02, Math.max.apply(null, xs.map(Math.abs))) * 1.25, yr = Math.max(0.02, Math.max.apply(null, ys.map(Math.abs))) * 1.25;
    const corner = function (x, y, xa, ya, t) { return { xref: "paper", yref: "paper", x: x, y: y, xanchor: xa, yanchor: ya, text: t, showarrow: false, font: { size: 12, color: "#6E6A61" } }; };
    const tr = [{ type: "scatter", mode: "markers", x: xs, y: ys, marker: { size: 11, color: "#00011F", opacity: 0.85 }, customdata: r.map(function (x) { return mon(x.date); }),
      hovertemplate: "%{customdata}<br>surprise %{x:.1%}<br>next day %{y:.1%}<extra></extra>" },
      { type: "scatter", mode: "markers", x: [latest.s], y: [latest.move], marker: { size: 15, color: "#7A1E1E", symbol: "diamond" }, hoverinfo: "skip" }];
    if (A.reaction.fitted) tr.push({ type: "scatter", mode: "lines", x: [-xr, xr], y: [A.reaction.a - A.reaction.b * xr, A.reaction.a + A.reaction.b * xr], line: { color: "#8C6D3F", width: 1, dash: "dot" }, hoverinfo: "skip" });
    UI.plot("chReact", tr, {
      height: 340, margin: { l: 60, r: 20, t: 20, b: 50 }, showlegend: false,
      xaxis: { title: "EPS surprise", tickformat: ".0%", range: [-xr, xr], zeroline: true, zerolinecolor: "#111111", showgrid: false },
      yaxis: { title: "Share price, next day", tickformat: ".0%", range: [-yr, yr], zeroline: true, zerolinecolor: "#111111", showgrid: false },
      annotations: [corner(0.99, 0.99, "right", "top", "Beat, shares rose: " + bu), corner(0.99, 0.01, "right", "bottom", "Beat, shares fell: " + bd),
        corner(0.01, 0.99, "left", "top", "Missed, shares rose: " + mu), corner(0.01, 0.01, "left", "bottom", "Missed, shares fell: " + md),
        { x: latest.s, y: latest.move, ax: latest.s > 0 ? -50 : 50, ay: latest.move > 0 ? -30 : 30, text: "Latest, " + mon(latest.date), showarrow: true, arrowhead: 0, arrowwidth: 1, arrowcolor: "#7A1E1E", font: { size: 13, color: "#7A1E1E" }, bgcolor: C.paper }]
    });
  }

  function drawQuarters(d, cur) {
    const qs = (d.quarterly || []).filter(function (x) { return x.revenue; }).slice(0, 6).reverse();
    if (!qs.length) { $("chQ").innerHTML = '<p class="note">Quarterly statements are not available for this ticker.</p>'; return; }
    const xs = qs.map(function (x) { return mon(x.period); }), rev = qs.map(function (x) { return x.revenue; });
    const m = qs.map(function (x) { return x.operatingIncome != null ? x.operatingIncome / x.revenue : null; }), mv = m.filter(function (v) { return v != null; });
    const rmax = Math.max.apply(null, rev), mmin = Math.min.apply(null, mv), mmax = Math.max.apply(null, mv), ms = Math.max(mmax - mmin, 0.02);
    UI.plot("chQ", [
      { type: "bar", x: xs, y: rev, marker: { color: "#CFC9BC" }, width: 0.55, text: rev.map(function (v) { return big(v); }), textposition: "inside", insidetextanchor: "end", textfont: { size: 12, color: "#111111" }, hovertemplate: "Revenue %{y:,.0f}<extra></extra>" },
      { type: "scatter", mode: "lines+markers+text", x: xs, y: m, yaxis: "y2", line: { color: "#00011F", width: 2 }, marker: { size: 7, color: "#00011F" },
        text: m.map(function (v) { return v == null ? "" : UI.pct(v); }), textposition: "top center", textfont: { size: 12 }, hovertemplate: "Operating margin %{y:.1%}<extra></extra>" }
    ], {
      height: 300, margin: { l: 20, r: 20, t: 20, b: 40 }, showlegend: false,
      xaxis: { type: "category", tickangle: 0, showgrid: false },
      yaxis: { range: [0, rmax * 1.9], visible: false }, yaxis2: { overlaying: "y", range: [mmin - ms * 2.2, mmax + ms * 0.8], visible: false }
    });
    $("qNote").textContent = "Bars: revenue per quarter (" + cur + "). Line: operating margin. Quarter labels show the end of each reporting period.";
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const ix = await API.localIndex();
    const list = (ix && ix.earnings) || [];
    $("pick").innerHTML = (list.length ? list.map(function (s) { return '<option value="' + s + '">' + s + "</option>"; }).join("") : "") + '<option value="SAMPLE">Illustrative sample company</option>';
    $("pick").onchange = function () { $("tick").value = ""; load(this.value); };
    $("go").onclick = function () { load($("tick").value || $("pick").value); };
    $("tick").onkeydown = function (e) { if (e.key === "Enter") load($("tick").value); };
    load(list.length ? list[0] : "SAMPLE");
  });
})();
