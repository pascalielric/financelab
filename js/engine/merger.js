/* Merger model engine: accretion and dilution for an acquirer buying a listed target.

   Plain functions, no DOM. The page, the Excel model and the deck all call merge() with the same inputs,
   so every number ties out across formats.

   Conventions
   * Money in millions of the acquirer's currency (USD for Nike) unless a field says otherwise.
   * The target reports in another currency (CHF for On). fx = target currency per acquirer currency,
     so a CHF amount is converted to USD by dividing by fx.
   * Years are the acquirer's fiscal years. The target's calendar year figures are calendarised:
     a fiscal year ending in month m takes m/12 of calendar year t and (12 - m)/12 of calendar year t - 1.
*/
(function (root) {
  "use strict";

  function calendarise(byCalYear, fyEndMonth, fy) {
    // byCalYear: {2026: x, 2027: y, ...}; returns the value for the fiscal year that ends in month fyEndMonth of year fy
    var w = fyEndMonth / 12;
    var a = byCalYear[fy], b = byCalYear[fy - 1];
    if (a == null || b == null) return null;
    return w * a + (1 - w) * b;
  }

  function merge(a, o) {
    o = o || {};
    var prem = o.premium != null ? o.premium : a.deal.premium;
    var pctStock = o.pctStock != null ? o.pctStock : a.deal.pctStock;
    var synRun = o.synergies != null ? o.synergies : a.synergies.costRunRate;
    var revSyn = o.revSynergies != null ? o.revSynergies : a.synergies.revenueOn;
    var acq = a.acquirer, tgt = a.target, fx = a.fx;

    // 1. Offer
    var offer = tgt.price * (1 + prem);
    var equity = offer * tgt.shares;                       // USD m
    var tgtNetCashUsd = tgt.netCash / fx;                  // CHF m to USD m
    var ev = equity - tgtNetCashUsd - (tgt.leaseAdj ? 0 : 0);
    var premiumPaid = equity - tgt.price * tgt.shares;

    // 2. Consideration and funding
    var stockConsid = equity * pctStock;
    var cashConsid = equity - stockConsid;
    var fees = a.deal.adviserFeePct * ev;                  // expensed at close, paid in cash
    var cashUses = cashConsid + fees;
    var cashAvail = Math.max(0, acq.cash - acq.minCash);
    var cashUsed = Math.min(cashUses, cashAvail);
    var newDebt = cashUses - cashUsed;
    var finFees = newDebt * a.deal.financingFeePct;
    newDebt += finFees;                                    // fees are borrowed too
    var issuePrice = acq.price * (1 - a.deal.issueDiscount);
    var newShares = stockConsid / issuePrice;              // m shares
    var proShares = acq.shares + newShares;
    var ownTarget = newShares / proShares;

    // 3. Purchase price allocation
    var bookUsd = tgt.bookEquity / fx;
    var oldGoodwillUsd = tgt.goodwill / fx;
    var excess = equity - (bookUsd - oldGoodwillUsd);
    var brand = ev * a.ppa.brandPctEv;                     // indefinite life, not amortised
    var amortisable = ev * a.ppa.amortPctEv;               // customer relationships and technology
    var dtl = (brand + amortisable) * a.ppa.taxRate;
    var goodwill = excess - brand - amortisable + dtl;
    var amort = amortisable / a.ppa.life;

    // 4. Pro forma earnings by acquirer fiscal year
    var t = acq.taxRate;
    var years = a.years.map(function (fy, i) {
      var phase = a.synergies.phasing[i] != null ? a.synergies.phasing[i] : 1;
      var nkeNI = acq.eps[i] * acq.shares;
      var onNIchf = calendarise(tgt.netIncome, acq.fyEndMonth, fy);
      var onNI = onNIchf / fx;
      var onRevchf = calendarise(tgt.revenue, acq.fyEndMonth, fy);
      var onEbitdachf = calendarise(tgt.ebitda, acq.fyEndMonth, fy);
      var syn = synRun * phase;
      var rs = revSyn * phase * (onRevchf / fx) * a.synergies.revMargin;  // EBIT on extra revenue
      var interestNew = newDebt * a.deal.debtRate;
      var lostInterest = cashUsed * a.deal.cashRate;
      var finAmort = finFees / a.deal.financingFeeLife;
      var adj = (syn + rs - interestNew - lostInterest - amort - finAmort) * (1 - t);
      var pfNI = nkeNI + onNI + adj;
      var pfEPS = pfNI / proShares;
      var standalone = acq.eps[i];
      var accretion = pfEPS / standalone - 1;
      // pre tax synergies needed for zero accretion
      var needAdj = standalone * proShares - nkeNI - onNI;
      var breakeven = needAdj / (1 - t) - (rs - interestNew - lostInterest - amort - finAmort);
      var integration = (a.synergies.integrationCost * (a.synergies.integrationPhasing[i] || 0));
      return {
        fy: fy, nkeNI: nkeNI, onNI: onNI, onNIchf: onNIchf, onRev: onRevchf / fx, onEbitda: onEbitdachf / fx,
        synergies: syn, revSyn: rs, interestNew: interestNew, lostInterest: lostInterest, amort: amort,
        finAmort: finAmort, adjAfterTax: adj, pfNI: pfNI, pfEPS: pfEPS, standalone: standalone,
        accretion: accretion, accretionUsd: pfEPS - standalone, breakeven: breakeven,
        integration: integration, gaapEPS: (pfNI - integration * (1 - t)) / proShares
      };
    });

    // 5. Contribution analysis (first full year)
    var y0 = years[a.contributionYear || 0];
    var nkeRev = acq.revenue[a.contributionYear || 0], nkeEbitda = acq.ebitda[a.contributionYear || 0];
    var contrib = {
      revenue: y0.onRev / (y0.onRev + nkeRev),
      ebitda: y0.onEbitda / (y0.onEbitda + nkeEbitda),
      netIncome: y0.onNI / (y0.onNI + y0.nkeNI),
      equity: tgt.price * tgt.shares / (tgt.price * tgt.shares + acq.price * acq.shares),
      ownership: ownTarget,
      ownershipAllStock: (equity / issuePrice) / (acq.shares + equity / issuePrice)
    };

    // 6. Credit
    var acqNetDebt = acq.debt - acq.cash;
    var pfNetDebt = acqNetDebt + newDebt + cashUsed - tgtNetCashUsd;
    var pfEbitda = nkeEbitda + y0.onEbitda + y0.synergies;
    var credit = {
      standaloneLeverage: acqNetDebt / nkeEbitda,
      proFormaLeverage: pfNetDebt / pfEbitda,
      pfNetDebt: pfNetDebt, pfEbitda: pfEbitda
    };

    // 7. Value creation: capitalised synergies against premium and costs
    var runAfterTax = synRun * (1 - t);
    var synValue = runAfterTax / (a.valuation.wacc - a.valuation.synGrowth);
    var phaseLoss = 0;
    a.synergies.phasing.forEach(function (p, i) { phaseLoss += (1 - p) * runAfterTax / Math.pow(1 + a.valuation.wacc, i + 1); });
    synValue -= phaseLoss;
    var integrationPV = a.synergies.integrationCost * (1 - t);
    var valueCreated = synValue - integrationPV - premiumPaid - fees;
    var unaffected = tgt.price * tgt.shares;
    var maxPremValue = (synValue - integrationPV - fees) / unaffected;

    // 7b. Earnings per share bridge for each year, per pro forma share
    years.forEach(function (y) {
      var s = proShares;
      y.bridge = {
        standalone: y.standalone,
        dilution: y.nkeNI / s - y.standalone,
        target: y.onNI / s,
        synergies: (y.synergies + y.revSyn) * (1 - t) / s,
        financing: -(y.interestNew + y.lostInterest + y.finAmort) * (1 - t) / s,
        amortisation: -y.amort * (1 - t) / s,
        proForma: y.pfEPS
      };
    });

    // 8. Implied multiples
    var tgtEbitdaLtmUsd = tgt.ebitdaLtm / fx;
    var tgtNI1 = calendarise(tgt.netIncome, 12, a.peYear) / fx;
    return {
      offer: offer, equity: equity, ev: ev, premiumPaid: premiumPaid, premium: prem, pctStock: pctStock,
      stockConsid: stockConsid, cashConsid: cashConsid, fees: fees, cashUsed: cashUsed, newDebt: newDebt,
      finFees: finFees, issuePrice: issuePrice, newShares: newShares, proShares: proShares, ownTarget: ownTarget,
      exchangeRatio: offer * pctStock / issuePrice, cashPerShare: offer * (1 - pctStock),
      ppa: { bookUsd: bookUsd, oldGoodwill: oldGoodwillUsd, excess: excess, brand: brand, amortisable: amortisable,
             dtl: dtl, goodwill: goodwill, amort: amort },
      years: years, contrib: contrib, credit: credit,
      value: { synValue: synValue, integration: integrationPV, premiumPaid: premiumPaid, fees: fees, created: valueCreated, maxPremium: maxPremValue, unaffected: unaffected },
      multiples: { evEbitdaLtm: ev / tgtEbitdaLtmUsd, evSalesLtm: ev / (tgt.revenueLtm / fx), pe: equity / tgtNI1,
                   acqPe: acq.price / acq.eps[a.contributionYear || 0] },
      synergies: synRun
    };
  }

  // Accretion grid: rows and columns are overrides, f picks the number from a merge() result
  function grid(a, rowKey, rows, colKey, cols, f) {
    return rows.map(function (rv) {
      return cols.map(function (cv) {
        var o = {}; o[rowKey] = rv; o[colKey] = cv;
        return f(merge(a, o));
      });
    });
  }

  // Highest premium at which year i is still accretive (bisection)
  function maxPremium(a, o, i) {
    var lo = -0.5, hi = 3;
    function acc(p) { var x = Object.assign({}, o || {}, { premium: p }); return merge(a, x).years[i].accretion; }
    if (acc(lo) < 0) return null;
    if (acc(hi) >= 0) return hi;
    for (var k = 0; k < 60; k++) { var m = (lo + hi) / 2; if (acc(m) >= 0) lo = m; else hi = m; }
    return lo;
  }

  var api = { merge: merge, grid: grid, maxPremium: maxPremium, calendarise: calendarise };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MergerEngine = api;
})(typeof window !== "undefined" ? window : this);
