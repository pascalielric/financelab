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
    referencePrice: 3950,
    referencePriceDate: "mid October 2026 (after Q3 sales release)",
    sharesOut: 9.22,              // million shares outstanding net of treasury shares
    netDebt: 3600,                // estimated net debt at 31 Dec 2026 (FY25A: 3,678)
    otherClaims: 151,             // pension liabilities (FY25A)
    week52Low: 2670,
    week52High: 4000,
    analystTarget: 3700,
    historicals: [
      { year: "FY24A", revenue: 7412, ebitda: 1765, da: 359, ebit: 1394, netIncome: 1090, capex: 293, fcf: 1158, eps: 118.17, dps: 70 },
      { year: "FY25A", revenue: 7472, ebitda: 1751, da: 369, ebit: 1381, netIncome: 1071, capex: 305, fcf: 1053, eps: 116.08, dps: 72 },
      { year: "FY26E", revenue: 7740, ebitda: 1827, da: 387, ebit: 1440, netIncome: null, capex: 325, fcf: null, eps: null, dps: null }
    ],
    nineMonth2026: { sales: 5891, lfl: 0.052, q3Lfl: 0.086, fragranceLfl: 0.088, tasteLfl: 0.015 },
    targets2030: "4 to 6% average like for like sales growth and above 12% average free cash flow margin (2026 to 2030)",
    base: { year: "FY26E", revenue: 7740, nwc: 7740 * 0.245 },
    years: [2027, 2028, 2029, 2030, 2031],
    scenarios: {
      bear: { label: "Bear", growth: [0.030, 0.030, 0.030, 0.030, 0.030], ebitdaMargin: [0.232, 0.232, 0.233, 0.233, 0.234], tgr: 0.0175, exitMultiple: 17 },
      base: { label: "Base", growth: [0.050, 0.050, 0.048, 0.045, 0.042], ebitdaMargin: [0.240, 0.243, 0.245, 0.247, 0.248], tgr: 0.0200, exitMultiple: 20 },
      bull: { label: "Bull", growth: [0.065, 0.062, 0.060, 0.055, 0.050], ebitdaMargin: [0.245, 0.250, 0.254, 0.257, 0.260], tgr: 0.0225, exitMultiple: 23 }
    },
    common: {
      daPct: 0.050, capexPct: 0.042, leasePct: 0.0085, nwcPct: 0.245, taxRate: 0.18,
      rf: 0.0045, beta: 0.90, erp: 0.060, kd: 0.0225, debtWeight: 0.09, sizePremium: 0, midYear: true
    },
    rationale: {
      rf: "Current Swiss 10 year Confederation bond yield, about 0.45% (9 Nov 2026). Cash flows are in CHF, so the CHF risk free rate applies",
      beta: "Five year weekly beta vs. MSCI World in the 0.8 to 1.0 range; 0.90 used",
      erp: "6.0% blended equity risk premium reflecting global earnings exposure (about 65% of sales outside Europe)",
      kd: "Pre tax cost of debt in line with Givaudan CHF and EUR bond yields plus spread",
      debtWeight: "Market value weights: net debt of CHF 3.6bn over enterprise value of about CHF 40bn, about 9%"
    },
    peers: [
      { name: "Symrise", evEbitda: "about 13 to 21x", note: "reported range across data providers, 2026" },
      { name: "DSM-Firmenich", evEbitda: "about 10 to 16x", note: "post Animal Nutrition and Health carve out" },
      { name: "IFF", evEbitda: "about 15 to 18x", note: "higher leverage, restructuring" }
    ],
    compsRange: [17, 21],          // EV / NTM EBITDA range applied (premium to peer median for Givaudan quality)
    sources: [
      ["Givaudan 2025 Full Year Results", "https://www.givaudan.com/file/1366731/download"],
      ["Givaudan 2025 Financial Summary", "https://www.givaudan.com/files/giv-2025-financial-summary.pdf"],
      ["Givaudan Q3 2026 sales (vermoegenszentrum / AWP)", "https://www.vermoegenszentrum.ch/en/stock-exchange-and-markets/news/givaudan-sales-jump-11-third-quarter-despite-recent-price-hikes"],
      ["Swiss 10 year yield (Trading Economics)", "https://tradingeconomics.com/switzerland/government-bond-yield/news/599566"]
    ]
  };
  // Market value weights, as in the Excel model: net debt / (market capitalisation + net debt)
  GIVAUDAN.common.debtWeight = GIVAUDAN.netDebt / (GIVAUDAN.referencePrice * GIVAUDAN.sharesOut + GIVAUDAN.netDebt);
  if (typeof module !== "undefined" && module.exports) module.exports = GIVAUDAN;
  else root.GIVAUDAN = GIVAUDAN;
})(typeof window !== "undefined" ? window : this);
