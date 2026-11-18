/* Temenos LBO page: extended sections. Revenue build and ARR bridge, financial statements after the buyout, credit
   statistics and covenant tests, returns by exit year, dividend recap, management terms and the exit multiple cross check.
   Everything follows the sliders, because it is rebuilt from the same engine result on every render. */
(function () {
  "use strict";
  const T = window.TEMENOS, S = T.structure, P = window.PEERS;
  const YE = ["FY27E", "FY28E", "FY29E", "FY30E", "FY31E"];

  function lines(k) {
    const c = T.lines.cases[k], v = Object.assign({}, T.lines.fy26e), out = [Object.assign({}, v)];
    for (let i = 0; i < 5; i++) { v.subs *= 1 + c.subs[i]; v.maint *= 1 + c.maint[i]; v.serv *= 1 + c.serv[i]; out.push(Object.assign({}, v)); }
    return out;
  }

  function revenue(k) {
    const L = lines(k), H24 = T.lines.fy24pf, H25 = T.lines.fy25pf;
    const all = [H24, H25].concat(L);
    const heads = ["FY24PF", "FY25PF", "FY26E"].concat(YE);
    const tot = all.map(function (v) { return v.subs + v.maint + v.serv; });
    const gr = function (arr) { return arr.map(function (v, i) { return i ? v / arr[i - 1] - 1 : ""; }); };
    const subs = all.map(function (v) { return v.subs; }), maint = all.map(function (v) { return v.maint; }), serv = all.map(function (v) { return v.serv; });
    UI.fin("revLines", heads, [
      { label: "Subscription and SaaS", vals: subs }, { label: "&nbsp;&nbsp;growth", vals: gr(subs), f: UI.pct, cls: "sub" },
      { label: "Maintenance", vals: maint }, { label: "&nbsp;&nbsp;growth", vals: gr(maint), f: UI.pct, cls: "sub" },
      { label: "Services", vals: serv }, { label: "&nbsp;&nbsp;growth", vals: gr(serv), f: UI.pct, cls: "sub" },
      { label: "Total revenue", vals: tot, cls: "total" }, { label: "&nbsp;&nbsp;growth", vals: gr(tot), f: UI.pct, cls: "sub" },
      { label: "&nbsp;&nbsp;recurring share", vals: all.map(function (v, i) { return (v.subs + v.maint) / tot[i]; }), f: UI.pct, cls: "sub" }
    ], 2);
    // ARR bridge: ARR grows with recurring revenue; gross new ARR is what sales must sign to get there after churn
    const rec = L.map(function (v) { return v.subs + v.maint; });
    let arr = T.arr.fy26e; const rows = [];
    for (let i = 0; i < 5; i++) {
      const close = arr * rec[i + 1] / rec[i], churn = arr * T.arr.churn, gross = close - arr + churn;
      rows.push({ y: YE[i], open: arr, churn: churn, gross: gross, close: close, g: close / arr - 1 });
      arr = close;
    }
    UI.table("arrTable", [{ h: "ARR bridge (USD m)", f: function (x) { return x.y; } }, { h: "Opening", n: 1, f: function (x) { return UI.fmt(x.open); } },
      { h: "Churn", n: 1, f: function (x) { return UI.fmt(-x.churn); } }, { h: "Gross new and expansion", n: 1, f: function (x) { return UI.fmt(x.gross); } },
      { h: "Closing", n: 1, f: function (x) { return "<strong>" + UI.fmt(x.close) + "</strong>"; } }, { h: "Growth", n: 1, f: function (x) { return UI.pct(x.g); } }], rows);
    UI.plot("chLines", [
      { type: "bar", name: "Subscription and SaaS", x: heads.map(function (h) { return h.slice(2); }), y: subs, marker: { color: "#111111" } },
      { type: "bar", name: "Maintenance", x: heads.map(function (h) { return h.slice(2); }), y: maint, marker: { color: "#8C877C" } },
      { type: "bar", name: "Services", x: heads.map(function (h) { return h.slice(2); }), y: serv, marker: { color: "#CFC9BC" } }
    ], { barmode: "stack", margin: { l: 56, r: 20, t: 16, b: 40 }, yaxis: { title: { text: "USD m" } }, xaxis: { tickangle: 0, tickfont: { size: 10 } }, legend: { orientation: "h", y: 1.12, x: 0 } });
  }

  function statements(a, r) {
    const intang = r.ev0 * S.ppa.intangiblePctEv, ppa = intang / S.ppa.life;
    const finFees = r.uses[3].value, feeAm = finFees / S.feeLife, adv = r.uses[2].value;
    let eq = r.sponsorEquity - adv;
    const ni = [], equity = [], fcf = [];
    r.rows.forEach(function (x) {
      const n = x.ebit - ppa - x.interest - feeAm - x.tax; ni.push(n); eq += n; equity.push(eq); fcf.push(x.fcf);
    });
    const heads = YE;
    UI.fin("stmtTable", heads, [
      { label: "Revenue", vals: r.rows.map(function (x) { return x.revenue; }) },
      { label: "EBITDA", vals: r.rows.map(function (x) { return x.ebitda; }) },
      { label: "Amortisation of acquired intangibles", vals: r.rows.map(function () { return -ppa; }) },
      { label: "Cash interest incl. revolver fees", vals: r.rows.map(function (x) { return -x.interest; }) },
      { label: "Net income (book)", vals: ni, cls: "hl" },
      { label: "Free cash flow before debt repayment", vals: fcf, cls: "total" },
      { label: "Total debt", vals: r.rows.map(function (x) { return x.totalDebt; }) },
      { label: "Cash", vals: r.rows.map(function (x) { return x.cash; }) },
      { label: "Shareholders' equity (book)", vals: equity }
    ]);
    const cov = S.covenants;
    UI.fin("credTable", heads, [
      { label: "Net debt / EBITDA", vals: r.rows.map(function (x) { return x.leverage; }), f: function (v) { return UI.mult(v); }, cls: "hl" },
      { label: "&nbsp;&nbsp;covenant (maximum)", vals: cov.netLeverage, f: function (v) { return UI.mult(v); }, cls: "sub" },
      { label: "&nbsp;&nbsp;headroom: EBITDA could fall by", vals: r.rows.map(function (x, i) { return 1 - x.leverage / cov.netLeverage[i]; }), f: UI.pct, cls: "sub" },
      { label: "EBITDA / cash interest", vals: r.rows.map(function (x) { return x.coverage; }), f: function (v) { return UI.mult(v); }, cls: "hl" },
      { label: "&nbsp;&nbsp;covenant (minimum)", vals: cov.interestCover, f: function (v) { return UI.mult(v); }, cls: "sub" },
      { label: "&nbsp;&nbsp;headroom: EBITDA could fall by", vals: r.rows.map(function (x, i) { return 1 - cov.interestCover[i] / x.coverage; }), f: UI.pct, cls: "sub" },
      { label: "Revolver drawn", vals: r.rows.map(function (x) { return x.rcf; }) },
      { label: "Test", vals: r.rows.map(function (x, i) { return x.leverage <= cov.netLeverage[i] && x.coverage >= cov.interestCover[i] ? "Pass" : "Breach"; }), f: function (v) { return v; } }
    ]);
    document.getElementById("stmtNote").textContent = "Purchase accounting: " + UI.pct(S.ppa.intangiblePctEv, 0) + " of enterprise value (USD " + UI.fmt(intang) +
      "m) is allocated to customer relationships and technology and amortised over " + S.ppa.life + " years; goodwill takes the rest. Book profit is low early on because of that amortisation; cash flow is not affected. The full linked income statement, cash flow statement and balance sheet are on the Statements tab of the Excel model.";
  }

  function returns(a, r) {
    const by = r.byYear;
    UI.plot("chExit", [
      { type: "bar", name: "IRR", x: by.map(function (b) { return "FY" + String(b.year).slice(2) + "E"; }), y: by.map(function (b) { return b.irr; }), marker: { color: by.map(function (b, i) { return i === by.length - 1 ? "#111111" : "#8C877C"; }) },
        text: by.map(function (b) { return UI.pct(b.irr) + "<br>" + UI.mult(b.moic, 2); }), textposition: "outside", cliponaxis: false }
    ], { showlegend: false, margin: { l: 56, r: 20, t: 30, b: 40 }, yaxis: { tickformat: ".0%", range: [0, Math.max.apply(null, by.map(function (b) { return b.irr; })) * 1.35] } });
    const rc = LBO.recap(a, r, S.recap.year, S.recap.targetLeverage, S.recap.rate);
    UI.table("recapTable", [{ h: "Dividend recap in FY" + String(r.rows[S.recap.year - 1].year).slice(2) + "E", f: function (x) { return x[0]; } }, { h: "", n: 1, f: function (x) { return x[1]; } }], [
      ["Re lever to net debt / EBITDA of", UI.mult(S.recap.targetLeverage)],
      ["Dividend to the sponsor (USD m)", UI.fmt(rc.dividend)],
      ["IRR without recap", UI.pct(r.irr)],
      ["IRR with recap", "<strong>" + UI.pct(rc.irr) + "</strong>"],
      ["MOIC with recap", UI.mult(rc.moic, 2)]
    ], { rowClass: function (x) { return x[0] === "IRR with recap" ? "total" : ""; } });
    const ro = S.rollover;
    UI.table("mgmtTable", [{ h: "Management terms", f: function (x) { return x[0]; } }, { h: "USD m", n: 1, f: function (x) { return x[1]; } }], [
      ["Rollover of existing shares", UI.fmt(ro)],
      ["Sponsor cash equity", UI.fmt(r.sponsorEquity - ro)],
      ["Incentive plan pool, % of equity gain", UI.pct(a.mipPct, 0)],
      ["At exit: rollover value", UI.fmt(ro * r.moic)],
      ["At exit: incentive plan payout", UI.fmt(r.mip)],
      ["At exit: total to management", "<strong>" + UI.fmt(ro * r.moic + r.mip) + "</strong>"]
    ], { rowClass: function (x) { return x[0].indexOf("total") > 0 ? "total" : ""; } });
    // Exit multiple cross check against listed banking software peers
    const s = P.sets.temenos, ev = function (p) { return p.mcap + p.debt - p.cash; };
    const m = s.peers.map(function (p) { return ev(p) / p.ebitda; }).sort(function (x, y) { return x - y; });
    const med = m[(m.length - 1) / 2];
    const rows = s.peers.slice().sort(function (x, y) { return ev(y) / y.ebitda - ev(x) / x.ebitda; }).map(function (p) { return { n: p.name, m: ev(p) / p.ebitda, pe: p.fwdPE, g: p.revGrowth }; });
    rows.push({ n: "Peer median", m: med, cls: "total" });
    rows.push({ n: "Exit multiple in this case", m: a.exitMultiple, cls: "hl" });
    UI.table("tcompsTable", [{ h: "Listed banking software", f: function (x) { return x.n; } }, { h: "EV / LTM EBITDA", n: 1, f: function (x) { return UI.mult(x.m); } },
      { h: "Forward P/E", n: 1, f: function (x) { return x.pe == null ? "" : UI.mult(x.pe); } }, { h: "Revenue growth", n: 1, f: function (x) { return x.g == null ? "" : UI.pct(x.g); } }],
      rows, { rowClass: function (x) { return x.cls || ""; } });
  }

  window.LBOX = { render: function (a, r, k) { revenue(k); statements(a, r); returns(a, r); } };
})();
