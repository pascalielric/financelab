/* DCF page controller */
(function () {
  "use strict";
  const G = window.GIVAUDAN;
  const state = { scen: "base", tvMode: "blended", price: G.referencePrice, priceLabel: "Reference price CHF " + UI.fmt(G.referencePrice) + " (" + G.referencePriceDate + ")", o: {} };

  const shift = function (v) { return (v >= 0 ? "+" : "\u2212") + Math.abs(v * 100).toFixed(2) + " pt"; };
  const CTRL = [
    { k: "g", label: "Growth shift", tip: "Revenue growth, added to every forecast year", min: -0.03, max: 0.03, step: 0.0025, f: shift },
    { k: "m", label: "Margin shift", tip: "EBITDA margin, added to every forecast year", min: -0.03, max: 0.03, step: 0.0025, f: shift },
    { k: "capexPct", label: "Capex / sales", tip: "Capital expenditure as a share of sales", min: 0.03, max: 0.06, step: 0.001, f: UI.pct },
    { k: "nwcPct", label: "Working capital / sales", tip: "Net working capital as a share of sales", min: 0.18, max: 0.30, step: 0.005, f: UI.pct },
    { k: "taxRate", label: "Tax rate", tip: "Tax rate on operating profit", min: 0.12, max: 0.25, step: 0.005, f: UI.pct },
    { k: "rf", label: "Risk free rate", tip: "Swiss 10 year government bond yield", min: 0, max: 0.03, step: 0.0005, f: function (v) { return UI.pct(v, 2); } },
    { k: "beta", label: "Equity beta", tip: "Sensitivity of the share to the market", min: 0.6, max: 1.3, step: 0.01, f: function (v) { return v.toFixed(2); } },
    { k: "erp", label: "Equity risk premium", tip: "Extra return investors demand for equities", min: 0.04, max: 0.075, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "kd", label: "Cost of debt", tip: "Pre tax cost of debt", min: 0.01, max: 0.05, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "debtWeight", label: "Debt weight", tip: "Debt / (debt + equity) at market values", min: 0, max: 0.3, step: 0.01, f: function (v) { return UI.pct(v, 0); } },
    { k: "tgr", label: "Terminal growth", tip: "Growth of free cash flow after FY31E", min: 0.005, max: 0.03, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "exitMultiple", label: "Exit multiple", tip: "EV / EBITDA multiple applied to FY31E", min: 12, max: 26, step: 0.5, f: function (v) { return v.toFixed(1) + "x"; } }
  ];

  function defaults() {
    const sc = G.scenarios[state.scen];
    state.o = Object.assign({ g: 0, m: 0 }, G.common, { tgr: sc.tgr, exitMultiple: sc.exitMultiple });
  }

  function inputs() {
    const sc = G.scenarios[state.scen], o = state.o;
    return Object.assign({}, o, {
      base: G.base, years: G.years,
      growth: sc.growth.map(function (v) { return v + o.g; }),
      ebitdaMargin: sc.ebitdaMargin.map(function (v) { return v + o.m; }),
      netDebt: G.netDebt, otherClaims: G.otherClaims, sharesOut: G.sharesOut, price: state.price
    });
  }

  function buildControls() {
    const el = document.getElementById("controls");
    el.innerHTML = CTRL.map(function (c) {
      return '<div class="ctl" title="' + c.tip + '"><label><span>' + c.label + '</span><output id="o_' + c.k + '"></output></label><input type="range" id="c_' + c.k + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '"></div>';
    }).join("");
    CTRL.forEach(function (c) {
      document.getElementById("c_" + c.k).oninput = function (e) { state.o[c.k] = +e.target.value; render(); };
    });
    document.getElementById("reset").onclick = function () { defaults(); syncControls(); render(); };
  }
  function syncControls() {
    CTRL.forEach(function (c) { document.getElementById("c_" + c.k).value = state.o[c.k]; });
  }

  function pick(r) { return state.tvMode === "gordon" ? r.gordon.perShare : state.tvMode === "exit" ? r.exit.perShare : r.blended.perShare; }

  function render() {
    CTRL.forEach(function (c) { document.getElementById("o_" + c.k).textContent = c.f(state.o[c.k]); });
    const a = inputs();
    const r = DCF.run(a);
    const ps = pick(r), up = ps / state.price - 1;
    const rating = up > 0.15 ? ["buy", "Undervalued"] : up < -0.15 ? ["sell", "Overvalued"] : ["hold", "Fairly valued"];
    const evSel = state.tvMode === "exit" ? r.exit.ev : state.tvMode === "gordon" ? r.gordon.ev : (r.gordon.ev + r.exit.ev) / 2;
    document.getElementById("pxNote").textContent = state.priceLabel;
    document.getElementById("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">Value per share</div><div class="value">CHF ' + UI.fmt(ps) + '</div><div class="sub">' + state.tvMode + " terminal value</div></div>" +
      '<div class="kpi"><div class="label">vs. share price</div><div class="value ' + UI.cls(up) + '">' + UI.signPct(up) + '</div><div class="sub"><span class="badge ' + rating[0] + '">' + rating[1] + "</span></div></div>" +
      '<div class="kpi"><div class="label">Enterprise value</div><div class="value">' + UI.fmt(evSel / 1000, 1) + ' bn</div><div class="sub">' + UI.mult(evSel / r.rows[0].ebitda) + " FY27E EBITDA</div></div>" +
      '<div class="kpi"><div class="label">WACC</div><div class="value">' + UI.pct(r.r, 2) + '</div><div class="sub">Cost of equity ' + UI.pct(r.wacc.ke, 2) + "</div></div>" +
      '<div class="kpi"><div class="label">Terminal value share</div><div class="value">' + UI.pct(state.tvMode === "exit" ? r.exit.tvShare : r.gordon.tvShare, 0) + '</div><div class="sub">of enterprise value</div></div>';

    // Forecast table
    const H = G.historicals;
    const heads = H.map(function (h) { return h.year; }).concat(r.rows.map(function (x) { return "FY" + String(x.year).slice(2) + "E"; }));
    const hv = function (f) { return H.map(f); };
    const pv = function (f) { return r.rows.map(f); };
    const growthHist = [null, H[1].revenue / H[0].revenue - 1, H[2].revenue / H[1].revenue - 1];
    UI.fin("fcfTable", heads, [
      { label: "Revenue", vals: hv(function (h) { return h.revenue; }).concat(pv(function (x) { return x.revenue; })), cls: "hl" },
      { label: "&nbsp;&nbsp;growth", vals: growthHist.concat(pv(function (x) { return x.growth; })), f: UI.pct, cls: "sub" },
      { label: "EBITDA", vals: hv(function (h) { return h.ebitda; }).concat(pv(function (x) { return x.ebitda; })) },
      { label: "&nbsp;&nbsp;margin", vals: hv(function (h) { return h.ebitda / h.revenue; }).concat(pv(function (x) { return x.margin; })), f: UI.pct, cls: "sub" },
      { label: "Depreciation and amortisation", vals: hv(function (h) { return -h.da; }).concat(pv(function (x) { return -x.da; })) },
      { label: "EBIT", vals: hv(function (h) { return h.ebit; }).concat(pv(function (x) { return x.ebit; })) },
      { label: "Taxes on EBIT", vals: ["", "", ""].concat(pv(function (x) { return -x.tax; })) },
      { label: "NOPAT (net operating profit after tax)", vals: ["", "", ""].concat(pv(function (x) { return x.nopat; })) },
      { label: "Add back D&amp;A", vals: ["", "", ""].concat(pv(function (x) { return x.da; })) },
      { label: "Capital expenditure", vals: hv(function (h) { return -h.capex; }).concat(pv(function (x) { return -x.capex; })) },
      { label: "Lease payments", vals: ["", "", ""].concat(pv(function (x) { return -x.lease; })) },
      { label: "Change in net working capital", vals: ["", "", ""].concat(pv(function (x) { return -x.dNwc; })) },
      { label: "Unlevered free cash flow", vals: ["", "", ""].concat(pv(function (x) { return x.ufcf; })), cls: "total" },
      { label: "&nbsp;&nbsp;% of revenue", vals: ["", "", ""].concat(pv(function (x) { return x.ufcf / x.revenue; })), f: UI.pct, cls: "sub" },
      { label: "Discount factor (mid year)", vals: ["", "", ""].concat(pv(function (x) { return x.df; })), f: function (v) { return v.toFixed(3); }, cls: "sub" },
      { label: "Present value of UFCF", vals: ["", "", ""].concat(pv(function (x) { return x.pv; })) }
    ], 2);

    // Charts
    const xs = heads;
    UI.plot("chRev", [
      { type: "bar", x: xs, y: hv(function (h) { return h.revenue; }).concat(pv(function (x) { return x.revenue; })), name: "Revenue (CHF m)", marker: { color: xs.map(function (_, i) { return i < 2 ? "#00011F" : "#8C877C"; }) } },
      { type: "scatter", mode: "lines+markers", x: xs, y: hv(function (h) { return h.ebitda / h.revenue; }).concat(pv(function (x) { return x.margin; })), name: "EBITDA margin", yaxis: "y2", line: { color: "#7A1E1E", width: 2.5 } }
    ], { yaxis2: { overlaying: "y", side: "right", tickformat: ".1%", showgrid: false, range: [0.2, 0.28] }, margin: { l: 56, r: 56, t: 20, b: 44 } });

    const sel = state.tvMode === "exit" ? r.exit : r.gordon;
    const pvTv = state.tvMode === "blended" ? (r.gordon.pvTv + r.exit.pvTv) / 2 : sel.pvTv;
    const ev = r.pvSum + pvTv, eq = ev - G.netDebt - G.otherClaims;
    UI.plot("chBridge", [{
      type: "waterfall", orientation: "v", measure: ["relative", "relative", "total", "relative", "relative", "total"],
      x: ["PV of UFCF<br>FY27 to FY31", "PV of terminal<br>value", "Enterprise<br>value", "Net debt", "Pensions", "Equity<br>value"],
      y: [r.pvSum, pvTv, 0, -G.netDebt, -G.otherClaims, 0],
      text: [r.pvSum, pvTv, ev, -G.netDebt, -G.otherClaims, eq].map(function (v) { return UI.fmt(v); }), textposition: "outside",
      connector: { line: { color: "#CFC9BC" } }, increasing: { marker: { color: "#8C877C" } }, decreasing: { marker: { color: "#7A1E1E" } }, totals: { marker: { color: "#00011F" } }
    }], { showlegend: false, margin: { l: 56, r: 20, t: 30, b: 70 }, yaxis: { range: [0, ev * 1.15] }, xaxis: { tickangle: 0, tickfont: { size: 11 } } });

    // WACC and TV tables
    UI.table("waccTable", [{ h: "Cost of capital", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }, { h: "Basis", f: function (x) { return '<span class="note">' + x[2] + "</span>"; } }], [
      ["Risk free rate", UI.pct(a.rf, 2), "Swiss 10 year Confederation yield"],
      ["Equity beta", a.beta.toFixed(2), "Weekly beta against the Swiss market"],
      ["Equity risk premium", UI.pct(a.erp, 2), "Blended, global revenue exposure"],
      ["Cost of equity", UI.pct(r.wacc.ke, 2), "Capital asset pricing model (CAPM)"],
      ["Pre tax cost of debt", UI.pct(a.kd, 2), "Bond yields plus spread"],
      ["After tax cost of debt", UI.pct(r.wacc.kdAfterTax, 2), "× (1 − tax rate)"],
      ["Equity weight / debt weight", UI.pct(r.wacc.we, 0) + " / " + UI.pct(r.wacc.wd, 0), "Market values"],
      ["WACC", "<strong>" + UI.pct(r.r, 2) + "</strong>", ""]
    ], { rowClass: function (x) { return x[0] === "WACC" ? "total" : ""; } });
    UI.table("tvTable", [{ h: "Terminal value", f: function (x) { return x[0]; } }, { h: "Gordon growth", n: 1, f: function (x) { return x[1]; } }, { h: "Exit multiple", n: 1, f: function (x) { return x[2]; } }], [
      ["Assumption", UI.pct(a.tgr, 2) + " growth", UI.mult(a.exitMultiple) + " EBITDA"],
      ["Terminal value (FY31)", UI.fmt(r.gordon.tv), UI.fmt(r.exit.tv)],
      ["PV of terminal value", UI.fmt(r.gordon.pvTv), UI.fmt(r.exit.pvTv)],
      ["Cross check", UI.mult(r.gordon.impliedExitMultiple) + " implied multiple", UI.pct(r.exit.impliedGrowth, 2) + " implied growth"],
      ["Enterprise value", UI.fmt(r.gordon.ev), UI.fmt(r.exit.ev)],
      ["Less net debt and pensions", UI.fmt(-(G.netDebt + G.otherClaims)), UI.fmt(-(G.netDebt + G.otherClaims))],
      ["Equity value", UI.fmt(r.gordon.equity), UI.fmt(r.exit.equity)],
      ["Value per share (CHF)", "<strong>" + UI.fmt(r.gordon.perShare) + "</strong>", "<strong>" + UI.fmt(r.exit.perShare) + "</strong>"]
    ], { rowClass: function (x) { return x[0].indexOf("Value per share") === 0 ? "total" : ""; } });

    // Sensitivities (5 x 5, centred on the current case)
    const step = 0.0025;
    const waccs = [-2, -1, 0, 1, 2].map(function (i) { return r.r + i * step; });
    const tgrs = [-2, -1, 0, 1, 2].map(function (i) { return a.tgr + i * step; });
    const mults = [-2, -1, 0, 1, 2].map(function (i) { return a.exitMultiple + i * 1; });
    const color = function (v) { return UI.heat(v, state.price * 0.7, state.price, state.price * 1.3); };
    UI.sens("sens1", "WACC", "terminal growth", waccs, tgrs, DCF.sensitivity(a, waccs, tgrs, "gordon"), function (v) { return UI.pct(v, 2); }, function (v) { return UI.pct(v, 2); }, function (v) { return UI.fmt(v); }, 2, 2, color);
    UI.sens("sens2", "WACC", "exit multiple", waccs, mults, DCF.sensitivity(a, waccs, mults, "exit"), function (v) { return UI.pct(v, 2); }, function (v) { return UI.mult(v); }, function (v) { return UI.fmt(v); }, 2, 2, color);

    footballField(a, r);
    if (window.DCFX) DCFX.render(state.scen);
  }

  function footballField(a, r) {
    const scen = function (s) {
      const sc = G.scenarios[s];
      return DCF.run(Object.assign({}, a, { growth: sc.growth, ebitdaMargin: sc.ebitdaMargin, tgr: sc.tgr, exitMultiple: sc.exitMultiple }));
    };
    const bear = scen("bear"), bull = scen("bull");
    const g1 = DCF.sensitivity(a, [r.r + 0.005, r.r - 0.005], [a.tgr - 0.005, a.tgr + 0.005], "gordon");
    const x1 = DCF.sensitivity(a, [r.r + 0.005, r.r - 0.005], [a.exitMultiple - 2, a.exitMultiple + 2], "exit");
    const perShare = function (m) { return (m * G.ebitdaFY26E - G.netDebt - G.otherClaims) / G.sharesOut; };
    const comps = G.compsRange.map(perShare), prec = G.precedentRange.map(perShare);
    const w52 = state.w52 || [G.week52Low, G.week52High];
    const bars = [
      ["DCF scenarios, blended", "Bear to bull case", bear.blended.perShare, bull.blended.perShare, "#00011F"],
      ["DCF, Gordon growth", "WACC \u00b10.5 pt, growth \u00b10.5 pt", g1[0][0], g1[1][1], "#3A3A3A"],
      ["DCF, exit multiple", "WACC \u00b10.5 pt, multiple \u00b12x", x1[0][0], x1[1][1], "#6E6A61"],
      ["Precedent transactions", G.precedentRange[0].toFixed(1) + "x to " + G.precedentRange[1].toFixed(1) + "x FY26E EBITDA", prec[0], prec[1], "#8C6D3F"],
      ["Trading comparables", G.compsRange[0] + "x to " + G.compsRange[1] + "x FY26E EBITDA", comps[0], comps[1], "#9C978C"],
      ["52 week trading range", state.w52 ? "SIX closing prices" : "Reported range", w52[0], w52[1], "#CFC9BC"]
    ];
    const keys = bars.map(function (b, i) { return "r" + i; });
    const lo = Math.min.apply(null, bars.map(function (b) { return b[2]; }).concat([state.price]));
    const hi = Math.max.apply(null, bars.map(function (b) { return b[3]; }).concat([state.price]));
    const xr = [Math.floor(lo * 0.86 / 250) * 250, Math.ceil(hi * 1.07 / 250) * 250];
    const ann = [];
    bars.forEach(function (b, i) {
      ann.push({ x: b[2], y: keys[i], xanchor: "right", xshift: -8, text: UI.fmt(b[2]), showarrow: false, font: { size: 14, color: "#111111" }, bgcolor: "#FCFBF8" });
      ann.push({ x: b[3], y: keys[i], xanchor: "left", xshift: 8, text: UI.fmt(b[3]), showarrow: false, font: { size: 14, color: "#111111" }, bgcolor: "#FCFBF8" });
    });
    ann.push({ x: state.price, yref: "paper", y: 1.0, yanchor: "bottom", text: "Share price CHF " + UI.fmt(state.price), showarrow: false, font: { size: 13, color: "#7A1E1E" }, bgcolor: "#FCFBF8" });
    UI.plot("chFF", [
      { type: "bar", orientation: "h", y: keys, x: bars.map(function (b) { return b[3] - b[2]; }), base: bars.map(function (b) { return b[2]; }), width: 0.46,
        marker: { color: bars.map(function (b) { return b[4]; }) }, hovertemplate: "%{customdata}<extra></extra>",
        customdata: bars.map(function (b) { return b[0] + ": CHF " + UI.fmt(b[2]) + " to " + UI.fmt(b[3]); }), showlegend: false }
    ], {
      margin: { l: 250, r: 30, t: 40, b: 56 }, height: 400,
      xaxis: { title: "Value per share, CHF", tickformat: ",.0f", range: xr, dtick: 500, zeroline: false },
      yaxis: { tickvals: keys, ticktext: bars.map(function (b) { return b[0] + "<br><span style=\"font-size:12px;color:#6E6A61\">" + b[1] + "</span>"; }), autorange: "reversed", showgrid: false, tickfont: { size: 14 }, ticks: "" },
      shapes: [{ type: "line", x0: state.price, x1: state.price, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", width: 1.5, dash: "dot" } }],
      annotations: ann
    });
  }

  function staticContent() {
    const R = G.rationale;
    document.getElementById("method").innerHTML =
      "<p><strong>Forecast.</strong> Revenue is built by division: Fragrance &amp; Beauty grows about 6% and Taste &amp; Wellbeing 3.5% in the base case, so group revenue grows 5.0% in FY27E easing to 4.2% by FY31E, inside the 4 to 6% like for like range of the 2030 strategy. EBITDA margin expands from 23.6% to 24.8% as one off costs of CHF 103m booked in H1 2026 fall away and Fragrance and Beauty, the higher margin division, grows faster than Taste and Wellbeing.</p>" +
      "<p><strong>Risk free rate.</strong> " + R.rf + ".</p>" +
      "<p><strong>Beta and equity risk premium.</strong> " + R.beta + ". " + R.erp + ".</p>" +
      "<p><strong>Capital structure.</strong> " + R.debtWeight + ".</p>" +
      "<p><strong>Terminal value.</strong> A CHF discount rate near 5.5% makes the valuation highly sensitive to terminal assumptions: about 85% of enterprise value sits in the terminal value. Both methods are therefore shown and cross checked (implied multiple from Gordon growth, implied growth from the exit multiple), and the headline uses the average.</p>" +
      "<p><strong>Bridge.</strong> Equity value equals enterprise value less estimated net debt of CHF " + UI.fmt(G.netDebt) + "m and pension liabilities of CHF " + UI.fmt(G.otherClaims) + "m, divided by " + G.sharesOut.toFixed(2) + "m shares.</p>" +
      "<p><strong>Limitations.</strong> FY26E is an estimate until results on 27 January 2027. Currency translation (a strong franc reduced reported nine month sales growth by about 4 points) is not modelled separately and is the main source of forecast error against reported figures.</p>";
    document.getElementById("sources").innerHTML = G.sources.map(function (s) { return '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + "</a></li>"; }).join("");
  }

  function seg(id, attr, key) {
    document.querySelectorAll("#" + id + " button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll("#" + id + " button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on"); state[key] = b.dataset[attr];
        if (key === "scen") { defaults(); syncControls(); }
        render();
      };
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    defaults(); buildControls(); syncControls(); staticContent();
    if (window.DCFX) DCFX.init();
    seg("scen", "s", "scen"); seg("tvm", "m", "tvMode");
    // Use the latest SIX close from the daily data refresh when available
    API.localPrices("GIVN.SW").then(function (lp) {
      if (!lp || !lp.series.length) return;
      const ser = lp.series, last = ser[ser.length - 1], yr = ser.slice(-252).map(function (p) { return p.close; });
      state.price = last.close; state.w52 = [Math.min.apply(null, yr), Math.max.apply(null, yr)];
      state.priceLabel = "Share price CHF " + UI.fmt(last.close) + ", SIX close " + new Date(last.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      render();
    });
    render();
  });
})();
