/* Givaudan SA (SIX: GIVN) valuation inputs. CHF millions unless stated.
   Sources: Givaudan 2025 Full Year Results and Financial Summary (29 Jan 2026), Q3 2026 sales release (13 Oct 2026),
   AWP / cash.ch market reports, Trading Economics (Swiss 10 year yield). Estimates are the author's. */
(function (root) {
  const GIVAUDAN = {
    name: "Givaudan SA",
    ticker: "GIVN",
    exchange: "SIX Swiss Exchange",
    adr: "GVDNY",
    currency: "CHF",
    referencePrice: 4078,
    referencePriceDate: "SIX close, 17 Nov 2026",
    sharesOut: 9.22,              // million shares outstanding net of treasury shares
    netDebt: 3600,                // estimated net debt at 31 Dec 2026 (FY25A: 3,678)
    otherClaims: 151,             // pension liabilities (FY25A)
    week52Low: 2606,
    week52High: 4105,
    analystTarget: 3800,
    historicals: [
      { year: "FY24A", revenue: 7412, ebitda: 1765, da: 359, ebit: 1394, netIncome: 1090, capex: 293, fcf: 1158, eps: 118.17, dps: 70 },
      { year: "FY25A", revenue: 7472, ebitda: 1751, da: 369, ebit: 1381, netIncome: 1071, capex: 305, fcf: 1053, eps: 116.08, dps: 72 },
      { year: "FY26E", revenue: 7740, ebitda: 1827, da: 387, ebit: 1440, netIncome: null, capex: 325, fcf: null, eps: null, dps: null }
    ],
    nineMonth2026: { sales: 5891, lfl: 0.052, q3Lfl: 0.086, fragranceLfl: 0.088, tasteLfl: 0.015 },
    targets2030: "4 to 6% average like for like sales growth and above 12% average free cash flow margin (2026 to 2030)",
    base: { year: "FY26E", revenue: 7740, nwc: 7740 * 0.245 },
    years: [2027, 2028, 2029, 2030, 2031],
    // Revenue build by division. Group growth for each case is derived from these (see the bottom of this file).
    divisions: {
      names: { fb: "Fragrance & Beauty", tw: "Taste & Wellbeing" },
      fy26e: { fb: 4060, tw: 3680 },   // author estimate: nine month 2026 like for like growth of 8.8% (F&B) and 1.5% (T&W), after currency
      cases: {
        bear: { fb: [0.039, 0.039, 0.039, 0.039, 0.038], tw: [0.020, 0.020, 0.020, 0.020, 0.020] },
        base: { fb: [0.064, 0.063, 0.059, 0.053, 0.048], tw: [0.035, 0.035, 0.035, 0.035, 0.035] },
        bull: { fb: [0.083, 0.077, 0.073, 0.063, 0.054], tw: [0.045, 0.045, 0.045, 0.045, 0.045] }
      }
    },
    scenarios: {
      bear: { label: "Bear", ebitdaMargin: [0.232, 0.232, 0.233, 0.233, 0.234], tgr: 0.0175, exitMultiple: 17 },
      base: { label: "Base", ebitdaMargin: [0.240, 0.243, 0.245, 0.247, 0.248], tgr: 0.0200, exitMultiple: 20 },
      bull: { label: "Bull", ebitdaMargin: [0.245, 0.250, 0.254, 0.257, 0.260], tgr: 0.0225, exitMultiple: 23 }
    },
    // Reported history, CHF m. Company figures from Givaudan full year results; D&A, capex and change in working capital from the
    // cash flow statements as published on Yahoo Finance. FY22 free cash flow CHF 479m (6.7% of sales) from the FY22 release.
    history: {
      years: ["FY22A", "FY23A", "FY24A", "FY25A"],
      salesFB: [3256, 3312, 3660, 3830], salesTW: [3861, 3603, 3752, 3642],
      lflFB: [0.055, 0.076, 0.141, 0.079], lflTW: [0.052, 0.011, 0.107, 0.024], lflGroup: [0.053, 0.041, 0.123, 0.051],
      ebitdaFB: [698, 769, 985, 985], ebitdaTW: [778, 704, 780, 766],
      da: [364, 356, 359, 369], netIncome: [856, 893, 1090, 1071], eps: [92.83, 96.81, 118.17, 116.08], dps: [67, 68, 70, 72],
      capex: [304, 275, 293, 305], fcf: [479, 920, 1158, 1053], dNwc: [267, -48, 43, -43],
      netDebt: [4530, 4305, 4002, 3678]          // total debt less cash (Yahoo Finance balance sheets); FY25 equals the reported CHF 3,678m
    },
    precedents: [
      { date: "May 2022", acquirer: "DSM", target: "Firmenich", ev: 19200, cur: "EUR", basis: "LTM",
        ebitda: 833, multiple: null, note: "EV EUR 19.2bn (Stifel, via Reuters/Euronews); Firmenich FY21 sales CHF 4.5bn at a 20% adjusted EBITDA margin = CHF 900m, EUR 833m at 1.081 CHF per EUR (2021 average)" },
      { date: "Dec 2019", acquirer: "IFF", target: "DuPont Nutrition & Biosciences", ev: 26200, cur: "USD", basis: "Forward",
        ebitda: null, multiple: 17.1, note: "EV USD 26.2bn, 17.1x 2020E EBITDA (Breakingviews / Refinitiv, Dec 2019); forward basis, shown for reference only" },
      { date: "May 2018", acquirer: "IFF", target: "Frutarom", ev: 7100, cur: "USD", basis: "LTM",
        ebitda: null, multiple: 20.3, note: "EV/LTM EBITDA 20.3x, Morgan Stanley precedent analysis in the IFF / N&B Form S-4 (SEC, 2020)" },
      { date: "Mar 2018", acquirer: "Givaudan", target: "Naturex", ev: null, cur: "EUR", basis: "LTM",
        ebitda: null, multiple: 22.8, note: "EV/LTM EBITDA 22.8x, Morgan Stanley precedent analysis in the IFF / N&B Form S-4 (SEC, 2020)" }
    ],
    common: {
      daPct: 0.050, capexPct: 0.042, leasePct: 0.0085, nwcPct: 0.245, taxRate: 0.18,
      rf: 0.0045, beta: 0.90, erp: 0.060, kd: 0.0225, debtWeight: 0.09, sizePremium: 0, midYear: true
    },
    rationale: {
      rf: "Current Swiss 10 year Confederation bond yield, about 0.45% (9 Nov 2026). Cash flows are in CHF, so the CHF risk free rate applies",
      beta: "Three year weekly beta against the Swiss Market Index of about 0.92 (regression on the Beta tab of the Excel model); 0.90 used. Six listed peers, unlevered and relevered for Givaudan's capital structure, give about 0.80; betas against a US dollar priced global index are lower because currency moves add noise",
      erp: "6.0% blended equity risk premium reflecting global earnings exposure (about 65% of sales outside Europe)",
      kd: "Pre tax cost of debt in line with Givaudan CHF and EUR bond yields plus spread",
      debtWeight: "Market value weights: net debt of CHF 3.6bn over enterprise value of about CHF 40bn, about 9%"
    },
    peers: [
      { name: "Symrise", evEbitda: "about 13 to 21x", note: "reported range across data providers, 2026" },
      { name: "DSM-Firmenich", evEbitda: "about 10 to 16x", note: "post Animal Nutrition and Health carve out" },
      { name: "IFF", evEbitda: "about 15 to 18x", note: "higher leverage, restructuring" }
    ],
    compsRange: [17, 21],          // peer median EV / LTM EBITDA (about 19x, js/data/peers.js) plus and minus 2x, applied to FY26E EBITDA
    sources: [
      ["Givaudan 2025 Full Year Results", "https://www.givaudan.com/file/1366731/download"],
      ["Givaudan 2025 Financial Summary", "https://www.givaudan.com/files/giv-2025-financial-summary.pdf"],
      ["Givaudan Q3 2026 sales (vermoegenszentrum / AWP)", "https://www.vermoegenszentrum.ch/en/stock-exchange-and-markets/news/givaudan-sales-jump-11-third-quarter-despite-recent-price-hikes"],
      ["Swiss 10 year yield (Trading Economics)", "https://tradingeconomics.com/switzerland/government-bond-yield/news/599566"]
    ]
  };
  // Group growth per case from the division build: (FB_t + TW_t) / (FB_t-1 + TW_t-1) - 1
  Object.keys(GIVAUDAN.scenarios).forEach(function (k) {
    const d = GIVAUDAN.divisions.cases[k]; let fb = GIVAUDAN.divisions.fy26e.fb, tw = GIVAUDAN.divisions.fy26e.tw; const g = [];
    for (let i = 0; i < 5; i++) { const prev = fb + tw; fb *= 1 + d.fb[i]; tw *= 1 + d.tw[i]; g.push((fb + tw) / prev - 1); }
    GIVAUDAN.scenarios[k].growth = g;
  });
  GIVAUDAN.base.revenue = GIVAUDAN.divisions.fy26e.fb + GIVAUDAN.divisions.fy26e.tw;
  // Precedent multiples paid (LTM basis only): EV / EBITDA where both are given, otherwise the published multiple
  const ltm = GIVAUDAN.precedents.filter(function (d) { return d.basis === "LTM"; })
    .map(function (d) { return d.ebitda ? d.ev / d.ebitda : d.multiple; });
  GIVAUDAN.precedentRange = [Math.min.apply(null, ltm), Math.max.apply(null, ltm)];
  GIVAUDAN.ebitdaFY26E = GIVAUDAN.historicals[2].ebitda;
  // Market value weights, as in the Excel model: net debt / (market capitalisation + net debt)
  GIVAUDAN.common.debtWeight = GIVAUDAN.netDebt / (GIVAUDAN.referencePrice * GIVAUDAN.sharesOut + GIVAUDAN.netDebt);
  if (typeof module !== "undefined" && module.exports) module.exports = GIVAUDAN;
  else root.GIVAUDAN = GIVAUDAN;
})(typeof window !== "undefined" ? window : this);
