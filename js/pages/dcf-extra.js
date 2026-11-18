/* Givaudan DCF page: extended sections (revenue build by division, reported history, beta cross check,
   trading comparables and precedent transactions). Uses the same data as the Excel model. */
(function () {
  "use strict";
  const G = window.GIVAUDAN, P = window.PEERS;
  const YE = ["FY27E", "FY28E", "FY29E", "FY30E", "FY31E"];

  function divisionPath(k) {
    const c = G.divisions.cases[k]; let fb = G.divisions.fy26e.fb, tw = G.divisions.fy26e.tw;
    const out = [{ fb: fb, tw: tw }];
    for (let i = 0; i < 5; i++) { fb *= 1 + c.fb[i]; tw *= 1 + c.tw[i]; out.push({ fb: fb, tw: tw }); }
    return out;
  }

  function revenue(k) {
    const H = G.history, path = divisionPath(k);
    const heads = H.years.concat(["FY26E"]).concat(YE);
    const fb = H.salesFB.concat(path.map(function (p) { return p.fb; }));
    const tw = H.salesTW.concat(path.map(function (p) { return p.tw; }));
    const tot = fb.map(function (v, i) { return v + tw[i]; });
    const gr = tot.map(function (v, i) { return i ? v / tot[i - 1] - 1 : ""; });
    const c = G.divisions.cases[k];
    UI.fin("revBuild", heads, [
      { label: "Fragrance &amp; Beauty", vals: fb },
      { label: "&nbsp;&nbsp;growth", vals: fb.map(function (v, i) { return i ? v / fb[i - 1] - 1 : ""; }), f: UI.pct, cls: "sub" },
      { label: "Taste &amp; Wellbeing", vals: tw },
      { label: "&nbsp;&nbsp;growth", vals: tw.map(function (v, i) { return i ? v / tw[i - 1] - 1 : ""; }), f: UI.pct, cls: "sub" },
      { label: "Group sales", vals: tot, cls: "total" },
      { label: "&nbsp;&nbsp;growth (Swiss francs)", vals: gr, f: UI.pct, cls: "sub" },
      { label: "&nbsp;&nbsp;Fragrance &amp; Beauty share", vals: fb.map(function (v, i) { return v / tot[i]; }), f: UI.pct, cls: "sub" }
    ], 4);
    document.getElementById("revNote").textContent = G.scenarios[k].label + " case: Fragrance & Beauty grows " + UI.pct(c.fb[0]) + " in FY27E easing to " + UI.pct(c.fb[4]) +
      "; Taste & Wellbeing grows " + UI.pct(c.tw[0]) + " a year. Reported years show reported Swiss franc figures; like for like growth was higher because of the strong franc.";
    UI.plot("chDiv", [
      { type: "bar", name: "Fragrance & Beauty", x: heads.map(function (h) { return h.slice(2); }), y: fb, marker: { color: "#00011F" } },
      { type: "bar", name: "Taste & Wellbeing", x: heads.map(function (h) { return h.slice(2); }), y: tw, marker: { color: "#B8B2A5" } }
    ], { barmode: "stack", margin: { l: 56, r: 20, t: 16, b: 40 }, yaxis: { title: { text: "CHF m" } }, xaxis: { tickangle: 0, tickfont: { size: 10 } }, legend: { orientation: "h", y: 1.12, x: 0 } });
  }

  function history() {
    const H = G.history, n = H.years.length;
    const sales = H.salesFB.map(function (v, i) { return v + H.salesTW[i]; });
    const ebitda = H.ebitdaFB.map(function (v, i) { return v + H.ebitdaTW[i]; });
    UI.fin("histTable", H.years, [
      { label: "Like for like growth: Fragrance &amp; Beauty", vals: H.lflFB, f: UI.pct },
      { label: "Like for like growth: Taste &amp; Wellbeing", vals: H.lflTW, f: UI.pct },
      { label: "Like for like growth: Group", vals: H.lflGroup, f: UI.pct, cls: "hl" },
      { label: "EBITDA margin: Fragrance &amp; Beauty", vals: H.ebitdaFB.map(function (v, i) { return v / H.salesFB[i]; }), f: UI.pct },
      { label: "EBITDA margin: Taste &amp; Wellbeing", vals: H.ebitdaTW.map(function (v, i) { return v / H.salesTW[i]; }), f: UI.pct },
      { label: "EBITDA margin: Group", vals: ebitda.map(function (v, i) { return v / sales[i]; }), f: UI.pct, cls: "hl" },
      { label: "Free cash flow (CHF m)", vals: H.fcf },
      { label: "&nbsp;&nbsp;% of sales", vals: H.fcf.map(function (v, i) { return v / sales[i]; }), f: UI.pct, cls: "sub" },
      { label: "Capital expenditure, % of sales", vals: H.capex.map(function (v, i) { return v / sales[i]; }), f: UI.pct },
      { label: "Dividend per share (CHF)", vals: H.dps, f: function (v) { return v.toFixed(0); } },
      { label: "Net debt / EBITDA", vals: H.netDebt.map(function (v, i) { return v / ebitda[i]; }), f: function (v) { return UI.mult(v); } }
    ]);
  }

  function weekly(series) {
    const out = {};
    series.forEach(function (p) {
      const d = new Date(p.date + "T00:00:00Z"), dow = d.getUTCDay(), add = (5 - dow + 7) % 7;
      const fri = new Date(d.getTime() + add * 86400000).toISOString().slice(0, 10);
      out[fri] = p.close;
    });
    return out;
  }

  async function beta() {
    const rows = [];
    try {
      const g = await API.localPrices("GIVN.SW"), m = await API.localPrices("^SSMI");
      if (g && m) {
        const wg = weekly(g.series), wm = weekly(m.series);
        const keys = Object.keys(wg).filter(function (k) { return wm[k] != null; }).sort();
        const last = Math.min(new Date(g.series[g.series.length - 1].date), new Date(m.series[m.series.length - 1].date));
        const ks = keys.filter(function (k) { return new Date(k) <= last + 0; });
        const rg = [], rm = [];
        for (let i = 1; i < ks.length; i++) { rg.push(wg[ks[i]] / wg[ks[i - 1]] - 1); rm.push(wm[ks[i]] / wm[ks[i - 1]] - 1); }
        const mg = UI.mean(rg), mm = UI.mean(rm);
        let cov = 0, vm = 0;
        for (let i = 0; i < rg.length; i++) { cov += (rg[i] - mg) * (rm[i] - mm); vm += (rm[i] - mm) * (rm[i] - mm); }
        const b = cov / vm;
        rows.push(["Givaudan against the Swiss Market Index", b.toFixed(2), (0.67 * b + 0.33).toFixed(2), rg.length + " weekly returns, " + ks[0] + " to " + ks[ks.length - 1]]);
      }
    } catch (e) { /* data not available yet */ }
    const s = P.sets.givaudan, t = G.common.taxRate;
    rows.push(["Givaudan against MSCI World (5 years)", s.self.beta5y.toFixed(2), (0.67 * s.self.beta5y + 0.33).toFixed(2), "Index priced in US dollars, so currency noise lowers the slope"]);
    const unlev = s.peers.map(function (p) { const bl = 0.67 * p.beta5y + 0.33; return bl / (1 + (1 - t) * (p.debt - p.cash) / p.mcap); }).sort(function (x, y) { return x - y; });
    const med = (unlev[2] + unlev[3]) / 2;
    const de = G.netDebt / (G.referencePrice * G.sharesOut);
    rows.push(["Peers, median unlevered, relevered for Givaudan", "", (med * (1 + (1 - t) * de)).toFixed(2), "Six listed peers, 5 year weekly betas against MSCI World"]);
    rows.push(["Selected beta in the model", G.common.beta.toFixed(2), "", "Measured against the Swiss market, consistent with the Swiss rate and premium"]);
    UI.table("betaTable", [{ h: "Beta cross check", f: function (x) { return x[0]; } }, { h: "Raw", n: 1, f: function (x) { return x[1]; } }, { h: "Adjusted", n: 1, f: function (x) { return x[2]; } }, { h: "Basis", f: function (x) { return '<span class="note">' + x[3] + "</span>"; } }],
      rows, { rowClass: function (x) { return x[0].indexOf("Selected") === 0 ? "total" : ""; } });
  }

  function comps() {
    const s = P.sets.givaudan;
    const ev = function (p) { return p.mcap + p.debt - p.cash; };
    const list = s.peers.slice().sort(function (x, y) { return ev(y) / y.ebitda - ev(x) / x.ebitda; });
    const mults = s.peers.map(function (p) { return ev(p) / p.ebitda; }).sort(function (a, b) { return a - b; });
    const pes = s.peers.map(function (p) { return p.fwdPE; }).sort(function (a, b) { return a - b; });
    const med = function (v) { const n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; };
    const rows = list.map(function (p) { return { n: p.name, c: p.cur, ev: ev(p), m: ev(p) / p.ebitda, pe: p.fwdPE, g: p.revGrowth, mg: p.ebitdaMargin }; });
    rows.push({ n: "Peer median", c: "", ev: null, m: med(mults), pe: med(pes), g: null, mg: null, cls: "total" });
    const gs = s.self; rows.push({ n: "Givaudan", c: gs.cur, ev: ev(gs), m: ev(gs) / gs.ebitda, pe: gs.fwdPE, g: gs.revGrowth, mg: gs.ebitdaMargin, cls: "hl" });
    UI.table("compsTable", [{ h: "Company", f: function (x) { return x.n; } }, { h: "Currency", f: function (x) { return x.c; } }, { h: "EV (m)", n: 1, f: function (x) { return x.ev == null ? "" : UI.fmt(x.ev); } },
      { h: "EV / LTM EBITDA", n: 1, f: function (x) { return UI.mult(x.m); } }, { h: "Forward P/E", n: 1, f: function (x) { return x.pe == null ? "" : UI.mult(x.pe); } },
      { h: "Revenue growth", n: 1, f: function (x) { return x.g == null ? "" : UI.pct(x.g); } }, { h: "EBITDA margin", n: 1, f: function (x) { return x.mg == null ? "" : UI.pct(x.mg); } }],
      rows, { rowClass: function (x) { return x.cls || ""; } });
    document.getElementById("compsNote").textContent = "Snapshot of " + P.asOf + " from Yahoo Finance (EBITDA as defined by Yahoo, last twelve months). The football field applies the peer median of about " +
      Math.round(med(mults)) + "x plus and minus 2x to Givaudan's FY26E EBITDA of CHF " + UI.fmt(G.ebitdaFY26E) + "m. Givaudan trades about " + (ev(gs) / gs.ebitda - med(mults)).toFixed(0) + " turns above the median, a premium for scale, margin and growth.";
    const deals = G.precedents.map(function (d) { return { d: d.date, a: d.acquirer, t: d.target, ev: d.ev, cur: d.cur, m: d.ebitda ? d.ev / d.ebitda : d.multiple, b: d.basis }; });
    UI.table("precTable", [{ h: "Date", f: function (x) { return x.d; } }, { h: "Acquirer", f: function (x) { return x.a; } }, { h: "Target", f: function (x) { return x.t; } },
      { h: "EV (m)", n: 1, f: function (x) { return x.ev ? x.cur + " " + UI.fmt(x.ev) : "n.a."; } }, { h: "EV / EBITDA", n: 1, f: function (x) { return UI.mult(x.m); } }, { h: "Basis", f: function (x) { return x.b === "LTM" ? "Last twelve months" : "Forward, reference only"; } }], deals);
  }

  window.DCFX = { render: revenue, init: function () { history(); comps(); beta(); } };
})();
