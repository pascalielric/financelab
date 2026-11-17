/* LBO engine: sources and uses, operating model, debt schedule with mandatory amortisation and cash sweep,
   exit waterfall, IRR / MOIC, value creation bridge, sensitivities and max entry price for a target IRR.
   Interest is charged on opening balances (avoids circularity, standard in quick LBOs). */
(function (root) {
  "use strict";

  function irr(cfs) {
    let lo = -0.99, hi = 5;
    const npv = function (r) { return cfs.reduce(function (s, c, t) { return s + c / Math.pow(1 + r, t); }, 0); };
    if (npv(lo) * npv(hi) > 0) return NaN;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  /* a = {
       priceLocal, premium, fxToModel (model currency per 1 unit of share currency), dilutedShares,
       existingNetDebt, ebitda0, revenue0,
       years:[...], growth:[...], ebitdaMargin:[...], daPct, capexPct, nwcPctOfDeltaRev, taxRate,
       tranches:[{name, multiple, rate, amortPct, sweep:true|false}],
       advisoryFeePct (of EV), financingFeePct (of debt), minCash,
       sweepPct, exitMultiple, mipPct (management incentive share of equity gain)
     } */
  function run(a) {
    const offerLocal = a.priceLocal * (1 + a.premium);
    const offerModel = offerLocal * a.fxToModel;
    const equityPurchase = offerModel * a.dilutedShares;
    const ev0 = equityPurchase + a.existingNetDebt;
    const entryMultiple = ev0 / a.ebitda0;

    const tranches = a.tranches.map(function (t) {
      return { name: t.name, rate: t.rate, amortPct: t.amortPct || 0, sweep: !!t.sweep, amount: t.multiple * a.ebitda0, multiple: t.multiple };
    });
    const debt0 = tranches.reduce(function (s, t) { return s + t.amount; }, 0);
    const advisoryFees = ev0 * a.advisoryFeePct;
    const financingFees = debt0 * a.financingFeePct;
    const uses = [
      { item: "Purchase of equity", value: equityPurchase },
      { item: "Refinance existing net debt", value: a.existingNetDebt },
      { item: "Advisory and transaction fees", value: advisoryFees },
      { item: "Financing fees", value: financingFees },
      { item: "Cash to balance sheet", value: a.minCash }
    ];
    const totalUses = uses.reduce(function (s, u) { return s + u.value; }, 0);
    const sponsorEquity = totalUses - debt0;
    const sources = tranches.map(function (t) { return { item: t.name, value: t.amount, multiple: t.multiple }; })
      .concat([{ item: "Sponsor equity", value: sponsorEquity, multiple: sponsorEquity / a.ebitda0 }]);

    // Operating model and debt schedule
    const bal = tranches.map(function (t) { return t.amount; });
    let cash = a.minCash;
    let rev = a.revenue0;
    const rows = [];
    for (let i = 0; i < a.years.length; i++) {
      const prevRev = rev;
      rev = rev * (1 + a.growth[i]);
      const ebitda = rev * a.ebitdaMargin[i];
      const da = rev * a.daPct;
      const ebit = ebitda - da;
      const interestByTranche = tranches.map(function (t, k) { return bal[k] * t.rate; });
      const interest = interestByTranche.reduce(function (s, v) { return s + v; }, 0);
      const ebt = ebit - interest;
      const tax = Math.max(0, ebt) * a.taxRate;
      const capex = rev * a.capexPct;
      const dNwc = (rev - prevRev) * a.nwcPctOfDeltaRev;
      const fcf = ebitda - capex - dNwc - tax - interest; // levered free cash flow before debt repayment
      // Mandatory amortisation
      let available = fcf + (cash - a.minCash);
      const mand = tranches.map(function (t, k) { return Math.min(bal[k], t.amortPct * t.amount); });
      const mandTotal = mand.reduce(function (s, v) { return s + v; }, 0);
      tranches.forEach(function (t, k) { bal[k] -= mand[k]; });
      available -= mandTotal;
      // Optional cash sweep, in tranche order, only on prepayable tranches
      let sweepPool = Math.max(0, available) * a.sweepPct;
      const sweep = tranches.map(function () { return 0; });
      tranches.forEach(function (t, k) {
        if (!t.sweep || sweepPool <= 0) return;
        const pay = Math.min(bal[k], sweepPool);
        bal[k] -= pay; sweep[k] = pay; sweepPool -= pay;
      });
      const sweepTotal = sweep.reduce(function (s, v) { return s + v; }, 0);
      cash = a.minCash + available - sweepTotal;
      const totalDebt = bal.reduce(function (s, v) { return s + v; }, 0);
      rows.push({
        year: a.years[i], revenue: rev, growth: a.growth[i], ebitda, margin: a.ebitdaMargin[i], da, ebit,
        interest, interestByTranche, tax, capex, dNwc, fcf, mandatory: mand, sweep, repaid: mandTotal + sweepTotal,
        balances: bal.slice(), totalDebt, cash, netDebt: totalDebt - cash,
        leverage: (totalDebt - cash) / ebitda, coverage: ebitda / interest
      });
    }
    const last = rows[rows.length - 1];
    const exitEV = last.ebitda * a.exitMultiple;
    const exitEquityGross = exitEV - last.netDebt;
    const gain = exitEquityGross - sponsorEquity;
    const mip = Math.max(0, gain) * (a.mipPct || 0);
    const exitEquity = exitEquityGross - mip;
    const N = rows.length;
    const moic = exitEquity / sponsorEquity;
    const cfs = [-sponsorEquity];
    for (let i = 1; i < N; i++) cfs.push(0);
    cfs.push(exitEquity);
    const irrV = irr(cfs);

    const netDebt0 = debt0 - a.minCash;
    const bridge = [
      { item: "EBITDA growth", value: entryMultiple * (last.ebitda - a.ebitda0) },
      { item: "Multiple expansion", value: (a.exitMultiple - entryMultiple) * last.ebitda },
      { item: "Debt paydown and cash", value: netDebt0 - last.netDebt },
      { item: "Fees and costs", value: -(advisoryFees + financingFees) },
      { item: "Management incentive", value: -mip }
    ];

    return {
      offerLocal, offerModel, equityPurchase, ev0, entryMultiple, debt0, sponsorEquity,
      equityPct: sponsorEquity / totalUses, totalUses, sources, uses, tranches, rows,
      exitEV, exitEquity, exitEquityGross, mip, moic, irr: irrV, bridge, gain: exitEquity - sponsorEquity
    };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function sensitivity(a, rowKey, rowVals, colKey, colVals, metric) {
    return rowVals.map(function (rv) {
      return colVals.map(function (cv) {
        const b = clone(a); set(b, rowKey, rv); set(b, colKey, cv);
        const o = run(b); return metric === "moic" ? o.moic : o.irr;
      });
    });
  }

  function set(b, key, v) {
    if (key === "leverage") {
      // scale tranche multiples proportionally to reach total leverage v
      const tot = b.tranches.reduce(function (s, t) { return s + t.multiple; }, 0);
      b.tranches.forEach(function (t) { t.multiple = t.multiple * v / tot; });
    } else b[key] = v;
  }

  // Highest premium (and price) that still clears a target IRR, by bisection
  function maxPremium(a, targetIrr) {
    let lo = -0.3, hi = 1.5;
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      const b = clone(a); b.premium = mid;
      const v = run(b).irr;
      if (v >= targetIrr) lo = mid; else hi = mid;
    }
    return { premium: lo, priceLocal: a.priceLocal * (1 + lo) };
  }

  const api = { run, irr, sensitivity, maxPremium, clone };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LBO = api;
})(typeof window !== "undefined" ? window : this);
