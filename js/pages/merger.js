/* Merger page controller: Nike acquires On */
(function () {
  "use strict";
  const A = window.NIKEON, E = window.MergerEngine;
  const state = {};
  const pt = function (v) { return (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%"; };
  const usd = function (v, d) { return "USD " + v.toFixed(d == null ? 2 : d); };
  const fy = function (y) { return "FY" + String(y).slice(2); };
  const CTRL = [
    { k: "premium", label: "Premium", tip: "Premium to On's last close", min: 0, max: 0.8, step: 0.01, f: function (v) { return UI.pct(v, 0) + " · " + (A.target.price * (1 + v)).toFixed(2); } },
    { k: "pctStock", label: "Paid in shares", tip: "Share of the price paid in new Nike shares; the rest is cash and new debt", min: 0, max: 1, step: 0.05, f: function (v) { return UI.pct(v, 0); } },
    { k: "synergies", label: "Cost synergies", tip: "Run rate pre tax cost savings, USD m a year", min: 0, max: 600, step: 10, f: function (v) { return "USD " + v + "m"; } },
    { k: "revSynergies", label: "Revenue synergy", tip: "Extra On revenue from Nike's distribution in Asia, as a share of On's revenue, at a 20% EBIT margin", min: 0, max: 0.15, step: 0.01, f: function (v) { return v === 0 ? "off" : "+" + UI.pct(v, 0) + " On sales"; } },
    { k: "debtRate", label: "Debt cost", tip: "Interest rate on the acquisition bonds", min: 0.04, max: 0.08, step: 0.0025, f: function (v) { return UI.pct(v, 2); } }
  ];
  function defaults() {
    state.premium = A.deal.premium; state.pctStock = A.deal.pctStock; state.synergies = A.synergies.costRunRate;
    state.revSynergies = A.synergies.revenueOn; state.debtRate = A.deal.debtRate;
  }
  function inputs() {
    const a = JSON.parse(JSON.stringify(A));
    a.deal.debtRate = state.debtRate;
    return a;
  }
  function opts() { return { premium: state.premium, pctStock: state.pctStock, synergies: state.synergies, revSynergies: state.revSynergies }; }

  function buildControls() {
    document.getElementById("controls").innerHTML = CTRL.map(function (c) {
      return '<div class="ctl" title="' + c.tip + '"><label><span>' + c.label + '</span><output id="o_' + c.k + '"></output></label><input type="range" id="c_' + c.k + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '"></div>';
    }).join("");
    CTRL.forEach(function (c) { document.getElementById("c_" + c.k).oninput = function (e) { state[c.k] = +e.target.value; render(); }; });
    document.getElementById("reset").onclick = function () { defaults(); sync(); render(); };
  }
  function sync() { CTRL.forEach(function (c) { document.getElementById("c_" + c.k).value = state[c.k]; }); }

  function render() {
    CTRL.forEach(function (c) { document.getElementById("o_" + c.k).textContent = c.f(state[c.k]); });
    const a = inputs(), r = E.merge(a, opts()), Y = r.years, y1 = Y[0], y2 = Y[1];
    const accCls = function (v) { return v >= 0 ? "pos" : "neg"; };

    // KPIs
    document.getElementById("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">' + fy(y2.fy) + ' EPS accretion</div><div class="value">' + pt(y2.accretion) + '</div><div class="sub">' + fy(y1.fy) + " " + pt(y1.accretion) + " · " + fy(Y[2].fy) + " " + pt(Y[2].accretion) + "</div></div>" +
      '<div class="kpi"><div class="label">Offer price</div><div class="value">' + usd(r.offer) + '</div><div class="sub">' + UI.pct(r.premium, 0) + " premium to " + usd(A.target.price) + "</div></div>" +
      '<div class="kpi"><div class="label">Equity value</div><div class="value">' + UI.fmt(r.equity / 1000, 1) + ' bn</div><div class="sub">Enterprise value ' + UI.fmt(r.ev / 1000, 1) + " bn</div></div>" +
      '<div class="kpi"><div class="label">EV / LTM EBITDA</div><div class="value">' + UI.mult(r.multiples.evEbitdaLtm) + '</div><div class="sub">P/E ' + UI.mult(r.multiples.pe) + " on 2027E, Nike " + UI.mult(r.multiples.acqPe) + "</div></div>" +
      '<div class="kpi"><div class="label">Value created</div><div class="value ' + accCls(r.value.created) + '">' + UI.fmt(r.value.created / 1000, 1) + ' bn</div><div class="sub">Synergy value less premium and costs</div></div>';

    // Profiles
    const t = A.target, q = A.acquirer, fx = A.fx;
    const onMcap = t.price * t.shares, nkMcap = q.price * q.shares;
    UI.table("profileTable", [{ h: "", f: function (x) { return x[0]; } }, { h: "Nike", n: 1, f: function (x) { return x[1]; } }, { h: "On", n: 1, f: function (x) { return x[2]; } }], [
      ["Share price (USD), 18 Nov 2026", q.price.toFixed(2), t.price.toFixed(2)],
      ["52 week range (USD)", q.lo52.toFixed(2) + " to " + q.hi52.toFixed(2), t.lo52.toFixed(2) + " to " + t.hi52.toFixed(2)],
      ["Market value (USD m)", UI.fmt(nkMcap), UI.fmt(onMcap)],
      ["Net cash (USD m, excluding leases)", UI.fmt(q.cash - q.debt), UI.fmt(t.netCash / fx)],
      ["Revenue, last twelve months (USD m)", UI.fmt(q.revenueLtm), UI.fmt(t.revenueLtm / fx)],
      ["Revenue growth, next year", UI.pct(q.revenue[0] / q.revenueFY27 - 1), UI.pct(t.revenue[2027] / t.revenue[2026] - 1)],
      ["EBITDA, last twelve months (USD m)", UI.fmt(q.ebitdaLtm), UI.fmt(t.ebitdaLtm / fx)],
      ["EBITDA margin", UI.pct(q.ebitdaLtm / q.revenueLtm), UI.pct(t.ebitdaLtm / t.revenueLtm)],
      ["P/E, next fiscal year", UI.mult(q.price / q.eps[0]) + " (FY28E)", UI.mult(t.price * fx / t.eps[2027]) + " (2027E)"],
      ["Analyst ratings: buy / hold / sell", q.ratings.buy + " / " + q.ratings.hold + " / " + q.ratings.sell, t.ratings.buy + " / " + t.ratings.hold + " / " + t.ratings.sell],
      ["Mean analyst target (USD)", q.target.toFixed(2), t.target.toFixed(2)]
    ]);
    document.getElementById("profileNote").innerHTML = "On has about a fifth of Nike's market value but trades on a lower P/E: Nike's earnings are depressed by the turnaround, which makes its shares an expensive, and therefore powerful, acquisition currency. Nike's last twelve months include about USD 1.0bn of expected tariff refunds; On's include CHF 53m.";

    // Football field
    const cm = A.comps.rows.filter(function (c) { return c.sym !== "ONON" && c.sym !== "NKE" && c.evEbitda; });
    const ev = cm.map(function (c) { return c.evEbitda; }).sort(function (x, y) { return x - y; });
    const pe = A.comps.rows.filter(function (c) { return c.sym !== "ONON" && c.sym !== "NKE" && c.fwdPE && c.fwdPE < 30; }).map(function (c) { return c.fwdPE; }).sort(function (x, y) { return x - y; });
    const q25 = function (arr, p) { return UI.quantile(arr, p); };
    const perShareFromEv = function (m) { return (m * t.ebitdaLtm / fx + t.netCash / fx) / t.shares; };
    const perShareFromPe = function (m) { return m * t.eps[2027] / fx; };
    const bars = [
      ["52 week trading range", t.lo52, t.hi52],
      ["Analyst price targets, low to high", 19.61, 64.22],
      ["Trading comparables, EV / LTM EBITDA " + UI.mult(q25(ev, 0.25)) + " to " + UI.mult(q25(ev, 0.75)), perShareFromEv(q25(ev, 0.25)), perShareFromEv(q25(ev, 0.75))],
      ["Trading comparables, P/E 2027E " + UI.mult(q25(pe, 0.25)) + " to " + UI.mult(q25(pe, 0.75)), perShareFromPe(q25(pe, 0.25)), perShareFromPe(q25(pe, 0.75))],
      ["Precedent premiums, 28% to 62%", t.price * 1.28, t.price * 1.62],
      ["Standalone value plus synergies (100% to Nike)", t.price, t.price + (r.value.synValue - r.value.integration) / t.shares]
    ];
    UI.plot("chField", [
      { type: "bar", orientation: "h", y: bars.map(function (b) { return b[0]; }), x: bars.map(function (b) { return b[2] - b[1]; }), base: bars.map(function (b) { return b[1]; }),
        marker: { color: "#8C877C" }, text: bars.map(function (b) { return b[1].toFixed(0) + " to " + b[2].toFixed(0); }), textposition: "inside", insidetextanchor: "middle", textfont: { color: "#fff" },
        hovertemplate: "%{y}: %{base:.2f} to %{x:.2f}<extra></extra>" }
    ], { height: 350, margin: { l: 330, r: 24, t: 34, b: 40 }, xaxis: { title: "USD per On share", range: [10, 70] }, yaxis: { autorange: "reversed" }, showlegend: false,
      shapes: [{ type: "line", x0: r.offer, x1: r.offer, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", width: 2 } },
               { type: "line", x0: t.price, x1: t.price, yref: "paper", y0: 0, y1: 1, line: { color: "#111", width: 1, dash: "dot" } }],
      annotations: [{ x: r.offer, y: 1.0, yref: "paper", text: "Offer " + r.offer.toFixed(2), showarrow: false, xanchor: "left", yanchor: "bottom", font: { color: "#7A1E1E" } },
                    { x: t.price, y: 1.0, yref: "paper", text: "Last " + t.price.toFixed(2), showarrow: false, xanchor: "right", yanchor: "bottom" }] });

    // Sources and uses
    const uses = [["Purchase of On equity", r.equity], ["Adviser fees", r.fees], ["Financing fees", r.finFees]];
    const totU = uses.reduce(function (s, x) { return s + x[1]; }, 0);
    const srcs = [["New Nike shares", r.stockConsid], ["Nike cash on hand", r.cashUsed], ["New bonds", r.newDebt]];
    UI.table("suTable", [{ h: "", f: function (x) { return x[0]; } }, { h: "USD m", n: 1, f: function (x) { return x[1] == null ? "" : UI.fmt(x[1]); } }, { h: "%", n: 1, f: function (x) { return x[1] == null ? "" : UI.pct(x[1] / totU, 0); } }],
      [["<b>Sources</b>", null]].concat(srcs).concat([["Total sources", totU], ["<b>Uses</b>", null]]).concat(uses).concat([["Total uses", totU]]),
      { rowClass: function (x) { return /^Total/.test(x[0]) ? "total" : ""; } });
    UI.table("considTable", [{ h: "", f: function (x) { return x[0]; } }, { h: "Per On share", n: 1, f: function (x) { return x[1]; } }], [
      ["Cash", usd(r.cashPerShare)],
      ["Nike shares (exchange ratio)", r.exchangeRatio.toFixed(4) + " shares"],
      ["Value of the Nike shares", usd(r.exchangeRatio * r.issuePrice)],
      ["Total value", usd(r.offer)],
      ["New Nike shares issued", UI.fmt(r.newShares, 1) + "m"],
      ["On holders' share of Nike after the deal", UI.pct(r.ownTarget)],
      ["The same if paid fully in Nike shares", UI.pct(r.contrib.ownershipAllStock)]
    ], { rowClass: function (x) { return x[0] === "Total value" ? "total" : ""; } });
    const P = r.ppa;
    UI.table("ppaTable", [{ h: "", f: function (x) { return x[0]; } }, { h: "USD m", n: 1, f: function (x) { return UI.fmt(x[1]); } }], [
      ["Equity purchase price", r.equity], ["Less On book equity (excluding old goodwill)", -(P.bookUsd - P.oldGoodwill)], ["Excess purchase price", P.excess],
      ["Brand (indefinite life)", -P.brand], ["Customer relationships and technology", -P.amortisable], ["Deferred tax liability on write ups", P.dtl], ["Goodwill", P.goodwill],
      ["Annual amortisation, pre tax", P.amort]
    ], { rowClass: function (x) { return x[0] === "Goodwill" || x[0] === "Excess purchase price" ? "total" : ""; } });
    document.getElementById("ppaNote").innerHTML = "The brand is valued at " + UI.pct(A.ppa.brandPctEv, 0) + " and customer relationships and CloudTec technology at " + UI.pct(A.ppa.amortPctEv, 0) +
      " of enterprise value, typical for a consumer brand. Only the second is amortised, over " + A.ppa.life + " years, which costs " + usd(P.amort * (1 - A.acquirer.taxRate) / r.proShares, 3) + " of earnings per share a year after tax. Goodwill is tested for impairment, not amortised.";

    // Pro forma table
    const heads = Y.map(function (y) { return fy(y.fy) + "E"; });
    const col = function (f) { return Y.map(f); };
    UI.fin("pfTable", heads, [
      { label: "Nike standalone net income", vals: col(function (y) { return y.nkeNI; }) },
      { label: "On net income, calendarised, in USD", vals: col(function (y) { return y.onNI; }) },
      { label: "Cost synergies, pre tax (phased " + A.synergies.phasing.map(function (p) { return UI.pct(p, 0); }).join(", ") + ")", vals: col(function (y) { return y.synergies; }) },
      { label: "Revenue synergies, EBIT", vals: col(function (y) { return y.revSyn; }) },
      { label: "Interest on new bonds", vals: col(function (y) { return -y.interestNew; }) },
      { label: "Interest lost on cash used", vals: col(function (y) { return -y.lostInterest; }) },
      { label: "Amortisation of intangibles and financing fees", vals: col(function (y) { return -(y.amort + y.finAmort); }) },
      { label: "Tax on adjustments at " + UI.pct(A.acquirer.taxRate, 0), vals: col(function (y) { return -(y.adjAfterTax / (1 - A.acquirer.taxRate)) * A.acquirer.taxRate; }) },
      { label: "Pro forma net income", vals: col(function (y) { return y.pfNI; }), cls: "total" },
      { label: "Pro forma shares (m)", vals: col(function () { return r.proShares; }), f: function (v) { return UI.fmt(v, 1); } },
      { label: "Pro forma EPS (USD)", vals: col(function (y) { return y.pfEPS; }), f: function (v) { return v.toFixed(3); }, cls: "hl" },
      { label: "Nike standalone EPS (USD)", vals: col(function (y) { return y.standalone; }), f: function (v) { return v.toFixed(3); } },
      { label: "&nbsp;&nbsp;source", vals: A.acquirer.epsSource, f: function (v) { return v; }, cls: "sub" },
      { label: "Accretion / (dilution), USD", vals: col(function (y) { return y.accretionUsd; }), f: function (v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(3); } },
      { label: "Accretion / (dilution), %", vals: col(function (y) { return y.accretion; }), f: pt, cls: "total" },
      { label: "EPS after one off integration costs", vals: col(function (y) { return y.gaapEPS; }), f: function (v) { return v.toFixed(3); }, cls: "sub" }
    ], 0);
    document.getElementById("pfNote").innerHTML = "Adjusted earnings per share exclude one off integration costs of USD " + A.synergies.integrationCost + "m, the last line shows them included. On's consensus covers 2026 and 2027 and Nike's FY28; later years are extrapolated (On at +15%, +13%, +11%; Nike at +15%, +12%).";

    // Bridge chart for FY29
    const b = y2.bridge;
    const steps = [["Nike standalone", b.standalone, "absolute"], ["New shares issued", b.dilution, "relative"], ["On earnings", b.target, "relative"], ["Synergies", b.synergies, "relative"],
      ["Financing cost", b.financing, "relative"], ["Amortisation", b.amortisation, "relative"], ["Pro forma", b.proForma, "total"]];
    document.getElementById("bridgeTitle").textContent = "Earnings per share bridge, " + fy(y2.fy) + "E (USD)";
    UI.plot("chBridge", [{ type: "waterfall", x: steps.map(function (s) { return s[0]; }), y: steps.map(function (s) { return s[2] === "total" ? 0 : s[1]; }), measure: steps.map(function (s) { return s[2]; }),
      text: steps.map(function (s) { return (s[2] === "relative" && s[1] >= 0 ? "+" : "") + s[1].toFixed(3); }), textposition: "outside", cliponaxis: false,
      connector: { line: { color: "#BDB7AA" } }, increasing: { marker: { color: "#2F4A36" } }, decreasing: { marker: { color: "#7A1E1E" } }, totals: { marker: { color: "#111111" } } }],
      { height: 330, showlegend: false, yaxis: { title: "USD per share", range: [0, Math.max(b.standalone + b.target, b.proForma) * 1.25] }, margin: { l: 60, r: 20, t: 20, b: 60 } });
    UI.plot("chEps", [
      { type: "bar", name: "Nike standalone", x: heads, y: col(function (y) { return y.standalone; }), marker: { color: "#B9B3A6" }, text: col(function (y) { return y.standalone.toFixed(2); }), textposition: "outside" },
      { type: "bar", name: "Pro forma", x: heads, y: col(function (y) { return y.pfEPS; }), marker: { color: "#111111" }, text: col(function (y) { return y.pfEPS.toFixed(2) + " (" + pt(y.accretion) + ")"; }), textposition: "outside", cliponaxis: false }
    ], { height: 330, barmode: "group", yaxis: { title: "USD per share", range: [0, Math.max.apply(null, col(function (y) { return Math.max(y.pfEPS, y.standalone); })) * 1.25] } });

    // Sensitivities
    const prem = [0.2, 0.3, 0.35, 0.4, 0.5, 0.6], stock = [0, 0.25, 0.5, 0.75, 1], syn = [0, 125, 250, 375, 500];
    const acc = function (x) { return x.years[1].accretion; };
    const base = Object.assign({}, opts());
    const g1 = prem.map(function (p) { return stock.map(function (s) { return acc(E.merge(a, Object.assign({}, base, { premium: p, pctStock: s }))); }); });
    UI.sens("sens1", "Premium", "Stock", prem, stock, g1, function (v) { return UI.pct(v, 0); }, function (v) { return UI.pct(v, 0); }, pt,
      prem.indexOf(state.premium), stock.indexOf(state.pctStock), function (v) { return UI.heat(v, -0.08, 0, 0.12); });
    const g2 = prem.map(function (p) { return syn.map(function (s) { return acc(E.merge(a, Object.assign({}, base, { premium: p, synergies: s }))); }); });
    UI.sens("sens2", "Premium", "Synergies", prem, syn, g2, function (v) { return UI.pct(v, 0); }, function (v) { return v; }, pt,
      prem.indexOf(state.premium), syn.indexOf(state.synergies), function (v) { return UI.heat(v, -0.08, 0, 0.12); });

    // Relative P/E box
    const nkPe = q.price / y1.standalone, offerPe = r.equity / y1.onNI;
    const afterTaxDebt = state.debtRate * (1 - q.taxRate), earningsYield = 1 / offerPe;
    document.getElementById("peBox").innerHTML = '<div class="table-wrap"><table><tbody>' +
      '<tr><td>Nike P/E on ' + fy(y1.fy) + 'E: the price of the shares Nike issues</td><td class="n">' + UI.mult(nkPe) + '</td></tr>' +
      '<tr><td>P/E Nike pays for On at the offer (' + fy(y1.fy) + 'E, calendarised)</td><td class="n">' + UI.mult(offerPe) + '</td></tr>' +
      '<tr><td>Earnings yield Nike buys (1 / P/E)</td><td class="n">' + UI.pct(earningsYield, 2) + '</td></tr>' +
      '<tr><td>After tax cost of new debt</td><td class="n">' + UI.pct(afterTaxDebt, 2) + '</td></tr>' +
      '<tr><td>After tax interest given up on cash</td><td class="n">' + UI.pct(A.deal.cashRate * (1 - q.taxRate), 2) + '</td></tr>' +
      '<tr class="total"><td>Highest premium that keeps ' + fy(y2.fy) + ' accretive</td><td class="n">' + (function () { const m = E.maxPremium(a, base, 1); return m == null ? "n.a." : UI.pct(m, 0); })() + '</td></tr>' +
      '</tbody></table></div><p class="note">A stock deal adds to earnings when the buyer\'s P/E is above the P/E it pays; a cash deal does when the earnings yield bought is above the after tax cost of the money. At the base case both hold, so the deal is accretive even before synergies. That says more about Nike\'s depressed earnings than about the deal.</p>';
    UI.table("beTable", [{ h: "", f: function (x) { return x[0]; } }].concat(Y.map(function (y, i) { return { h: heads[i], n: 1, f: function (x) { return x[i + 1]; } }; })), [
      ["Pre tax synergies for zero accretion (USD m)"].concat(Y.map(function (y) { return UI.fmt(y.breakeven); })),
      ["Synergies in the case (USD m)"].concat(Y.map(function (y) { return UI.fmt(y.synergies); })),
      ["Cushion (USD m)"].concat(Y.map(function (y) { return UI.fmt(y.synergies - y.breakeven); }))
    ]);
    document.getElementById("beNote").innerHTML = Y[0].breakeven < 0 ? "A negative number means the deal adds to earnings per share even with no synergies at all: On's earnings more than cover the new shares, the interest and the amortisation." : "Below these synergies the deal dilutes Nike's earnings per share.";

    // Contribution chart
    const C = r.contrib;
    const cl = [["Revenue", C.revenue], ["EBITDA", C.ebitda], ["Net income", C.netIncome], ["Market value today", C.equity], ["Ownership if all stock", C.ownershipAllStock], ["Ownership at this mix", C.ownership]];
    UI.plot("chContrib", [
      { type: "bar", orientation: "h", name: "On", y: cl.map(function (c) { return c[0]; }), x: cl.map(function (c) { return c[1]; }), marker: { color: cl.map(function (c, i) { return i >= 4 ? "#7A1E1E" : "#111111"; }) }, text: cl.map(function (c) { return UI.pct(c[1], 0); }), textposition: "inside", textangle: 0, constraintext: "none", textfont: { color: "#fff" } },
      { type: "bar", orientation: "h", name: "Nike", y: cl.map(function (c) { return c[0]; }), x: cl.map(function (c) { return 1 - c[1]; }), marker: { color: "#CFC9BC" }, text: cl.map(function (c) { return UI.pct(1 - c[1], 0); }), textposition: "inside" }
    ], { height: 330, barmode: "stack", margin: { l: 170, r: 20, t: 10, b: 40 }, xaxis: { tickformat: ".0%", range: [0, 1] }, yaxis: { autorange: "reversed" }, showlegend: false });

    // Credit
    const cr = r.credit;
    UI.table("creditTable", [{ h: "Credit, " + fy(y1.fy) + "E", f: function (x) { return x[0]; } }, { h: "Nike alone", n: 1, f: function (x) { return x[1]; } }, { h: "Pro forma", n: 1, f: function (x) { return x[2]; } }], [
      ["Net debt (USD m, excluding leases)", UI.fmt(q.debt - q.cash), UI.fmt(cr.pfNetDebt)],
      ["EBITDA (USD m)", UI.fmt(q.ebitda[0]), UI.fmt(cr.pfEbitda)],
      ["Net debt / EBITDA", cr.standaloneLeverage < 0 ? "net cash" : UI.mult(cr.standaloneLeverage), cr.proFormaLeverage < 0 ? "net cash" : UI.mult(cr.proFormaLeverage)],
      ["New bonds (USD m)", "", UI.fmt(r.newDebt)],
      ["Cash used (USD m)", "", UI.fmt(r.cashUsed)]
    ]);
    document.getElementById("creditNote").innerHTML = "Nike is rated in the single A to double A range. Leverage below about 1.5x EBITDA is consistent with keeping a single A rating; above 2.5x a downgrade becomes likely. Paying fully in cash would take leverage to " + UI.mult(E.merge(a, Object.assign({}, base, { pctStock: 0 })).credit.proFormaLeverage) + ".";

    // Value creation
    const V = r.value;
    UI.plot("chValue", [{ type: "waterfall", x: ["Value of cost synergies", "Integration costs", "Fees", "Premium paid", "Value created"],
      y: [V.synValue, -V.integration, -V.fees, -V.premiumPaid, 0], measure: ["relative", "relative", "relative", "relative", "total"],
      text: [V.synValue, -V.integration, -V.fees, -V.premiumPaid, V.created].map(function (v) { return UI.fmt(v); }), textposition: "outside", cliponaxis: false,
      connector: { line: { color: "#BDB7AA" } }, increasing: { marker: { color: "#2F4A36" } }, decreasing: { marker: { color: "#7A1E1E" } }, totals: { marker: { color: V.created >= 0 ? "#2F4A36" : "#7A1E1E" } } }],
      { height: 330, showlegend: false, yaxis: { title: "USD m" }, margin: { l: 70, r: 20, t: 20, b: 50 } });
    document.getElementById("valueText").innerHTML =
      "<p>Earnings per share accretion measures accounting, not value. Nike's shareholders gain only if the synergies they capture are worth more than the premium they hand to On's shareholders.</p>" +
      "<p>Capitalised at a " + UI.pct(A.valuation.wacc, 1) + " cost of capital with " + UI.pct(A.valuation.synGrowth, 0) + " growth, and allowing for the phase in, USD " + state.synergies + "m of annual cost synergies are worth about USD " + UI.fmt(V.synValue / 1000, 1) + "bn after tax. The premium at " + UI.pct(r.premium, 0) + " is USD " + UI.fmt(V.premiumPaid / 1000, 1) + "bn.</p>" +
      "<p><b>The synergies justify a premium of about " + UI.pct(V.maxPremium, 0) + "</b>, while a typical control premium in the sector is 28% to 35%. Anything above that is a bet on growth that On's shareholders already price in, or on revenue synergies, which are less certain. This is the core tension of the deal: it looks good on earnings per share because Nike's shares are expensive, but at a customary premium it moves value from Nike's shareholders to On's.</p>";
  }

  function staticTables() {
    const rows = A.comps.rows;
    UI.table("compsTable", [{ h: "Company", f: function (c) { return c.name; } }, { h: "EV / LTM EBITDA", n: 1, f: function (c) { return UI.mult(c.evEbitda); } },
      { h: "EV / sales", n: 1, f: function (c) { return UI.mult(c.evSales, 2); } }, { h: "Forward P/E", n: 1, f: function (c) { return UI.mult(c.fwdPE); } },
      { h: "Growth", n: 1, f: function (c) { return UI.pct(c.growth, 0); } }, { h: "EBITDA margin", n: 1, f: function (c) { return UI.pct(c.margin, 0); } }],
      rows, { rowClass: function (c) { return c.sym === "ONON" || c.sym === "NKE" ? "hl" : ""; } });
    document.getElementById("compsNote").innerHTML = "Yahoo Finance snapshot, " + A.comps.asOf + ". Enterprise value includes lease liabilities as reported by Yahoo; On converted from CHF. Growth is the latest quarter against the prior year. Puma's EBITDA is negative.";
    UI.table("precTable", [{ h: "Date", f: function (p) { return p.date; } }, { h: "Buyer / target", f: function (p) { return p.acquirer + " / " + p.target; } },
      { h: "Value", f: function (p) { return p.value; } }, { h: "Premium", n: 1, f: function (p) { return p.premium == null ? "n.a." : UI.pct(p.premium, 0); } }], A.precedents);
    document.getElementById("srcList").innerHTML = [
      ["Nike, fiscal 2026 fourth quarter and full year results (30 Jun 2026)", "https://about.nike.com/newsroom/releases/nike-inc-reports-fiscal-2026-fourth-quarter-and-full-year-results"],
      ["Nike, fiscal 2027 first quarter results (1 Oct 2026)", "https://about.nike.com/newsroom/releases/nike-inc-reports-fiscal-2027-first-quarter-results"],
      ["On, results for the third quarter 2026 (10 Nov 2026)", "https://s21.q4cdn.com/241001792/files/content_files/2026-11-10_On-Reports-Results-for-the-Third-Quarter.pdf"],
      ["On, annual report 2025 (Form 20-F): share classes", "https://investors.on-running.com/files/doc_financials/2025/ar/Ex-99-3_Annual-Report_FY2025-1.pdf"],
      ["On, F-1 registration statement (2021): Class B voting rights shares", "https://sec.gov/Archives/edgar/data/1858985/000119312521270834/d175570df1a.htm"],
      ["Anta Sports acquires 29% of Puma (Jan 2026)", "https://fashionunited.uk/news/business/anta-sports-becomes-largest-shareholder-in-puma/2026012785939"],
      ["3G Capital acquires Skechers (May 2025)", "https://www.retaildive.com/news/skechers-acquired-3g-capital-go-private-deal/747148"],
      ["Adidas to combine with Reebok (Aug 2005)", "https://styles.finanzen.at/nachrichten/aktien/adidas-salomon-to-combine-with-reebok-and-create-eur-9-billion-footprint-in-global-athletic-footwear-apparel-and-hardware-markets-1000537898"],
      ["Market data, consensus and peer multiples: Yahoo Finance via the site's data pipeline", "data/fundamentals.json"]
    ].map(function (s) { return '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + "</a></li>"; }).join("");
  }

  function prices() {
    Promise.all([API.localPrices("NKE"), API.localPrices("ONON")]).then(function (res) {
      if (!res[0] || !res[1]) return;
      const tr = function (lp, name, color) {
        const s = lp.series, b = s[0].close;
        return { type: "scatter", mode: "lines", name: name, x: s.map(function (p) { return p.date; }), y: s.map(function (p) { return p.close / b * 100; }), line: { color: color, width: 1.6 } };
      };
      UI.plot("chPrices", [tr(res[0], "Nike", "#111111"), tr(res[1], "On", "#7A1E1E")], { height: 330, yaxis: { title: "Rebased" } });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("hFx").textContent = A.fx.toFixed(4);
    defaults(); buildControls(); sync(); staticTables(); render(); prices();
  });
})();
