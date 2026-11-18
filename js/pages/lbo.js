/* LBO page controller */
(function () {
  "use strict";
  const T = window.TEMENOS;
  const state = { c: "base", o: {} };
  const CTRL = [
    { k: "premium", label: "Offer premium", tip: "Premium to the unaffected share price", min: 0, max: 0.6, step: 0.01, f: function (v) { return UI.pct(v, 0); } },
    { k: "tlb", label: "Term loan", tip: "Term Loan B, senior secured institutional loan, as a multiple of EBITDA", min: 2, max: 6, step: 0.25, f: function (v) { return v.toFixed(2) + "x"; } },
    { k: "notes", label: "Secured notes", tip: "Senior secured notes as a multiple of EBITDA", min: 0, max: 3, step: 0.25, f: function (v) { return v.toFixed(2) + "x"; } },
    { k: "tlbRate", label: "Term loan rate", tip: "Interest rate on the term loan", min: 0.05, max: 0.10, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "notesRate", label: "Notes coupon", tip: "Fixed coupon on the notes", min: 0.06, max: 0.11, step: 0.0025, f: function (v) { return UI.pct(v, 2); } },
    { k: "exitMultiple", label: "Exit multiple", tip: "EV / EBITDA multiple at exit", min: 11, max: 23, step: 0.5, f: function (v) { return v.toFixed(1) + "x"; } },
    { k: "g", label: "Growth shift", tip: "Revenue growth, added to every year", min: -0.04, max: 0.04, step: 0.005, f: function (v) { return (v >= 0 ? "+" : "\u2212") + Math.abs(v * 100).toFixed(1) + " pt"; } },
    { k: "m", label: "Margin shift", tip: "EBITDA margin, added to every year", min: -0.05, max: 0.05, step: 0.005, f: function (v) { return (v >= 0 ? "+" : "\u2212") + Math.abs(v * 100).toFixed(1) + " pt"; } },
    { k: "sweepPct", label: "Cash sweep", tip: "Share of excess cash used to repay the term loan", min: 0, max: 1, step: 0.25, f: function (v) { return UI.pct(v, 0); } },
    { k: "mipPct", label: "Management plan", tip: "Management incentive, share of the equity gain", min: 0, max: 0.15, step: 0.01, f: function (v) { return UI.pct(v, 0); } }
  ];
  function defaults() {
    const m = T.model, cs = T.cases[state.c];
    state.o = { premium: m.premium, tlb: m.tranches[0].multiple, notes: m.tranches[1].multiple, tlbRate: m.tranches[0].rate, notesRate: m.tranches[1].rate, exitMultiple: cs.exitMultiple, g: 0, m: 0, sweepPct: m.sweepPct, mipPct: m.mipPct };
  }
  function inputs() {
    const m = LBO.clone(T.model), cs = T.cases[state.c], o = state.o;
    m.growth = cs.growth.map(function (v) { return v + o.g; });
    m.ebitdaMargin = cs.ebitdaMargin.map(function (v) { return v + o.m; });
    m.exitMultiple = o.exitMultiple; m.premium = o.premium; m.sweepPct = o.sweepPct; m.mipPct = o.mipPct;
    m.tranches[0].multiple = o.tlb; m.tranches[0].rate = o.tlbRate;
    m.tranches[1].multiple = o.notes; m.tranches[1].rate = o.notesRate;
    m.priceLocal = T.unaffectedPrice; m.fxToModel = 1 / T.usdChf; m.dilutedShares = T.dilutedShares; m.existingNetDebt = T.netDebt2026E;
    return m;
  }
  function buildControls() {
    document.getElementById("controls").innerHTML = CTRL.map(function (c) {
      return '<div class="ctl" title="' + c.tip + '"><label><span>' + c.label + '</span><output id="o_' + c.k + '"></output></label><input type="range" id="c_' + c.k + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '"></div>';
    }).join("");
    CTRL.forEach(function (c) { document.getElementById("c_" + c.k).oninput = function (e) { state.o[c.k] = +e.target.value; render(); }; });
    document.getElementById("reset").onclick = function () { defaults(); sync(); render(); };
  }
  function sync() { CTRL.forEach(function (c) { document.getElementById("c_" + c.k).value = state.o[c.k]; }); }

  function render() {
    CTRL.forEach(function (c) { document.getElementById("o_" + c.k).textContent = c.f(state.o[c.k]); });
    const a = inputs(), r = LBO.run(a), N = r.rows.length, last = r.rows[N - 1];
    const irrCls = r.irr >= 0.2 ? "pos" : r.irr < 0.15 ? "neg" : "";
    document.getElementById("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">Sponsor IRR</div><div class="value">' + UI.pct(r.irr) + '</div><div class="sub">' + N + " year hold, exit end " + last.year + "</div></div>" +
      '<div class="kpi"><div class="label">MOIC</div><div class="value ' + irrCls + '">' + UI.mult(r.moic, 2) + '</div><div class="sub">Equity ' + UI.fmt(r.sponsorEquity) + " to " + UI.fmt(r.exitEquity) + "</div></div>" +
      '<div class="kpi"><div class="label">Offer price</div><div class="value">CHF ' + r.offerLocal.toFixed(2) + '</div><div class="sub">' + UI.pct(a.premium, 0) + " premium to CHF " + T.unaffectedPrice.toFixed(2) + "</div></div>" +
      '<div class="kpi"><div class="label">Entry EV</div><div class="value">' + UI.fmt(r.ev0 / 1000, 1) + ' bn</div><div class="sub">' + UI.mult(r.entryMultiple) + " FY26E EBITDA</div></div>" +
      '<div class="kpi"><div class="label">Leverage at close</div><div class="value">' + UI.mult(r.debt0 / a.ebitda0) + '</div><div class="sub">Equity ' + UI.pct(r.equityPct, 0) + " of total sources</div></div>";

    const tot = r.totalUses;
    UI.table("sources", [{ h: "Sources", f: function (x) { return x.item; } }, { h: "USD m", n: 1, f: function (x) { return UI.fmt(x.value); } }, { h: "x EBITDA", n: 1, f: function (x) { return UI.mult(x.multiple); } }, { h: "% total", n: 1, f: function (x) { return UI.pct(x.value / tot, 0); } }],
      r.sources.concat([{ item: "Total sources", value: tot, multiple: tot / a.ebitda0 }]), { rowClass: function (x) { return x.item === "Total sources" ? "total" : ""; } });
    UI.table("uses", [{ h: "Uses", f: function (x) { return x.item; } }, { h: "USD m", n: 1, f: function (x) { return UI.fmt(x.value); } }, { h: "% total", n: 1, f: function (x) { return UI.pct(x.value / tot, 0); } }],
      r.uses.concat([{ item: "Total uses", value: tot }]), { rowClass: function (x) { return x.item === "Total uses" ? "total" : ""; } });

    const heads = ["FY26E"].concat(r.rows.map(function (x) { return "FY" + String(x.year).slice(2) + "E"; }));
    const p = function (f, first) { return [first == null ? "" : first].concat(r.rows.map(f)); };
    UI.fin("opTable", heads, [
      { label: "Revenue", vals: p(function (x) { return x.revenue; }, a.revenue0), cls: "hl" },
      { label: "&nbsp;&nbsp;growth", vals: p(function (x) { return x.growth; }), f: UI.pct, cls: "sub" },
      { label: "EBITDA (non IFRS)", vals: p(function (x) { return x.ebitda; }, a.ebitda0) },
      { label: "&nbsp;&nbsp;margin", vals: p(function (x) { return x.margin; }, a.ebitda0 / a.revenue0), f: UI.pct, cls: "sub" },
      { label: "Capital expenditure incl. capitalised development", vals: p(function (x) { return -x.capex; }) },
      { label: "Change in net working capital", vals: p(function (x) { return -x.dNwc; }) },
      { label: "Cash interest", vals: p(function (x) { return -x.interest; }) },
      { label: "Cash taxes", vals: p(function (x) { return -x.tax; }) },
      { label: "Free cash flow before debt repayment", vals: p(function (x) { return x.fcf; }), cls: "total" },
      { label: "Mandatory amortisation", vals: p(function (x) { return -x.mandatory.reduce(function (s, v) { return s + v; }, 0); }) },
      { label: "Cash sweep", vals: p(function (x) { return -x.sweep.reduce(function (s, v) { return s + v; }, 0); }) },
      { label: r.tranches[0].name, vals: p(function (x) { return x.balances[0]; }, r.tranches[0].amount) },
      { label: r.tranches[1].name, vals: p(function (x) { return x.balances[1]; }, r.tranches[1].amount) },
      { label: "Cash", vals: p(function (x) { return x.cash; }, a.minCash) },
      { label: "Net debt", vals: p(function (x) { return x.netDebt; }, r.debt0 - a.minCash), cls: "hl" },
      { label: "Net debt / EBITDA", vals: p(function (x) { return x.leverage; }, (r.debt0 - a.minCash) / a.ebitda0), f: UI.mult, cls: "sub" },
      { label: "EBITDA / cash interest", vals: p(function (x) { return x.coverage; }), f: UI.mult, cls: "sub" }
    ], 0);

    UI.plot("chDebt", [
      { type: "bar", x: heads, y: p(function (x) { return x.balances[0]; }, r.tranches[0].amount), name: "Term Loan B", marker: { color: "#00011F" } },
      { type: "bar", x: heads, y: p(function (x) { return x.balances[1]; }, r.tranches[1].amount), name: "Senior secured notes", marker: { color: "#8C877C" } },
      { type: "scatter", mode: "lines+markers+text", x: heads, y: p(function (x) { return x.leverage; }, (r.debt0 - a.minCash) / a.ebitda0), name: "Net debt / EBITDA", yaxis: "y2", line: { color: "#7A1E1E", width: 2.5 },
        text: p(function (x) { return x.leverage.toFixed(1) + "x"; }, ((r.debt0 - a.minCash) / a.ebitda0).toFixed(1) + "x"), textposition: "top center", textfont: { color: "#7A1E1E" } }
    ], { barmode: "stack", yaxis: { title: "USD m" }, yaxis2: { overlaying: "y", side: "right", showgrid: false, range: [0, 8], ticksuffix: "x" }, margin: { l: 60, r: 50, t: 20, b: 44 } });

    UI.plot("chBridge", [{
      type: "waterfall", measure: ["absolute"].concat(r.bridge.map(function () { return "relative"; })).concat(["total"]),
      x: ["Equity<br>at entry"].concat(r.bridge.map(function (b) { return b.item.replace(" and ", "<br>and ").replace("Multiple ", "Multiple<br>").replace("Management ", "Management<br>").replace("EBITDA ", "EBITDA<br>"); })).concat(["Equity<br>at exit"]),
      y: [r.sponsorEquity].concat(r.bridge.map(function (b) { return b.value; })).concat([0]),
      text: [r.sponsorEquity].concat(r.bridge.map(function (b) { return b.value; })).concat([r.exitEquity]).map(function (v) { return UI.fmt(v); }), textposition: "outside",
      connector: { line: { color: "#CFC9BC" } }, increasing: { marker: { color: "#2F4A36" } }, decreasing: { marker: { color: "#7A1E1E" } }, totals: { marker: { color: "#00011F" } }
    }], { showlegend: false, yaxis: { title: "USD m", range: [0, Math.max(r.exitEquity, r.sponsorEquity + r.bridge[0].value + Math.max(0, r.bridge[1].value) + r.bridge[2].value) * 1.15] }, xaxis: { tickangle: 0, tickfont: { size: 11 } }, margin: { l: 60, r: 20, t: 30, b: 70 } });

    UI.table("retTable", [{ h: "Exit and returns", f: function (x) { return x[0]; } }, { h: "USD m", n: 1, f: function (x) { return x[1]; } }], [
      ["Exit year EBITDA (FY" + String(last.year).slice(2) + "E)", UI.fmt(last.ebitda)],
      ["Exit multiple", UI.mult(a.exitMultiple)],
      ["Exit enterprise value", UI.fmt(r.exitEV)],
      ["Less net debt at exit", UI.fmt(-last.netDebt)],
      ["Less management incentive plan", UI.fmt(-r.mip)],
      ["Sponsor equity at exit", UI.fmt(r.exitEquity)],
      ["Sponsor equity invested", UI.fmt(r.sponsorEquity)],
      ["MOIC", UI.mult(r.moic, 2)],
      ["IRR", "<strong>" + UI.pct(r.irr) + "</strong>"]
    ], { rowClass: function (x) { return x[0] === "IRR" ? "total" : ""; } });

    const walk = [0.15, 0.175, 0.20, 0.225, 0.25].map(function (t) { const m = LBO.maxPremium(a, t); return { t: t, m: m }; });
    UI.table("walkTable", [{ h: "Target IRR", f: function (x) { return UI.pct(x.t, 1); } }, { h: "Max. price (CHF)", n: 1, f: function (x) { return x.m.priceLocal.toFixed(2); } }, { h: "Premium", n: 1, f: function (x) { return UI.pct(x.m.premium, 0); } }, { h: "EV / EBITDA", n: 1, f: function (x) { const b = LBO.clone(a); b.premium = x.m.premium; return UI.mult(LBO.run(b).entryMultiple); } }], walk);

    const prem = [-2, -1, 0, 1, 2].map(function (i) { return a.premium + i * 0.05; });
    const exits = [-2, -1, 0, 1, 2].map(function (i) { return a.exitMultiple + i; });
    const lev0 = state.o.tlb + state.o.notes;
    const levs = [-2, -1, 0, 1, 2].map(function (i) { return lev0 + i * 0.5; });
    const color = function (v) { return UI.heat(v, 0.10, 0.175, 0.25); };
    UI.sens("sens1", "Premium", "exit multiple", prem, exits, LBO.sensitivity(a, "premium", prem, "exitMultiple", exits), function (v) { return UI.pct(v, 0); }, UI.mult, UI.pct, 2, 2, color);
    UI.sens("sens2", "Leverage", "exit multiple", levs, exits, LBO.sensitivity(a, "leverage", levs, "exitMultiple", exits), UI.mult, UI.mult, UI.pct, 2, 2, color);
    if (window.LBOX) LBOX.render(a, r, state.c);
  }

  document.addEventListener("DOMContentLoaded", function () {
    defaults(); buildControls(); sync();
    document.querySelectorAll("#case button").forEach(function (b) {
      b.onclick = function () { document.querySelectorAll("#case button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); state.c = b.dataset.c; defaults(); sync(); render(); };
    });
    document.getElementById("srcList").innerHTML = T.sources.map(function (s) { return '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + "</a></li>"; }).join("");
    render();
  });
})();
