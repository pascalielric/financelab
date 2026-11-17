/* Portfolio risk and optimisation page controller */
(function () {
  "use strict";
  const PRESETS = {
    swiss: [["NESN.SW", 25000], ["ROG.SW", 20000], ["NOVN.SW", 20000], ["UBSG.SW", 12000], ["ZURN.SW", 12000], ["GIVN.SW", 8000], ["PGHN.SW", 8000]],
    global: [["MSFT", 20000], ["AAPL", 15000], ["NVDA", 12000], ["GOOGL", 12000], ["JPM", 10000], ["JNJ", 10000], ["NESN.SW", 11000], ["BRK-B", 10000]],
    balanced: [["VT", 45000], ["CHSPI.SW", 15000], ["TLT", 20000], ["GLD", 10000], ["QQQ", 10000]]
  };
  const ERP = 0.055;
  let rows = [], last = null;
  const $ = function (id) { return document.getElementById(id); };

  function loadSaved() {
    try { const s = JSON.parse(localStorage.getItem("fin_portfolio")); if (s && s.length) return s; } catch (e) {}
    return PRESETS.global;
  }
  function save() { try { localStorage.setItem("fin_portfolio", JSON.stringify(rows)); } catch (e) {} }

  function drawRows() {
    const tot = rows.reduce(function (s, r) { return s + (+r[1] || 0); }, 0);
    $("rows").innerHTML = rows.map(function (r, i) {
      return '<tr><td><input type="text" data-i="' + i + '" data-f="0" value="' + UI.esc(r[0]) + '" placeholder="Ticker" style="width:130px;text-transform:uppercase"></td>' +
        '<td class="n"><input type="number" data-i="' + i + '" data-f="1" value="' + r[1] + '" min="0" step="1000" style="width:130px;text-align:right"></td>' +
        '<td class="n">' + (tot ? UI.pct((+r[1] || 0) / tot) : "") + '</td><td><button class="xbtn" data-del="' + i + '" title="Remove">×</button></td></tr>';
    }).join("") + '<tr class="total"><td>Total</td><td class="n">' + UI.fmt(tot) + '</td><td class="n">100.0%</td><td></td></tr>';
    $("rows").querySelectorAll("input").forEach(function (inp) {
      inp.onchange = function () { const i = +inp.dataset.i, f = +inp.dataset.f; rows[i][f] = f === 0 ? inp.value.trim().toUpperCase() : +inp.value; save(); drawRows(); };
    });
    $("rows").querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { rows.splice(+b.dataset.del, 1); save(); drawRows(); }; });
  }

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
    $("demoNote").innerHTML = demo.length ? '<div class="callout warn"><strong>Simulated demo prices in use for: ' + demo.join(", ") + '.</strong> These are generated, not market data. Real prices load automatically once the daily data refresh has run, or add a free Twelve Data key via the Data button in the header.</div>' :
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
    UI.plot("chCum", [{ x: d, y: cumP, name: "Portfolio", line: { color: "#13294B", width: 2.2 } }, { x: d, y: cumB, name: L.bench, line: { color: "#B8892B", width: 1.6 } }], { yaxis: { title: "Start = 100" } });
    UI.plot("chDD", [{ x: d, y: S.drawdown.series, name: "Portfolio", fill: "tozeroy", line: { color: "#C8102E", width: 1.5 }, fillcolor: "rgba(200,16,46,.15)" }, { x: d, y: SB.drawdown.series, name: L.bench, line: { color: "#B8892B", width: 1.2 } }], { yaxis: { tickformat: ".0%" } });

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
    UI.plot("chHist", [{ type: "histogram", x: rp, nbinsx: 60, marker: { color: "#6C8EBF" }, name: "Daily returns" }], {
      xaxis: { tickformat: ".1%" }, showlegend: false, bargap: 0.03,
      shapes: [{ type: "line", x0: cut, x1: cut, yref: "paper", y0: 0, y1: 1, line: { color: "#C8102E", width: 2, dash: "dash" } }],
      annotations: [{ x: cut, yref: "paper", y: 1.05, text: UI.pct(conf, 0) + " VaR: " + UI.pct(cut, 2), showarrow: false, font: { color: "#C8102E" } }]
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
      { h: "Volatility", n: 1, f: function (x) { return UI.pct(x.vol); } }, { h: "Beta", n: 1, f: function (x) { return x.beta.toFixed(2); } },
      { h: "Share of risk", n: 1, f: function (x) { return UI.pct(x.rc); } }, { h: "Component VaR", n: 1, f: function (x) { return UI.fmt(x.cv); } },
      { h: "Risk vs. weight", n: 1, f: function (x) { const r = x.rc / x.w; return '<span class="' + (r > 1.15 ? "neg" : r < 0.85 ? "pos" : "") + '">' + r.toFixed(2) + "x</span>"; } }
    ], pos);
    UI.plot("chRC", [{ type: "bar", x: L.syms, y: L.w, name: "Capital weight", marker: { color: "#6C8EBF" } }, { type: "bar", x: L.syms, y: rc, name: "Share of risk", marker: { color: "#C8102E" } }], { barmode: "group", yaxis: { tickformat: ".0%" } });
    const corr = RISK.corrMatrix(C);
    UI.plot("chCorr", [{ type: "heatmap", z: corr, x: L.syms, y: L.syms, zmin: -1, zmax: 1, colorscale: [[0, "#B42318"], [0.5, "#FFFFFF"], [1, "#13294B"]], text: corr.map(function (r) { return r.map(function (v) { return v.toFixed(2); }); }), texttemplate: "%{text}", textfont: { size: 11 }, showscale: false }], { yaxis: { autorange: "reversed" }, margin: { l: 70, r: 20, t: 20, b: 60 } });

    // Stress
    const st = RISK.stress(betas, L.w, V);
    UI.table("stressTable", [{ h: "Scenario", f: function (x) { return "<strong>" + x.name + "</strong>"; } }, { h: "Description", f: function (x) { return '<span class="note">' + x.note + "</span>"; } }, { h: "Market shock", n: 1, f: function (x) { return UI.signPct(x.shock, 0); } },
      { h: "Portfolio P&amp;L", n: 1, f: function (x) { return '<span class="' + UI.cls(x.pnl) + '">' + UI.fmt(x.pnl) + "</span>"; } }, { h: "% of value", n: 1, f: function (x) { return UI.signPct(x.pnl / V); } },
      { h: "Largest contributor", f: function (x) { let k = 0; x.byAsset.forEach(function (v, i) { if (Math.abs(v) > Math.abs(x.byAsset[k])) k = i; }); return UI.esc(L.syms[k]) + " " + UI.fmt(x.byAsset[k]); } }], st);

    // Optimisation
    const Ca = C.map(function (r) { return r.map(function (v) { return v * 252; }); });
    const mu = $("muMode").value === "hist" ? L.R.map(function (r) { return RISK.mean(r) * 252; }) : betas.map(function (b) { return rf + b * ERP; });
    const capEff = Math.max(cap, 1 / L.syms.length + 1e-6);
    const fr = RISK.frontier(mu, Ca, rf, capEff, 40);
    const cur = RISK.stats(mu, Ca, L.w, rf);
    const rpw = RISK.riskParity(Ca), rps = RISK.stats(mu, Ca, rpw, rf);
    const eq = L.w.map(function () { return 1 / L.w.length; }), eqs = RISK.stats(mu, Ca, eq, rf);
    const pt = function (s, name, color, sym) { return { x: [s.vol], y: [s.ret], mode: "markers+text", name: name, text: [name], textposition: "top center", marker: { color: color, size: 13, symbol: sym || "circle", line: { color: "#fff", width: 1.5 } } }; };
    UI.plot("chEF", [
      { x: fr.points.map(function (p) { return p.vol; }), y: fr.points.map(function (p) { return p.ret; }), mode: "lines", name: "Efficient frontier", line: { color: "#13294B", width: 2.5 } },
      { x: vols.map(function (v, i) { return Math.sqrt(Ca[i][i]); }), y: mu, mode: "markers+text", text: L.syms, textposition: "bottom center", textfont: { size: 10, color: "#6B7A8C" }, name: "Single positions", marker: { color: "#B9C4D2", size: 8 } },
      { x: [0, fr.maxSharpe.vol * 1.6], y: [rf, rf + fr.maxSharpe.sharpe * fr.maxSharpe.vol * 1.6], mode: "lines", name: "Capital market line", line: { color: "#B8892B", width: 1, dash: "dot" } },
      pt(cur, "Current", "#C8102E", "diamond"), pt(fr.maxSharpe, "Max Sharpe", "#1B7F5B", "star"), pt(fr.minVar, "Min variance", "#2E7D9A"), pt(rps, "Risk parity", "#B8892B", "square")
    ], { xaxis: { title: "Volatility (annualised)", tickformat: ".0%", rangemode: "tozero" }, yaxis: { title: "Expected return", tickformat: ".1%" }, showlegend: false, margin: { l: 60, r: 20, t: 20, b: 50 } });

    const wcol = function (h, w) { return { h: h, n: 1, f: function (x) { return UI.pct(w[x.i]); } }; };
    UI.table("optTable", [{ h: "Position", f: function (x) { return "<strong>" + UI.esc(x.s) + "</strong>"; } }, wcol("Current", L.w), wcol("Max Sharpe", fr.maxSharpe.w), wcol("Min variance", fr.minVar.w), wcol("Risk parity", rpw),
      { h: "Trade to max Sharpe", n: 1, f: function (x) { const dlt = (fr.maxSharpe.w[x.i] - L.w[x.i]) * V; return '<span class="' + UI.cls(dlt) + '">' + (dlt >= 0 ? "+" : "−") + UI.fmt(Math.abs(dlt)) + "</span>"; } }],
      L.syms.map(function (s, i) { return { s: s, i: i }; }));
    const sc = function (h, k, f) { return { h: h, n: 1, f: function (x) { return f(x[1][k]); } }; };
    UI.table("optStats", [{ h: "Portfolio", f: function (x) { return x[0]; } }, sc("Expected return", "ret", UI.pct), sc("Volatility", "vol", UI.pct), sc("Sharpe", "sharpe", function (v) { return v.toFixed(2); })],
      [["Current", cur], ["Max Sharpe", fr.maxSharpe], ["Min variance", fr.minVar], ["Risk parity", rps], ["Equal weight", eqs]]);

    last.out = { S: S, pos: pos, var: { pv: pv, hv: hv, mc: mc.var, pc: pc, hc: hc, mcc: mc.cvar }, opt: { ms: fr.maxSharpe.w, mv: fr.minVar.w, rp: rpw }, conf: conf, hor: hor };
    try { localStorage.setItem("fin_portfolio_weights", JSON.stringify({ syms: L.syms, w: L.w, value: V, bench: L.bench })); } catch (e) {}
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
    rows = loadSaved().map(function (r) { return r.slice(); }); drawRows();
    $("add").onclick = function () { rows.push(["", 10000]); drawRows(); };
    $("preset").onchange = function () { if (PRESETS[this.value]) { rows = PRESETS[this.value].map(function (r) { return r.slice(); }); save(); drawRows(); run(); } this.value = ""; };
    $("run").onclick = run; $("csv").onclick = exportCsv;
    ["conf", "hor", "rf", "cap", "muMode"].forEach(function (id) { $(id).oninput = render; });
    ["bench", "lookback"].forEach(function (id) { $(id).onchange = function () { if (last) run(); }; });
    $("o_rf").textContent = UI.pct(+$("rf").value, 2); $("o_cap").textContent = UI.pct(+$("cap").value, 0);
    const ix = await API.localIndex();
    if (ix && ix.prices) $("universe").textContent = ix.prices.length + " tickers refreshed daily; any other ticker loads live with a data key.";
    run();
  });
})();
