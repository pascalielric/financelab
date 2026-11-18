/* Temenos AG (SIX: TEMN) take private LBO inputs. USD millions (reporting currency); offer price in CHF.
   Sources: Temenos FY25 results and Q4-25 presentation (24 Feb 2026), Q3-26 results (27 Oct 2026),
   2025 Annual Report, Bloomberg / Reuters / Mergermarket reporting on past sponsor interest. Estimates are the author's. */
(function (root) {
  const TEMENOS = {
    name: "Temenos AG",
    codeName: "Project Lancy",
    ticker: "TEMN",
    exchange: "SIX Swiss Exchange",
    currency: "USD",
    priceCurrency: "CHF",
    unaffectedPrice: 78.85,           // SIX close on 17 Nov 2026
    unaffectedDate: "17 Nov 2026",
    usdChf: 0.8334,                   // CHF per USD
    dilutedShares: 69.0,              // million, after 2025/26 buybacks (FY25 weighted diluted: 70.2m)
    netDebt2026E: 520,                // estimated 31 Dec 2026 (FY25A reported: 566)
    historicals: [
      { year: "FY24PF", revenue: 965.2, ebit: 304.8, ebitda: null, fcf: 223.2, arr: 749.5, margin: 0.316 },
      { year: "FY25PF", revenue: 1071.1, ebit: 371.9, ebitda: 451.3, fcf: 256.4, arr: 859.9, margin: 0.347 },
      { year: "FY26E", revenue: 1180, ebit: 417, ebitda: 497, fcf: 297, arr: 963, margin: 0.353 }
    ],
    q3_2026: { arr: 903.6, arrGrowthCc: 0.12, revenue: 292.8, ebit: 109.3, ebitMargin: 0.373, fcf: 36.4 },
    fy28Targets: { arr: 1230, ebit: 480, fcf: 410 },
    revenueMix2025: { "Subscription and SaaS": 452.5, "Maintenance": 490.3, "Services": 128.3 },
    model: {
      revenue0: 1180, ebitda0: 497,
      years: [2027, 2028, 2029, 2030, 2031],
      growth: [0.090, 0.090, 0.080, 0.070, 0.065],
      ebitdaMargin: [0.420, 0.425, 0.430, 0.435, 0.440],
      daPct: 0.068, capexPct: 0.065, nwcPctOfDeltaRev: 0.10, taxRate: 0.20,
      advisoryFeePct: 0.015, financingFeePct: 0.025, minCash: 100,
      sweepPct: 1.0, exitMultiple: 17.0, mipPct: 0.08,
      premium: 0.25,
      tranches: [
        { name: "Term Loan B (SOFR + 325bp)", multiple: 4.5, rate: 0.0725, amortPct: 0.01, sweep: true },
        { name: "Senior Secured Notes (8.25%)", multiple: 1.5, rate: 0.0825, amortPct: 0, sweep: false }
      ]
    },
    cases: {
      downside: { label: "Downside", ebitdaMargin: [0.415, 0.415, 0.415, 0.415, 0.415], exitMultiple: 15 },
      base: { label: "Base", ebitdaMargin: [0.420, 0.425, 0.430, 0.435, 0.440], exitMultiple: 17 },
      upside: { label: "Upside", ebitdaMargin: [0.435, 0.450, 0.465, 0.475, 0.480], exitMultiple: 19 }
    },
    // Revenue build by line (non IFRS, USD m). Total growth for each case is derived from these (bottom of this file).
    lines: {
      names: { subs: "Subscription and SaaS", maint: "Maintenance", serv: "Services" },
      fy24pf: { subs: 411.4, maint: 430.1, serv: 123.7 },   // derived from FY25 values and reported growth of 10% and 14%
      fy25pf: { subs: 452.5, maint: 490.3, serv: 128.3 },   // Temenos 2025 Annual Report, proforma excluding Multifonds
      fy26e: { subs: 495, maint: 550, serv: 135 },          // author estimate: FY26 guidance subscription and SaaS c.9% (after a 5 point BNPL headwind)
      cases: {
        downside: { subs: [0.093, 0.091, 0.078, 0.066, 0.065], maint: [0.045, 0.045, 0.045, 0.045, 0.045], serv: [0, 0, 0, 0, 0] },
        base: { subs: [0.134, 0.131, 0.106, 0.083, 0.072], maint: [0.065, 0.065, 0.065, 0.065, 0.065], serv: [0.03, 0.03, 0.03, 0.03, 0.03] },
        upside: { subs: [0.162, 0.158, 0.132, 0.109, 0.088], maint: [0.08, 0.08, 0.08, 0.08, 0.08], serv: [0.04, 0.04, 0.04, 0.04, 0.04] }
      }
    },
    arr: { fy24: 749.5, fy25: 859.9, q3_26: 903.6, fy26e: 963, churn: 0.04 },
    // Reported IFRS history (USD m) from the Yahoo Finance statements; non IFRS proforma figures from the company above
    history: {
      years: ["FY22A", "FY23A", "FY24A", "FY25A"],
      revenue: [949.6, 1000.2, 1044.1, 1090.8], ebitda: [309.5, 330.4, 362.3, 480.9], ebit: [167.8, 198.2, 229.8, 350.7],
      netIncome: [114.4, 134.7, 177.2, 280.6], ocf: [297.9, 331.0, 363.4, 353.8], capex: [105.0, 88.6, 78.5, 73.1],
      cash: [89.9, 106.9, 114.2, 203.5], debt: [840.8, 764.7, 726.7, 808.9], equity: [578.4, 682.0, 639.0, 478.0],
      buybacks: [0, 0, 226.8, 320.4], dividends: [74.4, 88.3, 96.9, 110.5]
    },
    structure: {
      revolver: { commitment: 150, rate: 0.0700, fee: 0.0035 },          // undrawn at close
      openingNwc: 50, openingFixedAssets: 300,                            // author estimates from the FY25 balance sheet
      ppa: { intangiblePctEv: 0.25, life: 10 }, feeLife: 7,
      covenants: { netLeverage: [7.0, 6.5, 6.0, 5.5, 5.0], interestCover: [2.0, 2.0, 2.25, 2.5, 2.5] },
      recap: { year: 3, targetLeverage: 5.0, rate: 0.080 },
      rollover: 25
    },
    precedents: [
      { deal: "Finastra (Vista sale process, reported)", year: 2025, multiple: "about 18x EBITDA (reported ask)" },
      { deal: "Avaloq / NEC", year: 2020, multiple: "CHF 2.05bn EV" },
      { deal: "Temenos / EQT approach (failed on price)", year: 2022, multiple: "about 50% premium reported" }
    ],
    sources: [
      ["Temenos FY25 results press release", "https://www.temenos.com/press_release/temenos-announces-q4-2025-results-22tw4tk10/"],
      ["Temenos Q4-25 results presentation", "https://www.temenos.com/wp-content/uploads/2026/02/temenos-q4-2025-results-presentation-22tw4tk10.pdf"],
      ["Temenos Q3-26 results (securities.io)", "https://www.securities.io/temenos-lifts-fy-26-ebit-and-eps-guidance-as-q3-arr-rises-12/"],
      ["Nordic Capital pursues Temenos (Bloomberg, 2023)", "https://www.bloomberg.com/news/articles/2023-06-09/nordic-capital-is-said-to-pursue-temenos-as-other-suitors-drop"],
      ["Finastra valuation (Reuters via Euronext)", "https://live.euronext.com/en/financial-news/exclusive-vista-equity-exploring-strategic-options-financial-software-provider"]
    ]
  };
  // Total revenue growth per case from the line build
  Object.keys(TEMENOS.cases).forEach(function (k) {
    const c = TEMENOS.lines.cases[k], v = Object.assign({}, TEMENOS.lines.fy26e), g = [];
    for (let i = 0; i < 5; i++) {
      const prev = v.subs + v.maint + v.serv;
      v.subs *= 1 + c.subs[i]; v.maint *= 1 + c.maint[i]; v.serv *= 1 + c.serv[i];
      g.push((v.subs + v.maint + v.serv) / prev - 1);
    }
    TEMENOS.cases[k].growth = g;
  });
  TEMENOS.model.growth = TEMENOS.cases.base.growth.slice();
  TEMENOS.model.revolver = TEMENOS.structure.revolver;
  TEMENOS.model.revenue0 = TEMENOS.lines.fy26e.subs + TEMENOS.lines.fy26e.maint + TEMENOS.lines.fy26e.serv;
  if (typeof module !== "undefined" && module.exports) module.exports = TEMENOS;
  else root.TEMENOS = TEMENOS;
})(typeof window !== "undefined" ? window : this);
