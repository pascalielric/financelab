/* Nike acquires On: hypothetical merger inputs. USD millions unless noted; On reports in CHF millions.
   Sources: Nike FY26 10-K data and Q1 FY27 results (1 Oct 2026); On Q3 2026 results (10 Nov 2026) and 2025 annual report (20-F);
   consensus earnings per share and prices from Yahoo Finance (snapshot 19 Nov 2026); precedent deal terms from company releases
   and press reports. Forecasts beyond the consensus horizon are the author's extrapolation and are marked as such. */
(function (root) {
  const NIKEON = {
    codeName: "Project Swoosh Cloud",
    asOf: "18 Nov 2026",
    fx: 0.8427,                          // CHF per USD, 19 Nov 2026 (Yahoo Finance USDCHF=X)
    years: [2028, 2029, 2030],           // Nike fiscal years (June to May); FY28 is the first full year after an assumed close in spring 2027
    contributionYear: 0,
    peYear: 2027,
    acquirer: {
      name: "Nike", ticker: "NKE", exchange: "NYSE", fyEndMonth: 5,
      price: 36.31,                      // NYSE close 18 Nov 2026
      shares: 1485.3,                    // m, Class A and Class B (Yahoo implied shares outstanding)
      cash: 8368,                        // cash and short term investments, 31 Aug 2026
      debt: 8034,                        // financial debt (total debt of 11,125 less lease liabilities of about 3,091)
      leases: 3091,
      minCash: 4000,                     // cash Nike keeps for operations
      taxRate: 0.24,                     // guidance: mid 20 percent range for FY27
      epsFY28: 1.3905,                   // FY28E consensus, 39 analysts (Yahoo Finance)
      epsGrowth: [0.15, 0.12],           // FY29E and FY30E: author extrapolation of the turnaround
      epsSource: ["Consensus", "Extrapolated", "Extrapolated"],
      epsFY27: 1.2573,                   // consensus FY27E, 36 analysts
      revenueFY27: 42773,                // consensus FY27E
      revGrowth: [0.04, 0.05, 0.05],     // FY28E to FY30E, author assumption
      da: 800,                           // depreciation and amortisation, about FY26 level (797)
      ebitdaLtm: 4559, revenueLtm: 45891,
      dividend: 1.64, target: 36.70, hi52: 69.14, lo52: 31.97,
      ratings: { buy: 10, hold: 25, sell: 9 }
    },
    target: {
      name: "On Holding", ticker: "ONON", exchange: "NYSE", reportingCurrency: "CHF",
      price: 32.43,                      // NYSE close 18 Nov 2026, USD
      shares: 334.5,                     // m Class A equivalents: 10 Class B voting shares = 1 Class A share economically
      netCash: 1339,                     // CHF m, cash 30 Sep 2026; On has no financial debt (lease liabilities of 733 excluded)
      leases: 733,
      bookEquity: 2004,                  // CHF m: 1,632 at 31 Dec 2025 plus 371 of net income in the first nine months of 2026
      goodwill: 2,
      // calendar years, CHF m; consensus for 2026 and 2027, author extrapolation after
      eps2026: 1.5013, eps2027: 1.7036,  // adjusted, 24 analysts each (Yahoo Finance)
      epsGrowth: { 2028: 0.15, 2029: 0.13, 2030: 0.11 },
      revenue2026: 3515,                 // consensus, 31 analysts; guidance CHF 3.47bn to 3.56bn
      revGrowth: { 2027: 0.17, 2028: 0.15, 2029: 0.13, 2030: 0.11 },
      taxRate: 0.21, daPct: 0.05,        // to estimate EBITDA from net income
      epsSource: { 2026: "Consensus", 2027: "Consensus", 2028: "Extrapolated", 2029: "Extrapolated", 2030: "Extrapolated" },
      revenueLtm: 3357, ebitdaLtm: 693,  // CHF m, Q4 2025 to Q3 2026, adjusted; includes CHF 53m of US tariff refunds in Q3 2026
      target: 43.71, hi52: 51.08, lo52: 26.37,
      ratings: { buy: 26, hold: 5, sell: 1 },
      classA: 296.9, classB: 341.2       // m shares at 31 Dec 2025 (20-F); founders hold the Class B voting rights shares
    },
    deal: {
      premium: 0.35, pctStock: 0.50,
      adviserFeePct: 0.01, financingFeePct: 0.01, financingFeeLife: 7, issueDiscount: 0,
      debtRate: 0.0563,                  // 5 year Treasury 4.88% plus 75bp for an A rated issuer
      cashRate: 0.0415                   // 13 week Treasury bill, interest Nike gives up on cash used
    },
    synergies: {
      costRunRate: 250,                  // USD m pre tax: about 4.5% of On's FY29 revenue
      phasing: [0.25, 0.75, 1.0],
      revenueOn: 0, revMargin: 0.20,     // revenue synergies off by default; the slider adds extra On revenue in Asia through Nike's network
      integrationCost: 250, integrationPhasing: [0.6, 0.4, 0],
      build: [
        { item: "Sourcing: shared footwear factories in Vietnam and Indonesia, materials buying", value: 120 },
        { item: "Logistics and distribution centres", value: 60 },
        { item: "Wholesale account management and trade terms", value: 30 },
        { item: "Listed company costs, technology and back office", value: 40 }
      ]
    },
    ppa: { brandPctEv: 0.35, amortPctEv: 0.10, life: 10, taxRate: 0.20 },
    valuation: { wacc: 0.085, synGrowth: 0.02 },
    precedents: [
      { date: "Jan 2026", acquirer: "Anta Sports", target: "Puma (29% stake)", value: "EUR 1.5bn for the stake", premium: 0.62, note: "Minority stake from the Pinault family; Anta ruled out a full takeover" },
      { date: "May 2025", acquirer: "3G Capital", target: "Skechers", value: "USD 9.7bn equity, 11.4bn enterprise value", premium: 0.28, note: "Take private; family kept control" },
      { date: "Mar 2019", acquirer: "Anta Sports consortium", target: "Amer Sports", value: "EUR 4.6bn", premium: null, note: "Arc'teryx, Salomon, Wilson; relisted in New York in 2024" },
      { date: "Aug 2005", acquirer: "Adidas", target: "Reebok", value: "USD 3.8bn", premium: 0.342, note: "All cash at USD 59; Adidas said accretive in the first full year" },
      { date: "Jul 2003", acquirer: "Nike", target: "Converse", value: "USD 305m", premium: null, note: "Private; Converse kept as a separate brand" }
    ],
    comps: {"asOf": "2026-11-19", "fx": 0.8427, "rows": [{"sym": "NKE", "name": "Nike", "cur": "USD", "mcap": 53931.6, "ev": 56688.6, "ebitda": 4893.0, "revenue": 45891.0, "evEbitda": 11.6, "evSales": 1.24, "fwdPE": 26.1, "growth": -0.043, "margin": 0.10662, "price": 36.31, "hi52": 69.14, "lo52": 31.97}, {"sym": "ONON", "name": "On Holding", "cur": "USD", "mcap": 10848.6, "ev": 10129.0, "ebitda": 689.6, "revenue": 3984.1, "evEbitda": 14.7, "evSales": 2.54, "fwdPE": 15.7, "growth": 0.172, "margin": 0.17308001, "price": 32.43, "hi52": 51.08, "lo52": 26.365}, {"sym": "DECK", "name": "Deckers (Hoka, UGG)", "cur": "USD", "mcap": 11158.9, "ev": 10488.7, "ebitda": 1388.4, "revenue": 5577.0, "evEbitda": 7.6, "evSales": 1.88, "fwdPE": 10.2, "growth": 0.035, "margin": 0.24896, "price": 83.6, "hi52": 122.29, "lo52": 77.2}, {"sym": "ADS.DE", "name": "Adidas", "cur": "EUR", "mcap": 29526.8, "ev": 33859.8, "ebitda": 2958.0, "revenue": 26663.0, "evEbitda": 11.4, "evSales": 1.27, "fwdPE": 14.9, "growth": 0.094, "margin": 0.11094, "price": 174.65, "hi52": 188.8, "lo52": 129.95}, {"sym": "AS", "name": "Amer Sports", "cur": "USD", "mcap": 18007.4, "ev": 18452.0, "ebitda": 1315.6, "revenue": 7848.4, "evEbitda": 14.0, "evSales": 2.35, "fwdPE": 19.0, "growth": 0.235, "margin": 0.16763, "price": 30.95, "hi52": 42.76, "lo52": 26.1}, {"sym": "LULU", "name": "Lululemon", "cur": "USD", "mcap": 12831.2, "ev": 13582.6, "ebitda": 2383.9, "revenue": 11094.0, "evEbitda": 5.7, "evSales": 1.22, "fwdPE": 12.9, "growth": -0.043, "margin": 0.21489, "price": 110.78, "hi52": 225.98, "lo52": 90.38}, {"sym": "7936.T", "name": "Asics", "cur": "JPY", "mcap": 3023295.2, "ev": 2971479.2, "ebitda": 222808.0, "revenue": 991015.0, "evEbitda": 13.3, "evSales": 3.0, "fwdPE": 42.5, "growth": 0.218, "margin": 0.22483, "price": 4290.0, "hi52": 5440.0, "lo52": 3505.0}, {"sym": "PUM.DE", "name": "Puma", "cur": "EUR", "mcap": 3727.3, "ev": 5985.9, "ebitda": -23.1, "revenue": 6895.6, "evEbitda": null, "evSales": 0.87, "fwdPE": null, "growth": -0.05, "margin": -0.00336, "price": 25.32, "hi52": 30.31, "lo52": 15.35}]}
  };
  // Derived series: every forecast below is computed from the inputs above, exactly as on the Nike and On tabs of the Excel model
  (function () {
    const q = NIKEON.acquirer, t = NIKEON.target;
    q.eps = [q.epsFY28, q.epsFY28 * (1 + q.epsGrowth[0]), q.epsFY28 * (1 + q.epsGrowth[0]) * (1 + q.epsGrowth[1])];
    let r = q.revenueFY27; q.revenue = q.revGrowth.map(function (g) { r = r * (1 + g); return r; });
    q.ebitda = q.eps.map(function (e) { return e * q.shares / (1 - q.taxRate) + q.da; });
    t.eps = { 2026: t.eps2026, 2027: t.eps2027 }; t.revenue = { 2026: t.revenue2026 };
    for (let y = 2027; y <= 2030; y++) {
      if (y > 2027) t.eps[y] = t.eps[y - 1] * (1 + t.epsGrowth[y]);
      t.revenue[y] = t.revenue[y - 1] * (1 + t.revGrowth[y]);
    }
    t.netIncome = {}; t.ebitda = {};
    Object.keys(t.eps).forEach(function (y) {
      t.netIncome[y] = t.eps[y] * t.shares;
      t.ebitda[y] = t.netIncome[y] / (1 - t.taxRate) + t.daPct * t.revenue[y];
    });
    NIKEON.synergies.costRunRate = NIKEON.synergies.build.reduce(function (s, b) { return s + b.value; }, 0);
  })();
  if (typeof module !== "undefined" && module.exports) module.exports = NIKEON;
  else root.NIKEON = NIKEON;
})(typeof window !== "undefined" ? window : this);
