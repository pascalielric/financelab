/* DCF engine: unlevered free cash flow, WACC via CAPM, Gordon growth and exit multiple terminal values.
   Pure functions, usable in the browser (window.DCF) and in Node (module.exports). */
(function (root) {
  "use strict";

  function wacc(a) {
    // Cost of equity (CAPM) and after tax cost of debt, weighted by target capital structure
    const ke = a.rf + a.beta * a.erp + (a.sizePremium || 0);
    const kdAfterTax = a.kd * (1 - a.taxRate);
    const wd = a.debtWeight;
    const we = 1 - wd;
    return { ke, kdAfterTax, we, wd, wacc: we * ke + wd * kdAfterTax };
  }

  /* a = {
       base: { year, revenue, nwc },            last actual or estimate year before the forecast window
       years: [2027, ...],
       growth: [...], ebitdaMargin: [...],       one entry per forecast year
       daPct, capexPct, leasePct, nwcPct, taxRate,
       rf, beta, erp, kd, debtWeight, sizePremium,
       tgr, exitMultiple, midYear (bool),
       netDebt, otherClaims, sharesOut, price, waccOverride
     } */
  function run(a) {
    const w = wacc(a);
    const r = a.waccOverride != null ? a.waccOverride : w.wacc;
    const rows = [];
    let rev = a.base.revenue;
    let nwcPrev = a.base.nwc != null ? a.base.nwc : a.base.revenue * a.nwcPct;
    let pvSum = 0;
    for (let i = 0; i < a.years.length; i++) {
      rev = rev * (1 + a.growth[i]);
      const ebitda = rev * a.ebitdaMargin[i];
      const da = rev * a.daPct;
      const ebit = ebitda - da;
      const tax = ebit * a.taxRate;
      const nopat = ebit - tax;
      const capex = rev * a.capexPct;
      const lease = rev * (a.leasePct || 0);
      const nwc = rev * a.nwcPct;
      const dNwc = nwc - nwcPrev;
      nwcPrev = nwc;
      const ufcf = nopat + da - capex - lease - dNwc;
      const t = a.midYear ? i + 0.5 : i + 1;
      const df = 1 / Math.pow(1 + r, t);
      const pv = ufcf * df;
      pvSum += pv;
      rows.push({ year: a.years[i], revenue: rev, growth: a.growth[i], ebitda, margin: a.ebitdaMargin[i], da, ebit, tax, nopat, capex, lease, nwc, dNwc, ufcf, t, df, pv });
    }
    const last = rows[rows.length - 1];
    const N = rows.length;
    // Terminal values discounted from end of year N (exit) and consistent with the mid year convention for Gordon
    const fcfNext = last.ufcf * (1 + a.tgr);
    const tvGordon = r > a.tgr ? fcfNext / (r - a.tgr) : NaN;
    const dfTV = 1 / Math.pow(1 + r, a.midYear ? N - 0.5 : N);
    const dfTVexit = 1 / Math.pow(1 + r, N);
    const pvTvGordon = tvGordon * dfTV;
    const tvExit = last.ebitda * a.exitMultiple;
    const pvTvExit = tvExit * dfTVexit;

    function bridge(pvTv) {
      const ev = pvSum + pvTv;
      const equity = ev - a.netDebt - (a.otherClaims || 0);
      const perShare = equity / a.sharesOut;
      return { ev, equity, perShare, upside: a.price ? perShare / a.price - 1 : null, tvShare: pvTv / ev };
    }
    const g = bridge(pvTvGordon);
    const x = bridge(pvTvExit);
    return {
      wacc: w, r, rows, pvSum,
      gordon: Object.assign({ tv: tvGordon, pvTv: pvTvGordon, impliedExitMultiple: tvGordon / last.ebitda }, g),
      exit: Object.assign({ tv: tvExit, pvTv: pvTvExit, impliedGrowth: (tvExit * r - last.ufcf) / (tvExit + last.ufcf) }, x),
      blended: { perShare: (g.perShare + x.perShare) / 2, upside: a.price ? (g.perShare + x.perShare) / 2 / a.price - 1 : null }
    };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Sensitivity grid of value per share: rows vary WACC, columns vary TGR (or exit multiple)
  function sensitivity(a, waccs, others, mode) {
    return waccs.map(function (wv) {
      return others.map(function (ov) {
        const b = clone(a);
        b.waccOverride = wv;
        if (mode === "exit") { b.exitMultiple = ov; return run(b).exit.perShare; }
        b.tgr = ov; return run(b).gordon.perShare;
      });
    });
  }

  const api = { wacc, run, sensitivity, clone };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DCF = api;
})(typeof window !== "undefined" ? window : this);
