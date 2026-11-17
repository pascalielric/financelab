/* DCF page controller */
(function () {
  "use strict";
  const G = window.GIVAUDAN;
  const state = { scen: "base", tvMode: "blended", price: G.referencePrice, priceLabel: "Reference price CHF " + UI.fmt(G.referencePrice) + " (" + G.referencePriceDate + ")", o: {} };

  const CTRL = [
    { k: "g", label: "Revenue growth, all years (shift)", min: -0.03, max: 0.03, step: 0.0025, v: 0, f: function (v) { return (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + " pt"; } },
    { k: "m", label: "EBITDA margin, all years (shift)", min: -0.03, max: 0.03, step: 0.0025, v: 0, f: function (v) { return (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + " pt"; } },
    { k: "capexPct", label: "Capex, % of sales", min: 0.03, max: 0.06, step: 0.001, f: UI.pct },
    { k: "nwcPct", label: "Net working capital, % of sales", min: 0.18, max: 0.30, step: 0.005, f: UI.pct },
    { k: "taxRate", label: "Tax rate", min: 0.12, max: 0.25, step: 0.005, f: UI.pct },
    { k: "rf", label: "Risk free rate", min: 0, max: 0.03, step: 0.0005, f: function (v) { return UI.pct(v, 2); } },
    { k: "beta", label: "Equity beta", min: 0.6, max: 1.3, step: 0.01, f: function (v) { return v.toFixed(2); } },
    { k: "erp", label: "Equity risk premium", min: 0.04, max: 0.075, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "kd", label: "Pre tax cost of debt", min: 0.01, max: 0.05, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "debtWeight", label: "Debt / (debt + equity)", min: 0, max: 0.3, step: 0.01, f: function (v) { return UI.pct(v, 0); } },
    { k: "tgr", label: "Terminal growth rate", min: 0.005, max: 0.03, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "exitMultiple", label: "Exit EV/EBITDA multiple", min: 12, max: 26, step: 0.5, f: function (v) { return v.toFixed(1) + "x"; } }
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
      return '<div class="ctl"><label>' + c.label + ' <output id="o_' + c.k + '"></output></label><input type="range" id="c_' + c.k + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '"></div>';
    }).join("") + '<div class="ctl" style="align-self:end"><button class="btn ghost" id="reset">Reset to scenario defaults</button></div>';
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
      { type: "bar", x: xs, y: hv(function (h) { return h.revenue; }).concat(pv(function (x) { return x.revenue; })), name: "Revenue (CHF m)", marker: { color: xs.map(function (_, i) { return i < 2 ? "#13294B" : "#6C8EBF"; }) } },
      { type: "scatter", mode: "lines+markers", x: xs, y: hv(function (h) { return h.ebitda / h.revenue; }).concat(pv(function (x) { return x.margin; })), name: "EBITDA margin", yaxis: "y2", line: { color: "#C8102E", width: 2.5 } }
    ], { yaxis2: { overlaying: "y", side: "right", tickformat: ".1%", showgrid: false, range: [0.2, 0.28] }, margin: { l: 56, r: 56, t: 20, b: 44 } });

    const sel = state.tvMode === "exit" ? r.exit : r.gordon;
    const pvTv = state.tvMode === "blended" ? (r.gordon.pvTv + r.exit.pvTv) / 2 : sel.pvTv;
    const ev = r.pvSum + pvTv, eq = ev - G.netDebt - G.otherClaims;
    UI.plot("chBridge", [{
      type: "waterfall", orientation: "v", measure: ["relative", "relative", "total", "relative", "relative", "total"],
      x: ["PV of UFCF<br>FY27 to FY31", "PV of terminal<br>value", "Enterprise<br>value", "Net debt", "Pensions", "Equity<br>value"],
      y: [r.pvSum, pvTv, 0, -G.netDebt, -G.otherClaims, 0],
      text: [r.pvSum, pvTv, ev, -G.netDebt, -G.otherClaims, eq].map(function (v) { return UI.fmt(v); }), textposition: "outside",
      connector: { line: { color: "#C9D1DB" } }, increasing: { marker: { color: "#6C8EBF" } }, decreasing: { marker: { color: "#C8102E" } }, totals: { marker: { color: "#13294B" } }
    }], { showlegend: false, margin: { l: 56, r: 20, t: 30, b: 70 }, yaxis: { range: [0, ev * 1.15] }, xaxis: { tickangle: 0, tickfont: { size: 11 } } });

    // WACC and TV tables
    UI.table("waccTable", [{ h: "Cost of capital", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }, { h: "Basis", f: function (x) { return '<span class="note">' + x[2] + "</span>"; } }], [
      ["Risk free rate", UI.pct(a.rf, 2), "Swiss 10 year Confederation yield"],
      ["Equity beta", a.beta.toFixed(2), "5 year beta vs. global equities"],
      ["Equity risk premium", UI.pct(a.erp, 2), "Blended, global revenue exposure"],
      ["Cost of equity (CAPM)", UI.pct(r.wacc.ke, 2), "rf + beta × ERP"],
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
  }

  function footballField(a, r) {
    const scen = function (s) {
      const sc = G.scenarios[s];
      return DCF.run(Object.assign({}, a, { growth: sc.growth, ebitdaMargin: sc.ebitdaMargin, tgr: sc.tgr, exitMultiple: sc.exitMultiple }));
    };
    const bear = scen("bear"), bull = scen("bull");
    const g1 = DCF.sensitivity(a, [r.r + 0.005, r.r - 0.005], [a.tgr - 0.005, a.tgr + 0.005], "gordon");
    const x1 = DCF.sensitivity(a, [r.r + 0.005, r.r - 0.005], [a.exitMultiple - 2, a.exitMultiple + 2], "exit");
    const ebitdaNtm = r.rows[0].ebitda;
    const comps = G.compsRange.map(function (m) { return (m * ebitdaNtm - G.netDebt - G.otherClaims) / G.sharesOut; });
    const bars = [
      ["52 week trading range", G.week52Low, G.week52High],
      ["Trading comparables (" + G.compsRange[0] + "x to " + G.compsRange[1] + "x FY27E EBITDA)", comps[0], comps[1]],
      ["DCF, exit multiple (WACC ±0.5 pt, multiple ±2x)", x1[0][0], x1[1][1]],
      ["DCF, Gordon growth (WACC ±0.5 pt, growth ±0.5 pt)", g1[0][0], g1[1][1]],
      ["DCF scenarios, blended (bear to bull)", bear.blended.perShare, bull.blended.perShare]
    ];
    UI.plot("chFF", [
      { type: "bar", orientation: "h", y: bars.map(function (b) { return b[0]; }), x: bars.map(function (b) { return b[1]; }), marker: { color: "rgba(0,0,0,0)" }, hoverinfo: "skip", showlegend: false },
      { type: "bar", orientation: "h", y: bars.map(function (b) { return b[0]; }), x: bars.map(function (b) { return b[2] - b[1]; }), marker: { color: ["#B9C4D2", "#6C8EBF", "#2E7D9A", "#13294B", "#B8892B"] },
        text: bars.map(function (b) { return UI.fmt(b[1]) + " to " + UI.fmt(b[2]); }), textposition: "inside", insidetextanchor: "middle", textfont: { color: "#fff" }, hoverinfo: "skip", showlegend: false }
    ], {
      barmode: "stack", margin: { l: 330, r: 30, t: 30, b: 44 }, xaxis: { title: "CHF per share", tickformat: ",.0f", gridcolor: "#EEF1F5" },
      shapes: [{ type: "line", x0: state.price, x1: state.price, yref: "paper", y0: 0, y1: 1, line: { color: "#C8102E", width: 2, dash: "dash" } }],
      annotations: [{ x: state.price, yref: "paper", y: 1.07, text: "Share price CHF " + UI.fmt(state.price), showarrow: false, font: { color: "#C8102E", size: 12 } }]
    });
  }

  function staticContent() {
    const R = G.rationale;
    document.getElementById("method").innerHTML =
      "<p><strong>Forecast.</strong> Revenue grows 5.0% in FY27E easing to 4.2% by FY31E, inside the 4 to 6% like for like range of the 2030 strategy. EBITDA margin expands from 23.6% to 24.8% as one off costs of CHF 103m booked in H1 2026 fall away and Fragrance and Beauty, the higher margin division, grows faster than Taste and Wellbeing.</p>" +
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
    seg("scen", "s", "scen"); seg("tvm", "m", "tvMode");
    document.getElementById("livePx").onclick = async function () {
      const btn = this; btn.disabled = true;
      try {
        const local = await API.localQuote("GIVN.SW");
        if (local) { state.price = local.price; state.priceLabel = "Close CHF " + UI.fmt(local.price) + " on " + local.date + " (SIX, daily refresh)"; }
        else {
          const q = await API.quote(G.adr), fx = await API.quote("OANDA:USD_CHF").catch(function () { return null; });
          if (!fx) throw new Error("Live CHF price needs the daily data refresh (see README) or an FX capable Finnhub plan.");
          state.price = q.price * 50 * fx.price; state.priceLabel = "Live, derived from ADR " + G.adr;
        }
        render();
      } catch (e) { document.getElementById("pxNote").textContent = e.message; }
      btn.disabled = false;
    };
    render();
  });
})();
