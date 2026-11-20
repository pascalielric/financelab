/* Monte Carlo page controller */
(function () {
  "use strict";
  const $ = function (id) { return document.getElementById(id); };
  const ERP = 0.055, STEPS = 52;
  let saved = null, ownRows = null, mode = "model", ownEd = null;
  try { const v = JSON.parse(localStorage.getItem("fin_portfolio_weights")); if (v && v.syms && v.syms.length > 1) saved = v; } catch (e) {}
  try { const v = JSON.parse(localStorage.getItem("fin_custom_mc")); if (v && v.rows && v.rows.length) ownRows = v.rows; } catch (e) {}

  function options() {
    return PF.PRESETS.map(function (p) { return '<option value="' + p.id + '">' + p.name + "</option>"; }).join("") +
      (saved ? '<option value="saved">My holdings from the Portfolio Risk page</option>' : "");
  }
  function presetById(id) {
    if (id === "saved" && saved) {
      const tot = saved.w.reduce(function (a, b) { return a + b; }, 0);
      return { name: "My holdings from the Portfolio Risk page", bench: saved.bench || "SPY", desc: "The holdings you last analysed on the Portfolio Risk page.", h: saved.syms.map(function (s, i) { return [s, +(saved.w[i] / tot * 100).toFixed(1)]; }) };
    }
    return PF.PRESETS.find(function (p) { return p.id === id; });
  }
  function describe() {
    const p = presetById($("pSel").value);
    $("pDesc").innerHTML = "<b>" + p.name + ".</b> " + UI.esc(p.desc) + '<span class="holdings">' + UI.esc(PF.holdingsText(p.h)) + "</span>";
  }
  function getPortfolio() {
    let h, bench, name;
    if (mode === "own") {
      h = ownRows.filter(function (r) { return r[0] && +r[1] > 0; }); bench = $("ownBench").value; name = "Your portfolio";
    } else { const p = presetById($("pSel").value); h = p.h; bench = p.bench; name = p.name; }
    const tot = h.reduce(function (a, r) { return a + (+r[1]); }, 0);
    return { name: name, syms: h.map(function (r) { return r[0].toUpperCase(); }), w: h.map(function (r) { return +r[1] / tot; }), bench: bench };
  }

  function status(msg, cls) { const s = $("pStatus"); s.className = "status " + (cls || ""); s.textContent = msg; s.classList.toggle("hidden", !msg); }
  function labels() { $("o_yrs").textContent = $("yrs").value + " years"; $("o_n").textContent = UI.fmt(+$("n").value); $("o_rf").textContent = UI.pct(+$("rf").value, 2); }

  async function runPortfolio() {
    const P = getPortfolio();
    if (P.syms.length < 2) { status("Enter at least two holdings with a weight.", "err"); return; }
    if (new Set(P.syms).size !== P.syms.length) { status("Each ticker should appear once.", "err"); return; }
    const years = +$("yrs").value, nPaths = +$("n").value, v0 = +$("v0").value, rf = +$("rf").value;
    $("runP").disabled = true; status("Loading prices…");
    try {
      const h = await API.history(P.syms.concat([P.bench]), 757, status);
      const miss = P.syms.concat([P.bench]).filter(function (s) { return !h.data[s]; });
      if (miss.length) throw new Error("No price data for " + miss.join(", "));
      const al = RISK.align(h.data, P.syms.concat([P.bench]));
      const R = al.prices.map(RISK.logReturns), rb = R.pop(), n = P.syms.length, w = P.w;
      const C = RISK.covMatrix(R).map(function (r) { return r.map(function (v) { return v * 252; }); });
      const betas = R.map(function (r) { return RISK.beta(r, rb); });
      const mu = $("drift").value === "hist" ? R.map(function (r, i) { return RISK.mean(r) * 252 + 0.5 * C[i][i]; }) : betas.map(function (b) { return rf + b * ERP; });
      status("Simulating…");
      await new Promise(function (r) { setTimeout(r, 30); });

      const rnd = UI.rng(987654321), T = years * STEPS, dt = 1 / STEPS, L = RISK.cholesky(C);
      const pct = [0.05, 0.25, 0.5, 0.75, 0.95], bands = pct.map(function () { return new Array(T + 1); });
      const vals = new Float64Array(nPaths).fill(v0), peak = new Float64Array(nPaths).fill(v0), mdd = new Float64Array(nPaths);
      const sample = []; for (let k = 0; k < 40; k++) sample.push([v0]);
      bands.forEach(function (b) { b[0] = v0; });
      const boot = $("method").value === "boot", Td = R[0].length, z = new Array(n);
      for (let t = 1; t <= T; t++) {
        for (let p = 0; p < nPaths; p++) {
          let pr = 0;
          if (boot) {
            const s0 = Math.floor(rnd() * (Td - 5));
            for (let i = 0; i < n; i++) { let lr = 0; for (let d = 0; d < 5; d++) lr += R[i][s0 + d]; pr += w[i] * (Math.exp(lr * (252 / (STEPS * 5))) - 1); }
          } else {
            for (let i = 0; i < n; i++) z[i] = UI.gauss(rnd);
            for (let i = 0; i < n; i++) { let x = (mu[i] - 0.5 * C[i][i]) * dt; const sq = Math.sqrt(dt); for (let k = 0; k <= i; k++) x += L[i][k] * z[k] * sq; pr += w[i] * (Math.exp(x) - 1); }
          }
          const v = vals[p] * (1 + pr); vals[p] = v;
          if (v > peak[p]) peak[p] = v; else { const d = 1 - v / peak[p]; if (d > mdd[p]) mdd[p] = d; }
          if (p < 40) sample[p].push(v);
        }
        const sorted = Array.from(vals).sort(function (a, b) { return a - b; });
        pct.forEach(function (q, k) { bands[k][t] = UI.quantile(sorted, q); });
      }
      const fin = Array.from(vals).sort(function (a, b) { return a - b; });
      const q = function (x) { return UI.quantile(fin, x); };
      const meanV = UI.mean(fin), pLoss = fin.filter(function (v) { return v < v0; }).length / nPaths, pDouble = fin.filter(function (v) { return v >= 2 * v0; }).length / nPaths;
      const var95 = v0 - q(0.05), tail = fin.slice(0, Math.max(1, Math.floor(nPaths * 0.05))), cvar95 = v0 - UI.mean(tail);
      const cagr = function (v) { return Math.pow(v / v0, 1 / years) - 1; };
      const ws = RISK.stats(mu, C, w, rf);
      status("");
      $("pRes").classList.remove("hidden");
      const demo = h.demoSymbols || [];
      $("pDemo").innerHTML = demo.length ? '<div class="callout warn"><strong>No market data for ' + demo.join(", ") + '.</strong> ' + (demo.length > 1 ? "These holdings use" : "This holding uses") + ' simulated prices, so the results below are only illustrative. Pick tickers from the search list to use real data.</div>' : '<p class="note" style="margin-top:18px">' + UI.esc(P.name) + ": daily closes from " + al.dates[0] + " to " + al.dates[al.dates.length - 1] + " (Yahoo Finance).</p>";
      $("pKpis").innerHTML =
        '<div class="kpi dark"><div class="label">Median final value</div><div class="value">' + UI.fmt(q(0.5)) + '</div><div class="sub">' + UI.signPct(cagr(q(0.5))) + " per year</div></div>" +
        '<div class="kpi"><div class="label">5th percentile</div><div class="value neg">' + UI.fmt(q(0.05)) + '</div><div class="sub">' + UI.signPct(cagr(q(0.05))) + " per year</div></div>" +
        '<div class="kpi"><div class="label">95th percentile</div><div class="value pos">' + UI.fmt(q(0.95)) + '</div><div class="sub">' + UI.signPct(cagr(q(0.95))) + " per year</div></div>" +
        '<div class="kpi"><div class="label">Probability of loss</div><div class="value">' + UI.pct(pLoss) + '</div><div class="sub">after ' + years + " years</div></div>" +
        '<div class="kpi"><div class="label">Median worst drawdown</div><div class="value">' + UI.pct(-UI.quantile(Array.from(mdd).sort(function (a, b) { return a - b; }), 0.5)) + '</div><div class="sub">along the path</div></div>';

      const xs = []; for (let t = 0; t <= T; t++) xs.push(t / STEPS);
      const traces = sample.slice(0, 25).map(function (s) { return { x: xs, y: s, mode: "lines", line: { color: "rgba(17,17,17,.10)", width: 1 }, hoverinfo: "skip", showlegend: false }; });
      traces.push({ x: xs, y: bands[4], mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" });
      traces.push({ x: xs, y: bands[0], mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(140,135,124,.22)", name: "5th to 95th percentile" });
      traces.push({ x: xs, y: bands[3], mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" });
      traces.push({ x: xs, y: bands[1], mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(140,135,124,.38)", name: "25th to 75th percentile" });
      traces.push({ x: xs, y: bands[2], mode: "lines", line: { color: "#111111", width: 2.5 }, name: "Median" });
      UI.plot("chFan", traces, { xaxis: { title: "Years" }, yaxis: { tickformat: ",.0f" }, shapes: [{ type: "line", x0: 0, x1: years, y0: v0, y1: v0, line: { color: "#7A1E1E", dash: "dot", width: 1.5 } }] });
      UI.plot("chTerm", [{ type: "histogram", x: fin.filter(function (v) { return v <= q(0.995); }), nbinsx: 70, marker: { color: "#8C877C" } }], {
        showlegend: false, bargap: 0.03, margin: { l: 60, r: 24, t: 34, b: 52 }, xaxis: { tickformat: ",.0f", title: "Portfolio value at the horizon" }, yaxis: { title: "Number of paths" },
        shapes: [{ type: "line", x0: v0, x1: v0, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", dash: "dash", width: 2 } }, { type: "line", x0: q(0.5), x1: q(0.5), yref: "paper", y0: 0, y1: 1, line: { color: "#111111", width: 2 } }],
        annotations: [{ x: v0, yref: "paper", y: 1, yanchor: "bottom", xanchor: v0 < q(0.5) ? "right" : "left", xshift: v0 < q(0.5) ? -6 : 6, text: "Start", showarrow: false, font: { size: 13, color: "#7A1E1E" } }, { x: q(0.5), yref: "paper", y: 1, yanchor: "bottom", xanchor: v0 < q(0.5) ? "left" : "right", xshift: v0 < q(0.5) ? 6 : -6, text: "Median", showarrow: false, font: { size: 13, color: "#111111" } }]
      });
      UI.table("pTable", [{ h: "Final value after " + years + " years", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return UI.fmt(x[1]); } }, { h: "Return p.a.", n: 1, f: function (x) { return UI.signPct(cagr(x[1])); } }],
        [["1st percentile", q(0.01)], ["5th percentile", q(0.05)], ["25th percentile", q(0.25)], ["Median", q(0.5)], ["Mean", meanV], ["75th percentile", q(0.75)], ["95th percentile", q(0.95)], ["99th percentile", q(0.99)]]);
      UI.table("pTable2", [{ h: "Risk measures", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }], [
        ["Expected return of the portfolio (input)", UI.pct(ws.ret)], ["Volatility of the portfolio (input)", UI.pct(ws.vol)],
        ["95% VaR at horizon", UI.fmt(var95) + " (" + UI.pct(var95 / v0) + ")"], ["95% CVaR at horizon", UI.fmt(cvar95) + " (" + UI.pct(cvar95 / v0) + ")"],
        ["Probability of ending below start", UI.pct(pLoss)], ["Probability of doubling", UI.pct(pDouble)],
        ["Paths × weekly steps", UI.fmt(nPaths) + " × " + T], ["Method", boot ? "Block bootstrap" : "Correlated GBM"]]);
    } catch (e) { status(e.message, "err"); }
    $("runP").disabled = false;
  }

  // ---------- Stochastic DCF ----------
  const G = window.GIVAUDAN, sc = G.scenarios.base;
  let givPx = null;
  API.localQuote("GIVN.SW").then(function (q) { if (q) givPx = q.price; });
  const DCTRL = [
    { k: "sg", label: "Revenue growth, std. dev.", min: 0, max: 0.03, step: 0.0025, v: 0.01, f: function (v) { return (v * 100).toFixed(2) + " pt"; } },
    { k: "sm", label: "EBITDA margin, std. dev.", min: 0, max: 0.03, step: 0.0025, v: 0.01, f: function (v) { return (v * 100).toFixed(2) + " pt"; } },
    { k: "sw", label: "WACC, std. dev.", min: 0, max: 0.015, step: 0.0005, v: 0.004, f: function (v) { return (v * 100).toFixed(2) + " pt"; } },
    { k: "st", label: "Terminal growth, std. dev.", min: 0, max: 0.01, step: 0.0005, v: 0.0035, f: function (v) { return (v * 100).toFixed(2) + " pt"; } },
    { k: "sx", label: "Exit multiple, std. dev.", min: 0, max: 5, step: 0.25, v: 2, f: function (v) { return v.toFixed(2) + "x"; } }
  ];
  const ds = {};
  function baseIn() { return Object.assign({}, G.common, { base: G.base, years: G.years, growth: sc.growth, ebitdaMargin: sc.ebitdaMargin, tgr: sc.tgr, exitMultiple: sc.exitMultiple, netDebt: G.netDebt, otherClaims: G.otherClaims, sharesOut: G.sharesOut, price: G.referencePrice }); }
  function shifted(a, dg, dm, w, t, x) {
    return Object.assign({}, a, { growth: a.growth.map(function (v) { return v + dg; }), ebitdaMargin: a.ebitdaMargin.map(function (v) { return v + dm; }), waccOverride: w, tgr: t, exitMultiple: x });
  }
  function runDcf() {
    const a = baseIn(), w0 = DCF.run(a).r, rnd = UI.rng(13579), N = 10000, out = new Array(N), price = givPx || G.referencePrice;
    for (let i = 0; i < N; i++) {
      const t = Math.min(0.03, Math.max(0.005, a.tgr + ds.st * UI.gauss(rnd)));
      const w = Math.max(t + 0.01, w0 + ds.sw * UI.gauss(rnd));
      out[i] = DCF.run(shifted(a, ds.sg * UI.gauss(rnd), ds.sm * UI.gauss(rnd), w, t, Math.max(8, a.exitMultiple + ds.sx * UI.gauss(rnd)))).blended.perShare;
    }
    out.sort(function (x, y) { return x - y; });
    const q = function (p) { return UI.quantile(out, p); }, pAbove = out.filter(function (v) { return v > price; }).length / N, base = DCF.run(a).blended.perShare;
    $("dKpis").innerHTML =
      '<div class="kpi dark"><div class="label">Median value per share</div><div class="value">CHF ' + UI.fmt(q(0.5)) + '</div><div class="sub">Point estimate CHF ' + UI.fmt(base) + "</div></div>" +
      '<div class="kpi"><div class="label">5th to 95th percentile</div><div class="value" style="font-size:1.35rem">' + UI.fmt(q(0.05)) + " to " + UI.fmt(q(0.95)) + '</div><div class="sub">CHF per share</div></div>' +
      '<div class="kpi"><div class="label">Probability above share price</div><div class="value">' + UI.pct(pAbove, 0) + '</div><div class="sub">Price CHF ' + UI.fmt(price) + "</div></div>" +
      '<div class="kpi"><div class="label">Mean</div><div class="value">CHF ' + UI.fmt(UI.mean(out)) + '</div><div class="sub">Right skewed: mean above median</div></div>' +
      '<div class="kpi"><div class="label">Coefficient of variation</div><div class="value">' + UI.pct(UI.std(out) / UI.mean(out), 0) + '</div><div class="sub">Std. dev. / mean</div></div>';
    UI.plot("chDcf", [{ type: "histogram", x: out.filter(function (v) { return v < q(0.995); }), nbinsx: 80, marker: { color: "#8C877C" } }], {
      showlegend: false, bargap: 0.03, margin: { l: 60, r: 24, t: 34, b: 52 }, xaxis: { tickformat: ",.0f", title: "Value per share, CHF" }, yaxis: { title: "Number of runs" },
      shapes: [{ type: "line", x0: price, x1: price, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", dash: "dash", width: 2 } }, { type: "line", x0: q(0.5), x1: q(0.5), yref: "paper", y0: 0, y1: 1, line: { color: "#111111", width: 2 } }],
      annotations: [{ x: price, yref: "paper", y: 1, yanchor: "bottom", xanchor: price < q(0.5) ? "right" : "left", xshift: price < q(0.5) ? -6 : 6, text: "Share price", showarrow: false, font: { size: 13, color: "#7A1E1E" } }, { x: q(0.5), yref: "paper", y: 1, yanchor: "bottom", xanchor: price < q(0.5) ? "left" : "right", xshift: price < q(0.5) ? 6 : -6, text: "Median", showarrow: false, font: { size: 13, color: "#111111" } }]
    });
    const one = function (dg, dm, dw, dt, dx) { return DCF.run(shifted(a, dg, dm, w0 + dw, a.tgr + dt, a.exitMultiple + dx)).blended.perShare; };
    const tor = [["Revenue growth", one(-ds.sg, 0, 0, 0, 0), one(ds.sg, 0, 0, 0, 0)], ["EBITDA margin", one(0, -ds.sm, 0, 0, 0), one(0, ds.sm, 0, 0, 0)], ["WACC", one(0, 0, ds.sw, 0, 0), one(0, 0, -ds.sw, 0, 0)],
      ["Terminal growth", one(0, 0, 0, -ds.st, 0), one(0, 0, 0, ds.st, 0)], ["Exit multiple", one(0, 0, 0, 0, -ds.sx), one(0, 0, 0, 0, ds.sx)]].sort(function (x, y) { return Math.abs(x[2] - x[1]) - Math.abs(y[2] - y[1]); });
    UI.plot("chTor", [
      { type: "bar", orientation: "h", y: tor.map(function (t) { return t[0]; }), x: tor.map(function (t) { return t[1] - base; }), base: base, marker: { color: "#7A1E1E" }, name: "Unfavourable", text: tor.map(function (t) { return UI.fmt(t[1]); }), textposition: "outside" },
      { type: "bar", orientation: "h", y: tor.map(function (t) { return t[0]; }), x: tor.map(function (t) { return t[2] - base; }), base: base, marker: { color: "#2F4A36" }, name: "Favourable", text: tor.map(function (t) { return UI.fmt(t[2]); }), textposition: "outside" }
    ], { barmode: "overlay", margin: { l: 120, r: 50, t: 20, b: 60 }, xaxis: { title: "CHF per share", tickformat: ",.0f", range: [Math.min.apply(null, tor.map(function (t) { return t[1]; })) - 150, Math.max.apply(null, tor.map(function (t) { return t[2]; })) + 150] }, legend: { orientation: "h", y: -0.28 } });
    UI.table("dTable", [{ h: "Percentile", f: function (x) { return x[0]; } }, { h: "Value per share (CHF)", n: 1, f: function (x) { return UI.fmt(x[1]); } }, { h: "vs. share price", n: 1, f: function (x) { return '<span class="' + UI.clsBand(x[1] / price - 1) + '">' + UI.signPct(x[1] / price - 1) + "</span>"; } }],
      [["5th", q(0.05)], ["25th", q(0.25)], ["50th (median)", q(0.5)], ["75th", q(0.75)], ["95th", q(0.95)]]);
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("pSel").innerHTML = options(); $("ownFrom").innerHTML = options();
    if (!ownRows) ownRows = PF.PRESETS[2].h.map(function (r) { return r.slice(); });
    const saveOwn = function () { try { localStorage.setItem("fin_custom_mc", JSON.stringify({ rows: ownRows })); } catch (e) {} };
    ownEd = PF.editor($("ownEditor"), ownRows, { mode: "weight", onChange: function (r) { ownRows = r; saveOwn(); } });
    $("ownCopy").onclick = function () { ownRows = presetById($("ownFrom").value).h.map(function (r) { return r.slice(); }); ownEd.set(ownRows); saveOwn(); };
    $("pSel").onchange = function () { describe(); runPortfolio(); };
    describe();
    document.querySelectorAll("#pMode button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll("#pMode button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on");
        mode = b.dataset.m; $("modelBox").classList.toggle("hidden", mode !== "model"); $("ownBox").classList.toggle("hidden", mode !== "own");
      };
    });
    ["yrs", "n", "rf"].forEach(function (id) { $(id).oninput = labels; }); labels();
    $("runP").onclick = runPortfolio;
    $("dControls").innerHTML = DCTRL.map(function (c) { ds[c.k] = c.v; return '<div class="ctl"><label><span>' + c.label + '</span><output id="o_' + c.k + '">' + c.f(c.v) + '</output></label><input type="range" id="c_' + c.k + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '" value="' + c.v + '"></div>'; }).join("");
    DCTRL.forEach(function (c) { $("c_" + c.k).oninput = function (e) { ds[c.k] = +e.target.value; $("o_" + c.k).textContent = c.f(ds[c.k]); }; });
    $("runD").onclick = runDcf;
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on");
        $("t_port").classList.toggle("hidden", b.dataset.t !== "port"); $("t_dcf").classList.toggle("hidden", b.dataset.t !== "dcf");
        if (b.dataset.t === "dcf") runDcf();
      };
    });
    runPortfolio();
  });
})();
