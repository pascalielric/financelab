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
      downside: { label: "Downside", growth: [0.06, 0.06, 0.055, 0.05, 0.05], ebitdaMargin: [0.415, 0.415, 0.415, 0.415, 0.415], exitMultiple: 15 },
      base: { label: "Base", growth: [0.090, 0.090, 0.080, 0.070, 0.065], ebitdaMargin: [0.420, 0.425, 0.430, 0.435, 0.440], exitMultiple: 17 },
      upside: { label: "Upside", growth: [0.11, 0.11, 0.10, 0.09, 0.08], ebitdaMargin: [0.435, 0.450, 0.465, 0.475, 0.480], exitMultiple: 19 }
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
  if (typeof module !== "undefined" && module.exports) module.exports = TEMENOS;
  else root.TEMENOS = TEMENOS;
})(typeof window !== "undefined" ? window : this);
