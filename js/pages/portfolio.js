/* Portfolio risk and optimisation page controller */
(function () {
  "use strict";
  const ERP = 0.055;
  let rows = [], last = null, ed = null;
  const $ = function (id) { return document.getElementById(id); };
  const toValues = function (h) { return h.map(function (r) { return [r[0], Math.round(r[1] * 1000)]; }); };

  function loadSaved() {
    try { const s = JSON.parse(localStorage.getItem("fin_portfolio")); if (s && s.length) return s; } catch (e) {}
    return toValues(PF.PRESETS[2].h);
  }
  function save() { try { localStorage.setItem("fin_portfolio", JSON.stringify(rows)); } catch (e) {} }

  function status(msg, cls) { const s = $("status"); s.className = "status " + (cls || ""); s.textContent = msg; s.classList.toggle("hidden", !msg); }

  async function run() {
    const hold = rows.filter(function (r) { return r[0] && +r[1] > 0; });
    if (hold.length < 2) { status("Enter at least two positions with a value.", "err"); return; }
    const syms = hold.map(function (r) { return r[0]; });
    if (new Set(syms).size !== syms.length) { status("Each ticker should appear once.", "err"); return; }
    const bench = $("bench").value, look = +$("lookback").value;
    $("run").disabled = true; status("Loading prices…");
    try {
      const h = await API.history(syms.concat([bench]), look + 1, status);
      const missing = syms.concat([bench]).filter(function (s) { return !h.data[s]; });
      if (missing.length) throw new Error("No price data for " + missing.join(", ") + ". " + (h.errors[missing[0]] || "Check the ticker."));
      const al = RISK.align(h.data, syms.concat([bench]));
      if (al.dates.length < 60) throw new Error("Fewer than 60 common trading days across these tickers. Tickers from different exchanges need overlapping history.");
      const R = al.prices.map(RISK.logReturns);
      const rb = R.pop();
      const value = hold.reduce(function (s, r) { return s + (+r[1]); }, 0);
      const w = hold.map(function (r) { return +r[1] / value; });
      last = { syms: syms, bench: bench, R: R, rb: rb, w: w, value: value, dates: al.dates, h: h };
      status("");
      render();
    } catch (e) { status(e.message, "err"); }
    $("run").disabled = false;
  }

  function render() {
    if (!last) return;
    const L = last, conf = +$("conf").value, hor = +$("hor").value, rf = +$("rf").value, cap = +$("cap").value;
    $("o_rf").textContent = UI.pct(rf, 2); $("o_cap").textContent = UI.pct(cap, 0);
    const C = RISK.covMatrix(L.R), rp = RISK.portfolioReturns(L.R, L.w);
    const S = RISK.summary(rp, L.rb, rf), SB = RISK.summary(L.rb, null, rf);
    const V = L.value;
    $("results").classList.remove("hidden");

    const demo = L.h.demoSymbols || [];
    $("demoNote").innerHTML = demo.length ? '<div class="callout warn"><strong>No market data for ' + demo.join(", ") + '.</strong> ' + (demo.length > 1 ? "These holdings use" : "This holding uses") + ' simulated prices, so the figures below are only illustrative. Pick tickers from the search list to use real data.</div>' :
      '<p class="note" style="margin-top:14px">Prices: ' + (L.h.updated ? "daily closes, last refreshed " + L.h.updated.slice(0, 10) + " (Yahoo Finance)" : "live (Twelve Data)") + ". " + L.dates.length + " common trading days from " + L.dates[0] + " to " + L.dates[L.dates.length - 1] + ".</p>";

    $("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">Portfolio value</div><div class="value">' + UI.fmt(V) + '</div><div class="sub">' + L.syms.length + " positions</div></div>" +
      '<div class="kpi"><div class="label">Annualised return</div><div class="value ' + UI.cls(S.annReturn) + '">' + UI.signPct(S.annReturn) + '</div><div class="sub">Benchmark ' + UI.signPct(S.benchReturn) + "</div></div>" +
      '<div class="kpi"><div class="label">Volatility</div><div class="value">' + UI.pct(S.vol) + '</div><div class="sub">Benchmark ' + UI.pct(S.benchVol) + "</div></div>" +
      '<div class="kpi"><div class="label">Sharpe ratio</div><div class="value">' + S.sharpe.toFixed(2) + '</div><div class="sub">Beta ' + S.beta.toFixed(2) + "</div></div>" +
      '<div class="kpi"><div class="label">' + UI.pct(conf, 0) + " " + hor + ' day VaR</div><div class="value neg">' + UI.fmt(RISK.historicalVar(rp, V, conf, hor)) + '</div><div class="sub">' + UI.pct(RISK.historicalVar(rp, 1, conf, hor)) + " of value, historical</div></div>";

    // Performance charts
    const d = L.dates;
    const cumB = SB.values.map(function (v) { return v * 100; }), cumP = S.values.map(function (v) { return v * 100; });
    UI.plot("chCum", [{ x: d, y: cumP, name: "Portfolio", line: { color: "#111111", width: 2.2 } }, { x: d, y: cumB, name: L.bench, line: { color: "#8C6D3F", width: 1.6 } }], { yaxis: { title: "Start = 100" } });
    UI.plot("chDD", [{ x: d, y: S.drawdown.series, name: "Portfolio", fill: "tozeroy", line: { color: "#7A1E1E", width: 1.5 }, fillcolor: "rgba(122,30,30,.15)" }, { x: d, y: SB.drawdown.series, name: L.bench, line: { color: "#8C6D3F", width: 1.2 } }], { yaxis: { tickformat: ".0%" } });

    const kv = [{ h: "Metric", f: function (x) { return x[0]; } }, { h: "Portfolio", n: 1, f: function (x) { return x[1]; } }, { h: L.bench, n: 1, f: function (x) { return x[2]; } }];
    UI.table("perfTable", kv, [
      ["Annualised return", UI.signPct(S.annReturn), UI.signPct(SB.annReturn)],
      ["Annualised volatility", UI.pct(S.vol), UI.pct(SB.vol)],
      ["Sharpe ratio", S.sharpe.toFixed(2), SB.sharpe.toFixed(2)],
      ["Sortino ratio", S.sortino.toFixed(2), SB.sortino.toFixed(2)],
      ["Maximum drawdown", UI.pct(-S.maxDrawdown), UI.pct(-SB.maxDrawdown)],
      ["Longest time under water (days)", S.drawdown.maxDurationDays, SB.drawdown.maxDurationDays],
      ["Calmar ratio", S.calmar.toFixed(2), SB.calmar.toFixed(2)],
      ["Omega ratio", S.omega.toFixed(2), SB.omega.toFixed(2)],
      ["Skewness / excess kurtosis", S.skew.toFixed(2) + " / " + S.excessKurtosis.toFixed(2), SB.skew.toFixed(2) + " / " + SB.excessKurtosis.toFixed(2)]
    ]);
    UI.table("perfTable2", [{ h: "Relative to " + L.bench, f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }, { h: "Reading", f: function (x) { return '<span class="note">' + x[2] + "</span>"; } }], [
      ["Beta", S.beta.toFixed(2), "Sensitivity to benchmark moves"],
      ["Correlation", S.correlation.toFixed(2), ""],
      ["Jensen's alpha (annual)", UI.signPct(S.alpha), "Return beyond what beta explains"],
      ["Tracking error", UI.pct(S.trackingError), "Volatility of active return"],
      ["Information ratio", S.infoRatio.toFixed(2), "Active return per unit of tracking error"],
      ["Treynor ratio", UI.pct(S.treynor), "Excess return per unit of beta"],
      ["M²", UI.signPct(S.m2), "Return at benchmark volatility"],
      ["Upside / downside capture", UI.pct(S.upCapture, 0) + " / " + UI.pct(S.downCapture, 0), "Share of benchmark up and down days"]
    ]);

    // VaR
    const muD = L.R.map(RISK.mean);
    const mc = RISK.monteCarloVar(muD, C, L.w, V, conf, hor, 20000, UI.rng(20261116), UI.gauss);
    const pv = RISK.parametricVar(C, L.w, V, conf, hor), hv = RISK.historicalVar(rp, V, conf, hor);
    const pc = RISK.cvarParametric(C, L.w, V, conf, hor), hc = RISK.cvarEmpirical(rp, V, conf, hor);
    UI.table("varTable", [{ h: UI.pct(conf, 0) + " confidence, " + hor + " day horizon", f: function (x) { return x[0]; } }, { h: "VaR", n: 1, f: function (x) { return UI.fmt(x[1]); } }, { h: "% of value", n: 1, f: function (x) { return UI.pct(x[1] / V, 2); } }, { h: "CVaR", n: 1, f: function (x) { return UI.fmt(x[2]); } }, { h: "% of value", n: 1, f: function (x) { return UI.pct(x[2] / V, 2); } }],
      [["Parametric (normal)", pv, pc], ["Historical simulation", hv, hc], ["Monte Carlo (20'000 paths)", mc.var, mc.cvar]]);
    const cut = RISK.percentile(rp, 1 - conf);
    UI.plot("chHist", [{ type: "histogram", x: rp, nbinsx: 60, marker: { color: "#8C877C" }, name: "Daily returns" }], {
      xaxis: { tickformat: ".1%" }, showlegend: false, bargap: 0.03,
      shapes: [{ type: "line", x0: cut, x1: cut, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", width: 2, dash: "dash" } }],
      annotations: [{ x: cut, yref: "paper", y: 1.05, text: UI.pct(conf, 0) + " VaR: " + UI.pct(cut, 2), showarrow: false, font: { color: "#7A1E1E" } }]
    });

    // Positions
    const vols = L.R.map(function (r) { return RISK.std(r) * Math.sqrt(252); });
    const betas = L.R.map(function (r) { return RISK.beta(r, L.rb); });
    const rc = RISK.riskContribution(C, L.w), cv = RISK.componentVar(C, L.w, V, conf).map(function (v) { return v * Math.sqrt(hor); });
    const rets = L.R.map(function (r) { return Math.exp(RISK.mean(r) * 252) - 1; });
    const pos = L.syms.map(function (s, i) { return { s: s, w: L.w[i], v: L.w[i] * V, vol: vols[i], beta: betas[i], ret: rets[i], rc: rc[i], cv: cv[i], src: L.h.source ? L.h.source[s] : "" }; });
    UI.table("posTable", [
      { h: "Position", f: function (x) { return "<strong>" + UI.esc(x.s) + "</strong>" + (x.src === "demo" ? ' <span class="badge hold">demo</span>' : ""); } },
      { h: "Value", n: 1, f: function (x) { return UI.fmt(x.v); } }, { h: "Weight", n: 1, f: function (x) { return UI.pct(x.w); } },
      { h: "Return p.a.", n: 1, f: function (x) { return '<span class="' + UI.cls(x.ret) + '">' + UI.signPct(x.ret) + "</span>"; } },
      { h: "Volatility", n: 1, f: function (x) { return UI.pct(x.vol); } }, { h: "Beta", n: 1, f: function (x) { return x.beta.toFixed(2).replace(/^-/, "\u2212"); } },
      { h: "Share of risk", n: 1, f: function (x) { return UI.pct(x.rc); } }, { h: "Component VaR", n: 1, f: function (x) { return UI.fmt(x.cv); } },
      { h: "Risk vs. weight", n: 1, f: function (x) { const r = x.rc / x.w; return '<span class="' + (r > 1.15 ? "neg" : r < 0.85 ? "pos" : "") + '">' + r.toFixed(2) + "x</span>"; } }
    ], pos);
    UI.plot("chRC", [{ type: "bar", x: L.syms, y: L.w, name: "Capital weight", marker: { color: "#8C877C" } }, { type: "bar", x: L.syms, y: rc, name: "Share of risk", marker: { color: "#7A1E1E" } }], { barmode: "group", yaxis: { tickformat: ".0%" } });
    const corr = RISK.corrMatrix(C);
    UI.plot("chCorr", [{ type: "heatmap", z: corr, x: L.syms, y: L.syms, zmin: -1, zmax: 1, colorscale: [[0, "#7A1E1E"], [0.5, "#FCFBF8"], [1, "#111111"]], text: corr.map(function (r) { return r.map(function (v) { return v.toFixed(2).replace(/^-/, "\u2212"); }); }), texttemplate: "%{text}", textfont: { size: 13 }, hovertemplate: "%{y} and %{x}: %{z:.2f}<extra></extra>", xgap: 1, ygap: 1, showscale: false }], { xaxis: { side: "top", showgrid: false, tickangle: -35, ticks: "" }, yaxis: { autorange: "reversed", showgrid: false, ticks: "" }, margin: { l: 80, r: 20, t: 70, b: 20 } });

    // Stress
    const st = RISK.stress(betas, L.w, V);
    UI.table("stressTable", [{ h: "Scenario", f: function (x) { return "<strong>" + x.name + "</strong>"; } }, { h: "Description", f: function (x) { return '<span class="note">' + x.note + "</span>"; } }, { h: "Market shock", n: 1, f: function (x) { return UI.signPct(x.shock, 0); } },
      { h: "Portfolio P&amp;L", n: 1, f: function (x) { return '<span class="' + UI.cls(x.pnl) + '">' + UI.fmt(x.pnl) + "</span>"; } }, { h: "% of value", n: 1, f: function (x) { return UI.signPct(x.pnl / V); } },
      { h: "Largest contributor", f: function (x) { let k = 0; x.byAsset.forEach(function (v, i) { if (Math.abs(v) > Math.abs(x.byAsset[k])) k = i; }); return UI.esc(L.syms[k]) + " " + UI.fmt(x.byAsset[k]); } }], st);

    // Modern portfolio theory: frontier, capital market line and the way from here to the frontier
    const Ca = C.map(function (r) { return r.map(function (v) { return v * 252; }); });
    const mu = $("muMode").value === "hist" ? L.R.map(function (r) { return RISK.mean(r) * 252; }) : betas.map(function (b) { return rf + b * ERP; });
    const maxW = Math.max.apply(null, L.w);
    const capEff = Math.max(cap, 1 / L.syms.length + 1e-6, maxW);
    const fr = RISK.frontier(mu, Ca, rf, capEff, 40);
    const cur = RISK.stats(mu, Ca, L.w, rf);
    const wA = RISK.frontierAtVol(mu, Ca, cur.vol, capEff), A = RISK.stats(mu, Ca, wA, rf); A.w = wA;
    const wB = RISK.frontierAtRet(mu, Ca, cur.ret, capEff), B = RISK.stats(mu, Ca, wB, rf); B.w = wB;
    const rpw = RISK.riskParity(Ca), rps = RISK.stats(mu, Ca, rpw, rf);
    const gapRet = A.ret - cur.ret, gapVol = cur.vol - B.vol, onFrontier = gapRet < 0.001 && gapVol < 0.001;
    drawFrontier(L, mu, Ca, fr, cur, A, B, rf, onFrontier);
    $("efHead").textContent = onFrontier ? "This portfolio already sits on the efficient frontier" :
      "This portfolio sits " + (gapRet * 100).toFixed(1) + " points of expected return below the efficient frontier";
    $("efSub").textContent = onFrontier ? "No mix of the same holdings offers more expected return for its level of risk." :
      "Reweighting the same holdings could add " + (gapRet * 100).toFixed(1) + " points of expected return at the same risk, or cut volatility by " + (gapVol * 100).toFixed(1) + " points at the same expected return." +
      (capEff > cap + 1e-9 ? " Position cap raised to " + UI.pct(capEff, 0) + " so the current portfolio is a feasible starting point." : "");
    const trades = function (w) {
      const all = L.syms.map(function (s, i) { return { s: s, d: (w[i] - L.w[i]) * V, w: w[i] }; }).filter(function (x) { return Math.abs(x.d) >= 0.01 * V; });
      const buys = all.filter(function (x) { return x.d > 0; }).sort(function (a, b) { return b.d - a.d; }), sells = all.filter(function (x) { return x.d < 0; }).sort(function (a, b) { return a.d - b.d; });
      const d = buys.slice(0, 4).concat(sells.slice(0, 4)), more = all.length - d.length;
      return d.length ? d.map(function (x) { return "<li><span>" + (x.d > 0 ? "Buy " : "Sell ") + UI.esc(x.s) + ' <span class="note">to ' + UI.pct(x.w, 0) + '</span></span><span class="' + (x.d > 0 ? "pos" : "neg") + '">' + (x.d > 0 ? "+" : "\u2212") + UI.fmt(Math.abs(x.d)) + "</span></li>"; }).join("") + (more > 0 ? '<li><span class="note">and ' + more + " smaller trade" + (more > 1 ? "s" : "") + "</span><span></span></li>" : "") : '<li><span class="note">No trade above 1% of value needed</span><span></span></li>';
    };
    const card = function (head, big, sub, w) { return '<div class="suggest"><div class="head">' + head + '</div><div class="big">' + big + '</div><div class="note">' + sub + "</div><ul>" + trades(w) + "</ul></div>"; };
    $("suggest").innerHTML =
      card("Option A &nbsp;&middot;&nbsp; Same risk, more return", "+" + (gapRet * 100).toFixed(1) + " pts return", "Expected return " + UI.pct(cur.ret) + " to " + UI.pct(A.ret) + " at " + UI.pct(cur.vol) + " volatility", wA) +
      card("Option B &nbsp;&middot;&nbsp; Same return, less risk", "\u2212" + (gapVol * 100).toFixed(1) + " pts volatility", "Volatility " + UI.pct(cur.vol) + " to " + UI.pct(B.vol) + " at " + UI.pct(cur.ret) + " expected return", wB) +
      card("Option C &nbsp;&middot;&nbsp; Best risk adjusted mix", "Sharpe " + cur.sharpe.toFixed(2) + " to " + fr.maxSharpe.sharpe.toFixed(2), "Tangency portfolio: return " + UI.pct(fr.maxSharpe.ret) + ", volatility " + UI.pct(fr.maxSharpe.vol), fr.maxSharpe.w);

    const wcol = function (h, w) { return { h: h, n: 1, f: function (x) { return UI.pct(w[x.i]); } }; };
    UI.table("optTable", [{ h: "Position", f: function (x) { return UI.esc(x.s) + ' &nbsp;<span class="note">' + UI.esc(PF.NAMES[x.s] || "") + "</span>"; } }, wcol("Current", L.w), wcol("A, same risk", wA), wcol("B, same return", wB), wcol("C, max Sharpe", fr.maxSharpe.w), wcol("Minimum risk", fr.minVar.w), wcol("Risk parity", rpw)],
      L.syms.map(function (s, i) { return { s: s, i: i }; }).concat([{ s: "", i: -1 }]).filter(function (x) { return x.i >= 0; }));
    const sc = function (h, k, f) { return { h: h, n: 1, f: function (x) { return f(x[1][k]); } }; };
    UI.table("optStats", [{ h: "Portfolio", f: function (x) { return x[0]; } }, sc("Expected return", "ret", UI.pct), sc("Volatility", "vol", UI.pct), sc("Sharpe ratio", "sharpe", function (v) { return v.toFixed(2); })],
      [["Current", cur], ["Option A, same risk", A], ["Option B, same return", B], ["Option C, max Sharpe", fr.maxSharpe], ["Minimum risk", fr.minVar], ["Risk parity", rps]], { rowClass: function (x) { return x[0] === "Current" ? "hl" : ""; } });

    last.out = { S: S, pos: pos, var: { pv: pv, hv: hv, mc: mc.var, pc: pc, hc: hc, mcc: mc.cvar }, opt: { ms: fr.maxSharpe.w, mv: fr.minVar.w, rp: rpw, a: wA, b: wB }, conf: conf, hor: hor };
    try { localStorage.setItem("fin_portfolio_weights", JSON.stringify({ syms: L.syms, w: L.w, value: V, bench: L.bench })); } catch (e) {}
  }

  // Alternate label positions where two holdings sit close together, so ticker labels never overlap
  /* Label placement in pixel space: each ticker label tries eight positions around its dot and takes the first one that
     touches no other label, no marker and no line. Returns Plotly annotations. */
  function placeLabels(items, obstacles, ax, plotW, plotH) {
    const X = function (v) { return (v - ax.x0) / (ax.x1 - ax.x0) * plotW; };
    const Y = function (v) { return (ax.y1 - v) / (ax.y1 - ax.y0) * plotH; };
    const boxes = obstacles.map(function (o) { const x = X(o.x), y = Y(o.y), r = o.r || 3; return [x - r, y - r, x + r, y + r]; });
    const hit = function (b) { return boxes.some(function (o) { return b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]; }); };
    const cand = [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [1, 1], [-1, -1], [-1, 1]];
    const out = [];
    items.slice().sort(function (a, b) { return b.y - a.y; }).forEach(function (it) {
      const w = it.text.length * 6.6 + 4, h = 13, px = X(it.x), py = Y(it.y);
      let best = null, bestScore = 1e9;
      cand.forEach(function (c, k) {
        const cx = px + c[0] * (w / 2 + 8), cy = py + c[1] * 13;
        const b = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
        const outside = b[0] < 0 || b[2] > plotW || b[1] < 0 || b[3] > plotH;
        const score = (hit(b) ? 100 : 0) + (outside ? 50 : 0) + k;
        if (score < bestScore) { bestScore = score; best = { b: b, dx: cx - px, dy: cy - py }; }
      });
      boxes.push(best.b);
      out.push({ x: it.x, y: it.y, text: it.text, showarrow: false, xshift: best.dx, yshift: -best.dy, font: { size: 11, color: "#6E6A61" } });
    });
    return out;
  }

  function sampleLine(x0, y0, x1, y1, n) {
    const o = []; for (let i = 0; i <= n; i++) o.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, r: 2 }); return o;
  }

  function drawFrontier(L, mu, Ca, fr, cur, A, B, rf, onFrontier) {
    const INK = UI.INK, NEG = UI.NEG, BRASS = UI.BRASS, GREY = "#9C978C", PAPER = "#FCFBF8";
    const vols = Ca.map(function (r, i) { return Math.sqrt(r[i]); });
    const xMax = Math.max(Math.max.apply(null, vols), cur.vol, fr.maxSharpe.vol * 1.4) * 1.1;
    const yAll = mu.concat([rf, cur.ret, fr.maxSharpe.ret]);
    const yMin = Math.min.apply(null, yAll), yMax = Math.max.apply(null, yAll), pad = (yMax - yMin) * 0.12;
    const ax = { x0: 0, x1: xMax, y0: yMin - pad, y1: yMax + pad };
    const S = fr.maxSharpe.sharpe;
    const cmlX = Math.min(xMax, (ax.y1 - rf) / S), cmlY = rf + S * cmlX;
    const pts = fr.points.slice().sort(function (a, b) { return a.vol - b.vol; });
    const front = { x: pts.map(function (p) { return p.vol; }), y: pts.map(function (p) { return p.ret; }) };
    const special = function (zoom) {
      const t = [
        { x: [0, cmlX], y: [rf, cmlY], mode: "lines", line: { color: BRASS, width: 1.5, dash: "dot" }, hoverinfo: "skip" },
        { x: front.x, y: front.y, mode: "lines", line: { color: "#111111", width: 2.6, shape: "spline" }, hovertemplate: "Efficient frontier<br>risk %{x:.1%}, return %{y:.1%}<extra></extra>" },
        { x: [fr.minVar.vol], y: [fr.minVar.ret], mode: "markers", marker: { size: 11, color: PAPER, line: { color: "#111111", width: 1.6 } }, hovertemplate: "Minimum risk<br>risk %{x:.1%}, return %{y:.1%}<extra></extra>" },
        { x: [fr.maxSharpe.vol], y: [fr.maxSharpe.ret], mode: "markers", marker: { size: 14, color: "#111111" }, hovertemplate: "Ideal portfolio (highest Sharpe ratio)<br>risk %{x:.1%}, return %{y:.1%}<extra></extra>" }
      ];
      if (!onFrontier) t.push({ x: [A.vol, B.vol], y: [A.ret, B.ret], mode: "markers", marker: { size: zoom ? 13 : 9, color: PAPER, line: { color: NEG, width: 1.8 } }, text: ["Option A", "Option B"], hovertemplate: "%{text}<br>risk %{x:.1%}, return %{y:.1%}<extra></extra>" });
      t.push({ x: [cur.vol], y: [cur.ret], mode: "markers", marker: { size: zoom ? 18 : 14, color: NEG, symbol: "diamond" }, hovertemplate: "Your portfolio<br>risk %{x:.1%}, return %{y:.1%}<extra></extra>" });
      return t;
    };

    // ---------- Overview: every holding, labels placed so nothing overlaps ----------
    const el = $("chEF"), plotW = Math.max(300, (el.clientWidth || 700) - 70 - 24), plotH = 500 - 20 - 60;
    const obstacles = [];
    front.x.forEach(function (x, i) { obstacles.push({ x: x, y: front.y[i], r: 3 }); });
    sampleLine(0, rf, cmlX, cmlY, 60).forEach(function (o) { obstacles.push(o); });
    vols.forEach(function (v, i) { obstacles.push({ x: v, y: mu[i], r: 5 }); });
    [[cur, 10], [fr.maxSharpe, 9], [fr.minVar, 8], [{ vol: 0, ret: rf }, 6]].concat(onFrontier ? [] : [[A, 7], [B, 7]])
      .forEach(function (q) { obstacles.push({ x: q[0].vol, y: q[0].ret, r: q[1] }); });
    const labels = placeLabels(vols.map(function (v, i) { return { x: v, y: mu[i], text: L.syms[i] }; }).concat([{ x: 0.0001, y: rf, text: "Risk free rate" }]), obstacles, ax, plotW, plotH);
    labels.forEach(function (a) { if (a.text === "Risk free rate") a.font.color = BRASS; });
    const tr = [{ x: vols, y: mu, mode: "markers", marker: { size: 7, color: GREY }, text: L.syms, hovertemplate: "%{text}<br>risk %{x:.1%}, return %{y:.1%}<extra></extra>" },
      { x: [0], y: [rf], mode: "markers", marker: { size: 8, color: BRASS }, hovertemplate: "Risk free rate %{y:.2%}<extra></extra>" }].concat(special(false));
    // a light box marks the close up area
    const zx = [cur.vol].concat(onFrontier ? [] : [A.vol, B.vol]), zy = [cur.ret].concat(onFrontier ? [] : [A.ret, B.ret]);
    const cx = (Math.min.apply(null, zx) + Math.max.apply(null, zx)) / 2, cy = (Math.min.apply(null, zy) + Math.max.apply(null, zy)) / 2;
    const hx = Math.max((Math.max.apply(null, zx) - Math.min.apply(null, zx)) * 1.8, 0.012), hy = Math.max((Math.max.apply(null, zy) - Math.min.apply(null, zy)) * 1.8, 0.005);
    const zx0 = cx - hx, zx1 = cx + hx * 1.6, zy0 = cy - hy, zy1 = cy + hy;
    UI.plot("chEF", tr, {
      showlegend: false, height: 500, margin: { l: 70, r: 24, t: 20, b: 60 },
      xaxis: { title: "Risk: volatility per year", tickformat: ".0%", range: [ax.x0, ax.x1], zeroline: false },
      yaxis: { title: "Expected return per year", tickformat: ".0%", range: [ax.y0, ax.y1], zeroline: false },
      shapes: [{ type: "rect", x0: zx0, x1: zx1, y0: zy0, y1: zy1, line: { color: NEG, width: 1, dash: "dot" }, fillcolor: "rgba(122,30,30,0.03)" }],
      annotations: labels
    });

    // ---------- Close up: the portfolio, options A and B, and the nearby frontier ----------
    const za = [];
    if (!onFrontier) {
      [[A, "A"], [B, "B"]].forEach(function (t) {
        za.push({ x: t[0].vol, y: t[0].ret, ax: cur.vol, ay: cur.ret, axref: "x", ayref: "y", showarrow: true, arrowhead: 2, arrowsize: 1.1, arrowwidth: 1.6, arrowcolor: NEG, standoff: 9, startstandoff: 11, text: "" });
      });
      za.push({ x: A.vol, y: A.ret, ax: 52, ay: -6, showarrow: true, arrowhead: 0, arrowwidth: 0.8, arrowcolor: "#B8B2A5", xanchor: "left", align: "left", bgcolor: PAPER,
        text: "<b>A</b> &nbsp;same risk<br>+" + ((A.ret - cur.ret) * 100).toFixed(1) + " pts return", font: { size: 12, color: NEG } });
      za.push({ x: B.vol, y: B.ret, ax: 8, ay: 72, showarrow: true, arrowhead: 0, arrowwidth: 0.8, arrowcolor: "#B8B2A5", xanchor: "left", align: "left", bgcolor: PAPER,
        text: "<b>B</b> &nbsp;same return<br>" + ((cur.vol - B.vol) * 100).toFixed(1) + " pts less risk", font: { size: 12, color: NEG } });
    }
    za.push({ x: cur.vol, y: cur.ret, ax: 52, ay: 14, showarrow: true, arrowhead: 0, arrowwidth: 0.8, arrowcolor: "#B8B2A5", xanchor: "left", align: "left", bgcolor: PAPER,
      text: "<b>Your portfolio</b><br>risk " + UI.pct(cur.vol) + "<br>return " + UI.pct(cur.ret), font: { size: 12, color: NEG } });
    const inZ = function (p) { return p.vol >= zx0 && p.vol <= zx1 && p.ret >= zy0 && p.ret <= zy1; };
    if (inZ(fr.maxSharpe)) za.push({ x: fr.maxSharpe.vol, y: fr.maxSharpe.ret, ax: 0, ay: -40, showarrow: true, arrowhead: 0, arrowwidth: 0.8, arrowcolor: "#B8B2A5", bgcolor: PAPER, text: "Ideal portfolio", font: { size: 12, color: INK } });
    if (inZ(fr.minVar)) za.push({ x: fr.minVar.vol, y: fr.minVar.ret, ax: 0, ay: 40, showarrow: true, arrowhead: 0, arrowwidth: 0.8, arrowcolor: "#B8B2A5", bgcolor: PAPER, text: "Minimum risk", font: { size: 12, color: INK } });
    UI.plot("chEFzoom", special(true), {
      showlegend: false, height: 500, margin: { l: 64, r: 20, t: 20, b: 60 },
      xaxis: { title: "Risk: volatility per year", tickformat: ".1%", range: [zx0, zx1], zeroline: false },
      yaxis: { title: "Expected return per year", tickformat: ".1%", range: [zy0, zy1], zeroline: false },
      annotations: za
    });
  }

  function exportCsv() {
    if (!last || !last.out) return;
    const o = last.out, lines = ["Position,Value,Weight,Return p.a.,Volatility,Beta,Share of risk,Component VaR,Max Sharpe weight,Min variance weight,Risk parity weight"];
    o.pos.forEach(function (p, i) { lines.push([p.s, p.v.toFixed(0), p.w.toFixed(4), p.ret.toFixed(4), p.vol.toFixed(4), p.beta.toFixed(3), p.rc.toFixed(4), p.cv.toFixed(0), o.opt.ms[i].toFixed(4), o.opt.mv[i].toFixed(4), o.opt.rp[i].toFixed(4)].join(",")); });
    lines.push("", "Metric,Value", "Annualised return," + o.S.annReturn.toFixed(4), "Volatility," + o.S.vol.toFixed(4), "Sharpe," + o.S.sharpe.toFixed(3), "Beta," + o.S.beta.toFixed(3), "Max drawdown," + o.S.maxDrawdown.toFixed(4),
      "Parametric VaR," + o.var.pv.toFixed(0), "Historical VaR," + o.var.hv.toFixed(0), "Monte Carlo VaR," + o.var.mc.toFixed(0), "Historical CVaR," + o.var.hc.toFixed(0), "Confidence," + o.conf, "Horizon days," + o.hor);
    UI.download("portfolio_risk.csv", lines.join("\n"));
  }

  document.addEventListener("DOMContentLoaded", async function () {
    rows = loadSaved().map(function (r) { return r.slice(); });
    ed = PF.editor($("rows"), rows, { mode: "value", onChange: function (r) { rows = r; save(); } });
    $("preset").innerHTML = '<option value="">Load a model portfolio</option>' + PF.PRESETS.map(function (p) { return '<option value="' + p.id + '">' + p.name + "</option>"; }).join("");
    $("preset").onchange = function () {
      const p = PF.PRESETS.find(function (x) { return x.id === this.value; }, this);
      if (p) {
        rows = toValues(p.h); ed.set(rows); save();
        $("presetDesc").innerHTML = "<b>" + p.name + ".</b> " + UI.esc(p.desc); $("presetDesc").classList.remove("hidden");
        $("bench").value = p.bench === "URTH" || p.bench === "SPY" || p.bench === "^SSMI" || p.bench === "VT" ? p.bench : "SPY";
        run();
      }
      this.value = "";
    };
    $("run").onclick = run; $("csv").onclick = exportCsv;
    ["conf", "hor", "rf", "cap", "muMode"].forEach(function (id) { $(id).oninput = render; });
    ["bench", "lookback"].forEach(function (id) { $(id).onchange = function () { if (last) run(); }; });
    $("o_rf").textContent = UI.pct(+$("rf").value, 2); $("o_cap").textContent = UI.pct(+$("cap").value, 0);
    const ix = await API.localIndex();
    if (ix && ix.prices) $("universe").textContent = ix.prices.length + " shares, funds and indices are refreshed daily. Type a ticker or company name.";
    run();
  });
})();
