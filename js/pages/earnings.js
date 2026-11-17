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
    $("lean").innerHTML = '<span class="badge ' + lc + '" style="font-size:.85rem;padding:6px 12px">Model lean: ' + A.lean + "</span> <span class=\"note\">confidence: " + A.confidence + "</span>";

    const ne = d.nextEarnings, days = ne && ne.date ? Math.round((new Date(ne.date) - new Date()) / 864e5) : null;
    $("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">Next earnings report</div><div class="value" style="font-size:1.45rem">' + (ne && ne.date ? new Date(ne.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not scheduled") + '</div><div class="sub">' + (ne ? [(days != null ? (days >= 0 ? "in " + days + " days" : Math.abs(days) + " days ago") : ""), ne.timing, ne.confirmed === false ? "estimated window" : ""].filter(Boolean).join(", ") : "") + "</div></div>" +
      '<div class="kpi"><div class="label">Share price</div><div class="value">' + cur + " " + num(d.price) + '</div><div class="sub">1 week ' + UI.signPct(d.perf1w) + ", 1 month " + UI.signPct(d.perf1m) + "</div></div>" +
      '<div class="kpi"><div class="label">Consensus EPS</div><div class="value">' + num(A.consensus) + '</div><div class="sub">' + (q.numberOfAnalysts ? q.numberOfAnalysts + " analysts, " : "") + (q.growth != null ? UI.signPct(q.growth) + " year on year" : "") + "</div></div>" +
      '<div class="kpi"><div class="label">Probability of a beat</div><div class="value">' + (thin ? "n.a." : UI.pct(A.pBeat, 0)) + '</div><div class="sub">' + (A.n ? A.beats + " beats in last " + A.n + " reports" : "no history") + "</div></div>" +
      '<div class="kpi"><div class="label">Typical move on results</div><div class="value">' + (thin ? "n.a." : "±" + UI.pct(A.absMove)) + '</div><div class="sub">' + (thin ? "" : cur + " " + num(A.impliedRange[0]) + " to " + num(A.impliedRange[1])) + "</div></div>";

    const col = { bull: "#1B7F5B", base: "#13294B", bear: "#B42318" };
    if (thin) {
      $("scen").innerHTML = "";
      $("pred").innerHTML = "<strong>No scenario for the next report.</strong> The data source has no quarterly EPS consensus or fewer than four recent reports for this company, which is typical for Swiss companies that report half yearly. A beat probability or price reaction estimate would be guesswork, so none is shown. The twelve month view, analyst targets and ratings below are still available.";
      $("chScen").innerHTML = '<p class="note">Not enough data for report scenarios.</p>';
      $("lean").innerHTML = "";
    } else {
      $("scen").innerHTML = A.scenarios.map(function (s) {
        return '<div class="card" style="border-top:4px solid ' + col[s.key] + '"><div class="row" style="justify-content:space-between"><h3 style="margin:0;font-family:var(--serif);font-size:1.3rem">' + s.label + ' case</h3><span class="badge" style="background:' + col[s.key] + ';color:#fff">' + UI.pct(s.prob, 0) + " probability</span></div>" +
          '<p style="min-height:42px">' + s.story + '</p><div class="grid g2" style="gap:10px"><div class="kpi"><div class="label">EPS</div><div class="value" style="font-size:1.4rem">' + num(s.eps) + '</div><div class="sub">' + UI.signPct(s.surprise) + ' vs. consensus</div></div>' +
          '<div class="kpi"><div class="label">Next day price</div><div class="value ' + UI.cls(s.move) + '" style="font-size:1.4rem">' + num(s.price) + '</div><div class="sub">' + UI.signPct(s.move) + "</div></div></div></div>";
      }).join("");
      $("pred").innerHTML = "<strong>Prediction.</strong> The model expects EPS of about " + num(A.predictedEps) + " against consensus of " + num(A.consensus) + " (" + UI.signPct(A.expSurprise) + "), a " + UI.pct(A.pBeat, 0) + " probability of a beat, and a probability weighted next day move of " + UI.signPct(A.expMove) +
        " to about " + cur + " " + num(A.expPrice) + ". " + (A.reaction.fitted ? "Past reports show that a 1 point EPS surprise moved the share price by about " + (A.reaction.b).toFixed(2) + " points (R² " + num(A.reaction.r2) + ", " + A.reaction.n + " reports)." : (A.reaction.n >= 4 ? "Past reports show no reliable positive link between the size of the surprise and the share price move" : "There are too few past reactions for a regression") + ", so the average absolute move is scaled by the surprise.") +
        (A.spread != null && A.spread > 0.2 ? " The analyst range is wider than 20% of consensus, which signals unusual uncertainty." : "");

      UI.plot("chScen", [
        { type: "bar", x: A.scenarios.map(function (s) { return s.label; }), y: A.scenarios.map(function (s) { return s.prob; }), marker: { color: A.scenarios.map(function (s) { return col[s.key]; }) }, text: A.scenarios.map(function (s) { return UI.pct(s.prob, 0); }), textposition: "outside", name: "Probability" },
        { type: "scatter", mode: "markers+text", x: A.scenarios.map(function (s) { return s.label; }), y: A.scenarios.map(function (s) { return s.price; }), yaxis: "y2", marker: { size: 13, color: "#B8892B", symbol: "diamond" }, text: A.scenarios.map(function (s) { return num(s.price); }), textposition: "middle right", name: "Next day price" }
      ], { yaxis: { tickformat: ".0%", range: [0, Math.max.apply(null, A.scenarios.map(function (s) { return s.prob; })) * 1.3] }, yaxis2: { overlaying: "y", side: "right", showgrid: false }, margin: { l: 50, r: 60, t: 20, b: 44 },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, yref: "y2", y0: d.price, y1: d.price, line: { color: "#6B7A8C", dash: "dot", width: 1 } }] });
    }
    if (A.twelve) {
      const tg = d.targets;
      const xs = A.twelve.map(function (t) { return t.label; });
      const tr = [{ type: "bar", x: xs, y: A.twelve.map(function (t) { return t.value; }), marker: { color: A.twelve.map(function (t) { return col[t.key]; }) }, text: A.twelve.map(function (t) { return num(t.value) + " (" + UI.signPct(t.upside, 0) + ")"; }), textposition: "outside", name: "EPS × P/E" }];
      if (tg && tg.mean) tr.push({ type: "scatter", mode: "markers", x: xs, y: [tg.high, tg.mean, tg.low], marker: { symbol: "line-ew", size: 34, line: { width: 3, color: "#B8892B" } }, name: "Analyst target (high, mean, low)" });
      const top = Math.max.apply(null, A.twelve.map(function (t) { return t.value; }).concat(tg && tg.high ? [tg.high] : []));
      UI.plot("chTwelve", tr, { shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: d.price, y1: d.price, line: { color: "#6B7A8C", dash: "dot", width: 1 } }], yaxis: { range: [0, top * 1.2] } });
      $("twelveNote").textContent = A.twelve.map(function (t) { return t.label + ": EPS " + num(t.eps) + " × " + t.pe.toFixed(1) + "x"; }).join("  ·  ") + ". Dotted line: current price.";
    } else { $("chTwelve").innerHTML = '<p class="note">Forward EPS estimates or a P/E ratio are not available for this ticker from the current data source.</p>'; $("twelveNote").textContent = ""; }

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
    if (rt) {
      const parts = [["Strong buy", rt.strongBuy, "#1B7F5B"], ["Buy", rt.buy, "#6FB896"], ["Hold", rt.hold, "#C9CDD2"], ["Sell", rt.sell, "#E08A82"], ["Strong sell", rt.strongSell, "#B42318"]];
      UI.plot("chRate", parts.map(function (p) { return { type: "bar", orientation: "h", y: [""], x: [p[1]], name: p[0], marker: { color: p[2] }, text: [p[1] || ""], textposition: "inside" }; }), { barmode: "stack", margin: { l: 4, r: 4, t: 4, b: 30 }, xaxis: { visible: false }, yaxis: { visible: false }, legend: { orientation: "h", y: -0.2, font: { size: 10 } } });
    } else $("chRate").innerHTML = "";

    // Track record
    const ev = (d.reactions || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    const rec = ev.length ? ev.map(function (r) { return { label: r.date.slice(0, 7), date: r.date, estimate: r.estimate, actual: r.actual, s: r.surprisePct, move: r.move1d, timing: r.timing }; }) : (d.history || []).map(function (h) { return { label: String(h.quarter).slice(0, 7), date: h.quarter, estimate: h.estimate, actual: h.actual, s: h.surprisePct, move: null }; });
    UI.plot("chEps", [
      { type: "scatter", mode: "markers", x: rec.map(function (r) { return r.label; }), y: rec.map(function (r) { return r.estimate; }), name: "Consensus", marker: { color: "#B9C4D2", size: 14, symbol: "circle-open", line: { width: 2 } } },
      { type: "scatter", mode: "markers", x: rec.map(function (r) { return r.label; }), y: rec.map(function (r) { return r.actual; }), name: "Reported", marker: { size: 12, color: rec.map(function (r) { return r.s >= 0 ? "#1B7F5B" : "#B42318"; }) } }
    ], { xaxis: { type: "category", tickangle: 0 } });
    const withMove = rec.filter(function (r) { return r.move != null && r.s != null; });
    if (withMove.length) {
      const xs = withMove.map(function (r) { return r.s; }), lo = Math.min.apply(null, xs.concat([0])) - 0.01, hi = Math.max.apply(null, xs.concat([0])) + 0.01;
      UI.plot("chReact", [
        { type: "scatter", mode: "markers", x: xs, y: withMove.map(function (r) { return r.move; }), text: withMove.map(function (r) { return r.label; }), marker: { size: 12, color: withMove.map(function (r) { return r.move >= 0 ? "#1B7F5B" : "#B42318"; }) }, name: "Past reports", hovertemplate: "%{text}<br>surprise %{x:.1%}<br>move %{y:.1%}<extra></extra>" },
        { type: "scatter", mode: "lines", x: [lo, hi], y: [A.reaction.a + A.reaction.b * lo, A.reaction.a + A.reaction.b * hi], line: { color: "#13294B", dash: "dash", width: 1.5 }, name: A.reaction.fitted ? "Fitted relationship" : "Scaled relationship" }
      ], { xaxis: { title: "EPS surprise", tickformat: ".0%", zeroline: true }, yaxis: { title: "Next day move", tickformat: ".0%", zeroline: true }, legend: { orientation: "h", y: -0.32 } });
    } else $("chReact").innerHTML = '<p class="note">Past price reactions are measured by the daily data refresh and are not available for tickers loaded live.</p>';
    UI.table("histTable", [{ h: "Report", f: function (r) { return (r.date || r.label) + (r.timing ? ' <span class="note">' + r.timing + "</span>" : ""); } }, { h: "Consensus EPS", n: 1, f: function (r) { return num(r.estimate); } }, { h: "Reported EPS", n: 1, f: function (r) { return num(r.actual); } },
      { h: "Surprise", n: 1, f: function (r) { return r.s == null ? "n.a." : '<span class="' + UI.cls(r.s) + '">' + UI.signPct(r.s) + "</span>"; } }, { h: "Result", f: function (r) { return r.s == null ? "" : r.s > 0 ? '<span class="badge buy">Beat</span>' : r.s < 0 ? '<span class="badge sell">Miss</span>' : '<span class="badge hold">In line</span>'; } },
      { h: "Next day move", n: 1, f: function (r) { return r.move == null ? "n.a." : '<span class="' + UI.cls(r.move) + '">' + UI.signPct(r.move) + "</span>"; } }], rec.slice().reverse());

    // What to watch
    const w = (d.watch || []).slice();
    if (A.spread != null) w.push("Analyst EPS range spans " + UI.pct(A.spread, 0) + " of consensus (" + num(q.low) + " to " + num(q.high) + ")" + (A.spread > 0.2 ? ", an unusually wide spread" : ""));
    if (A.n) w.push("Average EPS surprise over the last " + A.n + " reports: " + UI.signPct(A.meanSurprise) + ", with a beat in " + A.beats + " of them");
    if (d.perf1m != null && Math.abs(d.perf1m) > 0.08) w.push("The share price has moved " + UI.signPct(d.perf1m) + " in the past month, so a good part of expectations may already be in the price");
    $("watch").innerHTML = w.length ? w.map(function (x) { return "<li style=\"margin-bottom:8px\">" + UI.esc(x) + "</li>"; }).join("") : "<li>No statement data available for this ticker.</li>";
    const qs = (d.quarterly || []).filter(function (x) { return x.revenue; }).slice(0, 6).reverse();
    if (qs.length) UI.plot("chQ", [{ type: "bar", x: qs.map(function (x) { return x.period.slice(0, 7); }), y: qs.map(function (x) { return x.revenue; }), name: "Revenue", marker: { color: "#6C8EBF" } },
      { type: "scatter", mode: "lines+markers", x: qs.map(function (x) { return x.period.slice(0, 7); }), y: qs.map(function (x) { return x.operatingIncome != null ? x.operatingIncome / x.revenue : null; }), yaxis: "y2", name: "Operating margin", line: { color: "#C8102E", width: 2.5 } }],
      { xaxis: { type: "category", tickangle: 0 }, yaxis2: { overlaying: "y", side: "right", tickformat: ".0%", showgrid: false }, margin: { l: 56, r: 50, t: 16, b: 40 } });
    else $("chQ").innerHTML = '<p class="note">Quarterly statements are not available for this ticker.</p>';
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
