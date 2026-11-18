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
    const rv = a.revolver || { commitment: 0, rate: 0, fee: 0 };
    let rcf = 0;
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
      const rcfInterest = rcf * rv.rate + (rv.commitment - rcf) * rv.fee;   // drawn interest plus commitment fee on the undrawn part
      const interest = interestByTranche.reduce(function (s, v) { return s + v; }, 0) + rcfInterest;
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
      // Revolver: draw to restore minimum cash, repay first when cash is available
      let rcfDraw = 0, rcfRepay = 0;
      if (available < 0) { rcfDraw = Math.min(-available, rv.commitment - rcf); rcf += rcfDraw; available += rcfDraw; }
      else { rcfRepay = Math.min(rcf, available); rcf -= rcfRepay; available -= rcfRepay; }
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
      const totalDebt = bal.reduce(function (s, v) { return s + v; }, 0) + rcf;
      rows.push({ rcf, rcfDraw, rcfRepay, rcfInterest,
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

    // Returns if the sponsor exits at the end of each year (same exit multiple)
    const byYear = rows.map(function (rw, k) {
      const ev = rw.ebitda * a.exitMultiple, gross = ev - rw.netDebt;
      const m = Math.max(0, gross - sponsorEquity) * (a.mipPct || 0), eq = gross - m;
      return { year: rw.year, n: k + 1, ev, equity: eq, moic: eq / sponsorEquity, irr: Math.pow(eq / sponsorEquity, 1 / (k + 1)) - 1 };
    });
    return {
      byYear,
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

  /* Dividend recapitalisation: at the end of year y the company raises new debt (bullet, fixed rate) to bring net debt back to
     targetLeverage x EBITDA and pays it out to the sponsor. Later years carry the after tax interest, which reduces cash
     and so increases net debt at exit; the recap debt itself is repaid from exit proceeds. */
  function recap(a, o, y, targetLeverage, rate) {
    const rw = o.rows[y - 1];
    const div = Math.max(0, targetLeverage * rw.ebitda - rw.netDebt);
    const N = o.rows.length, last = o.rows[N - 1];
    let carry = 0;
    for (let k = y; k < N; k++) carry += div * rate * (1 - a.taxRate);
    const exitEV = last.ebitda * a.exitMultiple;
    const gross = exitEV - last.netDebt - div - carry;
    const m = Math.max(0, gross + div - o.sponsorEquity) * (a.mipPct || 0);
    const exitEq = gross - m;
    const cfs = [-o.sponsorEquity]; for (let k = 1; k <= N; k++) cfs.push(k === y ? div : 0); cfs[N] += exitEq;
    return { dividend: div, exitEquity: exitEq, irr: irr(cfs), moic: (div + exitEq) / o.sponsorEquity, cash: cfs };
  }

  /* Ability to pay in closed form. Exit equity before the incentive plan (G) does not depend on the price paid, because debt is
     sized on EBITDA. Sponsor equity E must satisfy (G - m (G - E)) / E = (1 + r)^N, so E = G (1 - m) / ((1 + r)^N - m).
     Price follows from E = EV (1 + advisory fee) + financing fees + minimum cash - debt. */
  function abilityToPay(a, o, target) {
    const N = o.rows.length, G = o.exitEquityGross, m = a.mipPct || 0;
    const E = G * (1 - m) / (Math.pow(1 + target, N) - m);
    const fin = o.debt0 * a.financingFeePct;
    const ev = (E - fin - a.minCash + o.debt0) / (1 + a.advisoryFeePct);
    const priceLocal = (ev - a.existingNetDebt) / a.dilutedShares / a.fxToModel;
    return { equity: E, ev, priceLocal, premium: priceLocal / a.priceLocal - 1, evEbitda: ev / a.ebitda0 };
  }

  const api = { run, irr, sensitivity, maxPremium, clone, recap, abilityToPay };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LBO = api;
})(typeof window !== "undefined" ? window : this);
