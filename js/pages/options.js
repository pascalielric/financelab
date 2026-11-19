/* Options page controller */
(function () {
  "use strict";
  const O = window.Options;
  const NAMES = { SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF", AAPL: "Apple", NVDA: "Nvidia", NKE: "Nike", ONON: "On Holding" };
  const st = { sym: "SPY", data: {}, type: "call", c: {}, slices: null, exp: null };
  const CTRL = [
    { k: "S", label: "Share price", min: 0.5, max: 1.5, step: 0.005, rel: true, f: function (v) { return v.toFixed(2); } },
    { k: "K", label: "Strike", min: 0.5, max: 1.5, step: 0.005, rel: true, f: function (v) { return v.toFixed(2); } },
    { k: "days", label: "Days to expiry", min: 1, max: 730, step: 1, f: function (v) { return v + " days"; } },
    { k: "vol", label: "Volatility", min: 0.05, max: 1.2, step: 0.005, f: function (v) { return UI.pct(v, 1); } },
    { k: "r", label: "Interest rate", min: 0, max: 0.08, step: 0.0005, f: function (v) { return UI.pct(v, 2); } },
    { k: "q", label: "Dividend yield", min: 0, max: 0.06, step: 0.0005, f: function (v) { return UI.pct(v, 2); } },
    { k: "N", label: "Tree steps", min: 10, max: 500, step: 10, f: function (v) { return v; } }
  ];

  const sg = function (v, d) { return (v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(d); };
  const sci = function (v) { const e = v.toExponential(2).replace("e", " × 10^").replace("^-", "^\u2212").replace("^+", "^"); return (v < 0 ? "\u2212" : "") + e.replace(/^-/, ""); };
  function load(sym) {
    if (st.data[sym]) return Promise.resolve(st.data[sym]);
    return fetch("data/options/" + sym + ".json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { st.data[sym] = d; return d; });
  }

  function buildSlices(d) {
    const r = d.rates.y13w, q = d.dividendYield || 0;
    const out = [];
    d.chains.forEach(function (ch) {
      const T = Math.max(ch.days, 1) / 365;
      const sl = O.slice(ch, d.spot, T, r, q);
      sl.expiry = ch.expiry; sl.days = ch.days; sl.T = T;
      sl.svi = sl.pts.length >= 6 ? O.fitSvi(sl.pts, T) : null;
      sl.ok = !!(sl.svi && sl.svi.rmse < 0.06);
      sl.atm = sl.svi ? O.sviVol(sl.svi, 0, T) : null;
      out.push(sl);
    });
    return out;
  }
  function volAt(slices, moneyness, days) {
    const good = slices.filter(function (s) { return s.ok; });
    if (!good.length) return null;
    let a = good[0], b = good[good.length - 1];
    for (let i = 0; i < good.length - 1; i++) if (good[i].days <= days && good[i + 1].days >= days) { a = good[i]; b = good[i + 1]; break; }
    const wa = function (s) { return O.sviW(s.svi, Math.log(moneyness)); };
    if (a === b || days <= a.days) return Math.sqrt(Math.max(wa(a), 1e-10) / a.T);
    if (days >= b.days) return Math.sqrt(Math.max(wa(b), 1e-10) / b.T);
    // linear in total variance between slices
    const t = days / 365, x = (days - a.days) / (b.days - a.days), w = wa(a) + x * (wa(b) - wa(a));
    return Math.sqrt(Math.max(w, 1e-10) / t);
  }

  // ---------------- Pricer ----------------
  function seedPricer() {
    const d = st.data[st.sym];
    const v30 = volAt(st.slices, 1, 30) || 0.25;
    st.c = { S: d.spot, K: Math.round(d.spot), days: 90, vol: Math.round(v30 * 1000) / 1000, r: d.rates.y13w, q: d.dividendYield || 0, N: 200 };
    CTRL.forEach(function (c) {
      const el = document.getElementById("c_" + c.k);
      if (c.rel) { el.min = (d.spot * c.min).toFixed(2); el.max = (d.spot * c.max).toFixed(2); el.step = (d.spot * c.step).toFixed(4); }
      el.value = st.c[c.k];
    });
  }
  function buildControls() {
    document.getElementById("controls").innerHTML = CTRL.map(function (c) {
      return '<div class="ctl"><label><span>' + c.label + '</span><output id="o_' + c.k + '"></output></label><input type="range" id="c_' + c.k + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '"></div>';
    }).join("");
    CTRL.forEach(function (c) { document.getElementById("c_" + c.k).oninput = function (e) { st.c[c.k] = +e.target.value; renderPricer(); }; });
    document.getElementById("reset").onclick = function () { seedPricer(); renderPricer(); };
    document.querySelectorAll("#otype button").forEach(function (b) {
      b.onclick = function () { document.querySelectorAll("#otype button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); st.type = b.dataset.t; renderPricer(); };
    });
  }
  function renderPricer() {
    const c = st.c, T = c.days / 365, ty = st.type;
    CTRL.forEach(function (x) { document.getElementById("o_" + x.k).textContent = x.f(c[x.k]); });
    const g = O.bs(c.S, c.K, T, c.r, c.q, c.vol, ty);
    const eu = O.crr(c.S, c.K, T, c.r, c.q, c.vol, c.N, ty, false), am = O.crr(c.S, c.K, T, c.r, c.q, c.vol, c.N, ty, true);
    const other = O.bs(c.S, c.K, T, c.r, c.q, c.vol, ty === "call" ? "put" : "call");
    const parityGap = (ty === "call" ? g.price - other.price : other.price - g.price) - (c.S * Math.exp(-c.q * T) - c.K * Math.exp(-c.r * T));
    UI.table("priceTable", [{ h: "Method", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }], [
      ["Black Scholes Merton (European)", g.price.toFixed(4)],
      ["Binomial tree, " + c.N + " steps (European)", eu.price.toFixed(4)],
      ["Binomial tree, " + c.N + " steps (American)", am.price.toFixed(4)],
      ["Early exercise premium", (am.price - eu.price).toFixed(4)],
      ["Intrinsic value", Math.max(ty === "call" ? c.S - c.K : c.K - c.S, 0).toFixed(4)],
      ["Time value", (g.price - Math.max(ty === "call" ? c.S - c.K : c.K - c.S, 0)).toFixed(4)],
      ["Put call parity check (should be zero)", Math.abs(parityGap) < 1e-9 ? "0.0000" : sci(parityGap)]
    ], { rowClass: function (x) { return x[0].indexOf("Black") === 0 ? "hl" : ""; } });
    document.getElementById("priceNote").innerHTML = "Tree: up factor u = " + eu.u.toFixed(5) + ", down factor d = 1/u, risk neutral probability p = " + eu.p.toFixed(4) +
      ". The tree gap to Black Scholes is " + sci(eu.price - g.price) + " and shrinks roughly in proportion to 1 / steps." +
      (ty === "call" && c.q === 0 ? " With no dividend an American call is never exercised early, so both tree values match." : "");
    UI.table("greekTable", [{ h: "Greek", f: function (x) { return x[0]; } }, { h: "Value", n: 1, f: function (x) { return x[1]; } }, { h: "Meaning", f: function (x) { return x[2]; } }], [
      ["Delta", sg(g.delta, 4), "Shares to hold to hedge one option"],
      ["Gamma", g.gamma.toFixed(5), "Change in delta for a 1 unit move"],
      ["Vega", g.vega.toFixed(4), "Value change for +1 point of volatility"],
      ["Theta", sg(g.theta, 4), "Value lost per calendar day"],
      ["Rho", sg(g.rho, 4), "Value change for +1 point of rates"],
      ["d1 / d2", sg(g.d1, 4) + " / " + sg(g.d2, 4), "N(d2) is the risk neutral exercise probability"]
    ]);
    // charts across spot
    const cur = (st.data[st.sym] && st.data[st.sym].currency) || "USD";
    const xs = []; for (let i = 0; i <= 120; i++) xs.push(c.K * (0.6 + 0.8 * i / 120));
    const val = xs.map(function (s) { return O.bs(s, c.K, T, c.r, c.q, c.vol, ty).price; });
    const pay = xs.map(function (s) { return Math.max(ty === "call" ? s - c.K : c.K - s, 0); });
    const legendTop = { orientation: "h", x: 0, xanchor: "left", y: 1.03, yanchor: "bottom", font: { size: 11 }, itemwidth: 30, tracegroupgap: 0 };
    const strikeLine = function (yref) { return { type: "line", x0: c.K, x1: c.K, yref: yref || "paper", y0: 0, y1: 1, line: { color: "#BDB7AA", width: 1, dash: "dot" } }; };
    const vmax = Math.max.apply(null, val.concat(pay)) * 1.08, call0 = ty === "call";
    UI.plot("chValue", [
      { x: xs, y: pay, name: "Payoff at expiry", line: { color: "#B9B3A6", width: 1.6 }, hovertemplate: "Share %{x:.2f}<br>Payoff %{y:.2f}<extra></extra>" },
      { x: xs, y: val, name: "Value today", line: { color: "#111111", width: 2 }, hovertemplate: "Share %{x:.2f}<br>Value %{y:.2f}<extra></extra>" },
      { x: [c.S], y: [g.price], mode: "markers", name: "Today", marker: { color: "#7A1E1E", size: 8 }, hovertemplate: "Share %{x:.2f}<br>Value %{y:.2f}<extra></extra>" }],
      { height: 320, showlegend: false, margin: { l: 64, r: 16, t: 30, b: 52 },
        xaxis: { title: "Share price (" + cur + ")", range: [xs[0], xs[xs.length - 1]] }, yaxis: { title: "Option value (" + cur + ")", range: [0, vmax], rangemode: "nonnegative", zeroline: false },
        shapes: [strikeLine()],
        annotations: [{ x: c.K, y: 1, yref: "paper", text: "Strike " + c.K.toFixed(0), showarrow: false, xanchor: "left", yanchor: "top", xshift: 4, font: { size: 11, color: "#6E6A61" } },
                      { x: c.S, y: g.price, text: "Today " + g.price.toFixed(2), showarrow: false, xanchor: call0 ? "right" : "left", yanchor: "bottom", xshift: call0 ? -6 : 6, font: { size: 11, color: "#7A1E1E" } },
                      { x: call0 ? xs[100] : xs[20], y: val[call0 ? 100 : 20], text: "Value today", showarrow: false, xanchor: call0 ? "right" : "left", yanchor: "bottom", xshift: call0 ? -6 : 6, yshift: 2, font: { size: 11, color: "#111111" } },
                      { x: xs[call0 ? 76 : 44], y: pay[call0 ? 76 : 44], text: "Payoff at expiry", showarrow: false, xanchor: call0 ? "left" : "right", yanchor: "top", xshift: call0 ? 10 : -10, yshift: -2, font: { size: 11, color: "#8C877C" } }] });
    const de = xs.map(function (s) { return O.bs(s, c.K, T, c.r, c.q, c.vol, ty).delta; }), ga = xs.map(function (s) { return O.bs(s, c.K, T, c.r, c.q, c.vol, ty).gamma; });
    const call = ty === "call";
    UI.plot("chGreeks", [
      { x: xs, y: de, name: "Delta (left)", line: { color: "#111111", width: 2 }, hovertemplate: "Share %{x:.2f}<br>Delta %{y:.3f}<extra></extra>" },
      { x: xs, y: ga, name: "Gamma (right)", yaxis: "y2", line: { color: "#7A1E1E", width: 1.6 }, hovertemplate: "Share %{x:.2f}<br>Gamma %{y:.5f}<extra></extra>" }],
      { height: 320, showlegend: false, margin: { l: 64, r: 64, t: 30, b: 52 },
        xaxis: { title: "Share price (" + cur + ")", range: [xs[0], xs[xs.length - 1]] },
        yaxis: { title: "Delta (left axis)", range: call ? [0, 1] : [-1, 0], zeroline: false, tickformat: ".1f" },
        yaxis2: { title: "Gamma (right axis)", overlaying: "y", side: "right", showgrid: false, range: [0, Math.max.apply(null, ga) * 1.1], zeroline: false, tickformat: ".3f", nticks: 5 },
        shapes: [{ type: "line", x0: c.S, x1: c.S, yref: "paper", y0: 0, y1: 1, line: { color: "#7A1E1E", width: 1, dash: "dot" } }],
        annotations: [{ x: c.S, y: 0, yref: "paper", text: "Today", showarrow: false, xanchor: "left", yanchor: "bottom", xshift: 4, font: { size: 11, color: "#7A1E1E" } },
                      { x: xs[100], y: de[100], text: "Delta", showarrow: false, xanchor: "right", yanchor: call ? "bottom" : "top", xshift: -4, font: { size: 11, color: "#111111" } },
                      { x: xs[38], y: ga[38], yref: "y2", text: "Gamma", showarrow: false, xanchor: "right", yanchor: "bottom", xshift: -4, font: { size: 11, color: "#7A1E1E" } }] });
    // Absolute pricing error of the tree against Black Scholes: converges to zero as the tree gets finer
    const ns = [], err = [];
    for (let n = 10; n <= 400; n += (n < 100 ? 2 : 10)) { ns.push(n); err.push(Math.abs(O.crr(c.S, c.K, T, c.r, c.q, c.vol, n, ty, false).price - g.price)); }
    UI.plot("chConv", [{ x: ns, y: err, name: "Tree minus Black Scholes, absolute", line: { color: "#111111", width: 1.4 }, hovertemplate: "%{x} steps<br>Error %{y:.4f}<extra></extra>" }],
      { height: 320, showlegend: false, margin: { l: 64, r: 16, t: 30, b: 52 },
        xaxis: { title: "Number of tree steps", range: [0, 400] }, yaxis: { title: "Pricing error (" + cur + ")", range: [0, Math.max.apply(null, err) * 1.1], zeroline: false } });
  }

  // ---------------- Surface ----------------
  function renderSurface() {
    const d = st.data[st.sym], S = st.slices, good = S.filter(function (s) { return s.ok; });
    const nm = NAMES[st.sym] || st.sym;
    document.getElementById("asOf").textContent = "Option prices " + d.asOf.slice(0, 10) + " " + d.asOf.slice(11, 16) + " UTC · spot " + d.spot.toFixed(2) + " " + (d.currency || "");
    const used = S.reduce(function (s, x) { return s + x.pts.length; }, 0), live = S.reduce(function (s, x) { return s + x.pts.filter(function (p) { return p.src === "mid"; }).length; }, 0);
    const v30 = volAt(S, 1, 30), v365 = volAt(S, 1, 365), skew = volAt(S, 0.9, 91) - volAt(S, 1.1, 91);
    document.getElementById("kpis").innerHTML =
      '<div class="kpi dark"><div class="label">' + st.sym + " spot</div><div class=\"value\">" + d.spot.toFixed(2) + '</div><div class="sub">' + nm + "</div></div>" +
      '<div class="kpi"><div class="label">30 day volatility</div><div class="value">' + UI.pct(v30, 1) + '</div><div class="sub">At the money, interpolated</div></div>' +
      '<div class="kpi"><div class="label">One year volatility</div><div class="value">' + UI.pct(v365, 1) + '</div><div class="sub">' + (v365 > v30 ? "Upward" : "Downward") + " sloping term structure</div></div>" +
      '<div class="kpi"><div class="label">Three month skew</div><div class="value">' + (skew * 100).toFixed(1) + ' pts</div><div class="sub">Volatility at 90% less 110% moneyness</div></div>' +
      '<div class="kpi"><div class="label">Quotes used</div><div class="value">' + UI.fmt(used) + '</div><div class="sub">' + (live > used / 2 ? "Bid and ask midpoints" : "Mostly last trades (market closed)") + "</div></div>";

    // 3D surface
    const mny = []; for (let i = 0; i <= 40; i++) mny.push(0.8 + 0.4 * i / 40);
    const surf = good.filter(function (s) { return s.days >= 7; });
    // only inside the strikes each slice actually covers: no extrapolation in the picture
    const zs = surf.map(function (s) {
      const lo = Math.min.apply(null, s.pts.map(function (p) { return p.K / s.F; })), hi = Math.max.apply(null, s.pts.map(function (p) { return p.K / s.F; }));
      return mny.map(function (m) { return m < lo - 0.01 || m > hi + 0.01 ? null : O.sviVol(s.svi, Math.log(m), s.T) * 100; });
    });
    document.getElementById("surfTitle").textContent = nm + ": implied volatility (%) by moneyness and maturity";
    Plotly.react("chSurface", [{ type: "surface", x: mny, y: surf.map(function (s) { return s.days; }), z: zs, colorscale: [[0, "#EDE8DC"], [0.45, "#A8A193"], [1, "#2A2A2A"]], showscale: false,
      cmin: UI.quantile(zs.flat().filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; }), 0.05),
      cmax: UI.quantile(zs.flat().filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; }), 0.97),
      contours: { z: { show: true, usecolormap: false, color: "#BDB7AA", width: 1 } }, hovertemplate: "K/F %{x:.2f}<br>%{y} days<br>%{z:.1f}%<extra></extra>" }],
      { margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: "rgba(0,0,0,0)", font: { family: UI.FONT, size: 12, color: "#2E2E2E" },
        scene: { xaxis: { title: "Strike / forward", gridcolor: "#E4DFD3" }, yaxis: { title: "Days to expiry", gridcolor: "#E4DFD3" }, zaxis: { title: "Volatility %", gridcolor: "#E4DFD3" },
                 aspectmode: "manual", aspectratio: { x: 1.5, y: 1.3, z: 0.75 }, camera: { eye: { x: 1.35, y: -1.55, z: 0.75 }, center: { x: 0, y: 0, z: -0.12 } } } },
      { displayModeBar: false, responsive: true });

    // expiry selector
    const sel = document.getElementById("expSel");
    sel.innerHTML = S.map(function (s, i) { return '<option value="' + i + '"' + (s.ok ? "" : " disabled") + ">" + s.expiry + " (" + s.days + " days)</option>"; }).join("");
    if (st.exp == null || !S[st.exp] || !S[st.exp].ok) { let best = 0, bd = 1e9; S.forEach(function (s, i) { if (s.ok && Math.abs(s.days - 60) < bd) { bd = Math.abs(s.days - 60); best = i; } }); st.exp = best; }
    sel.value = st.exp; sel.onchange = function () { st.exp = +sel.value; renderSmile(); };
    renderSmile();

    UI.plot("chTerm", [{ x: good.map(function (s) { return s.days; }), y: good.map(function (s) { return s.atm * 100; }), mode: "lines+markers", name: "At the money", line: { color: "#111111", width: 1.6 }, marker: { size: 6 } },
      { x: good.map(function (s) { return s.days; }), y: good.map(function (s) { return O.sviVol(s.svi, Math.log(0.9), s.T) * 100; }), mode: "lines", name: "90% moneyness", line: { color: "#7A1E1E", width: 1.2, dash: "dot" } },
      { x: good.map(function (s) { return s.days; }), y: good.map(function (s) { return O.sviVol(s.svi, Math.log(1.1), s.T) * 100; }), mode: "lines", name: "110% moneyness", line: { color: "#8C877C", width: 1.2, dash: "dot" } }],
      { height: 330, xaxis: { title: "Days to expiry" }, yaxis: { title: "Implied volatility %" }, legend: { orientation: "h", y: 1.14 } });

    UI.table("sliceTable", [{ h: "Expiry", f: function (s) { return s.expiry; } }, { h: "Days", n: 1, f: function (s) { return s.days; } }, { h: "Forward", n: 1, f: function (s) { return s.F.toFixed(2); } },
      { h: "Source", f: function (s) { return s.source; } }, { h: "Carry", n: 1, f: function (s) { return UI.pct(s.carry, 2); } }, { h: "Quotes", n: 1, f: function (s) { return s.pts.length; } },
      { h: "ATM vol", n: 1, f: function (s) { return s.atm ? UI.pct(s.atm, 1) : "n.a."; } }, { h: "SVI a / b / ρ / m / σ", f: function (s) { return s.svi ? [s.svi.a, s.svi.b, s.svi.rho, s.svi.m, s.svi.s].map(function (v) { return sg(v, 3); }).join(" / ") : "too few quotes"; } },
      { h: "Fit error", n: 1, f: function (s) { return s.svi ? (s.svi.rmse * 100).toFixed(2) + " pts" : "n.a."; } }], S, { rowClass: function (s) { return s.ok ? "" : "sub"; } });

    // reading
    const evTxt = [];
    evTxt.push("<p><b>Skew.</b> Three month volatility is " + (skew * 100).toFixed(1) + " points higher at 90% of the forward than at 110%. " + (skew > 0 ? "Downside protection costs more than upside exposure, the usual pattern since 1987: investors pay up for puts, and volatility tends to rise when prices fall." : "Upside calls are priced richer than puts, which is unusual and typical of stocks where investors chase rallies or expect a takeover."));
    evTxt.push("<p><b>Term structure.</b> At the money volatility moves from " + UI.pct(v30, 1) + " at one month to " + UI.pct(v365, 1) + " at one year. " + (v365 > v30 ? "An upward slope is the normal state of a calm market: near term uncertainty is low relative to the long run." : "A downward slope means near term uncertainty is high, often around an event such as earnings, and is expected to fade."));
    const em = v30 * Math.sqrt(30 / 365) * d.spot;
    evTxt.push("<p><b>Expected move.</b> One standard deviation over the next 30 days is about ±" + em.toFixed(2) + " (" + UI.pct(v30 * Math.sqrt(30 / 365), 1) + "), what the option market prices as a typical one month move.</p>");
    if (st.sym === "ONON" || st.sym === "NKE") evTxt.push("<p><b>Link to the merger model.</b> On's options price about " + (st.sym === "ONON" ? UI.pct(v30, 0) : "40 to 45%") + " volatility. A takeover bid would collapse this towards the volatility of Nike's shares in a stock deal, or towards zero in a cash deal, which is how merger arbitrage traders read the probability of a deal from option prices.</p>");
    document.getElementById("readText").innerHTML = evTxt.join("");
  }
  function renderSmile() {
    const s = st.slices[st.exp]; if (!s || !s.svi) return;
    const pts = s.pts, ks = []; for (let i = 0; i <= 80; i++) ks.push(0.6 + 0.9 * i / 80);
    const inRange = function (m) { return m >= 0.6 && m <= 1.5; };
    const puts = pts.filter(function (p) { return p.type === "put" && inRange(p.K / s.F); }), calls = pts.filter(function (p) { return p.type === "call" && inRange(p.K / s.F); });
    const liveBook = pts.filter(function (p) { return p.src === "mid"; }).length > pts.length / 2;
    const yah = liveBook ? pts.filter(function (p) { return p.yahoo > 0.02 && p.yahoo < 3 && inRange(p.K / s.F); }) : [];
    UI.plot("chSmile", [
      { x: yah.map(function (p) { return p.K / s.F; }), y: yah.map(function (p) { return p.yahoo * 100; }), mode: "markers", name: "Yahoo's volatility", marker: { color: "#CFC9BC", size: 5, symbol: "x" } },
      { x: puts.map(function (p) { return p.K / s.F; }), y: puts.map(function (p) { return p.iv * 100; }), mode: "markers", name: "Puts (market)", marker: { color: "#7A1E1E", size: 6 } },
      { x: calls.map(function (p) { return p.K / s.F; }), y: calls.map(function (p) { return p.iv * 100; }), mode: "markers", name: "Calls (market)", marker: { color: "#111111", size: 6 } },
      { x: ks, y: ks.map(function (m) { return O.sviVol(s.svi, Math.log(m), s.T) * 100; }), mode: "lines", name: "SVI fit", line: { color: "#8C6D3F", width: 2 } }
    ], { height: 330, xaxis: { title: "Strike / forward", range: [0.6, 1.5] }, yaxis: { title: "Implied volatility %" }, legend: { orientation: "h", y: 1.14 } });
  }

  function selectSym(sym) {
    st.sym = sym; st.exp = null;
    document.querySelectorAll("#und button").forEach(function (b) { b.classList.toggle("on", b.dataset.s === sym); });
    load(sym).then(function (d) {
      if (!d) return;
      st.slices = buildSlices(d);
      seedPricer(); renderPricer(); renderSurface();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch("data/options/index.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (ix) {
      document.getElementById("und").innerHTML = ix.symbols.map(function (s) { return '<button data-s="' + s + '">' + s + "</button>"; }).join("");
      document.querySelectorAll("#und button").forEach(function (b) { b.onclick = function () { selectSym(b.dataset.s); }; });
      buildControls();
      selectSym(ix.symbols.indexOf("SPY") >= 0 ? "SPY" : ix.symbols[0]);
    });
  });
})();
