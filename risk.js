/* Portfolio risk and optimisation engine.
   Formulas follow the forward-risk, historical-risk, performance-metrics and asset-allocation skills of
   github.com/JoelLewis/finance_skills (MIT): log returns, parametric / historical / Monte Carlo VaR, CVaR,
   component and marginal VaR, drawdown analysis, Sharpe / Sortino / Treynor / Calmar / Omega / capture / M2,
   mean variance optimisation (max w'mu - lambda/2 w'Sigma w, long only) and risk parity. */
(function (root) {
  "use strict";
  const N_YEAR = 252;
  const Z = { 0.9: 1.2815515655, 0.95: 1.6448536270, 0.975: 1.9599639845, 0.99: 2.3263478740 };

  function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function variance(a) { const m = mean(a); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return s / (a.length - 1); }
  function std(a) { return Math.sqrt(variance(a)); }
  function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function matVec(M, v) { return M.map(function (row) { return dot(row, v); }); }
  function percentile(arr, p) { // linear interpolation, same convention as numpy.percentile
    const a = arr.slice().sort(function (x, y) { return x - y; });
    const pos = (a.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }
  function normPdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function zScore(c) { return Z[c] || Z[0.95]; }

  function logReturns(prices) { const r = []; for (let i = 1; i < prices.length; i++) r.push(Math.log(prices[i] / prices[i - 1])); return r; }

  /* Align several price series on their common dates. series = {SYM: [{date, close}]} */
  function align(series, symbols) {
    const maps = symbols.map(function (s) { const m = {}; series[s].forEach(function (p) { m[p.date] = p.close; }); return m; });
    const dates = Object.keys(maps[0]).filter(function (d) { return maps.every(function (m) { return m[d] != null; }); }).sort();
    return { dates: dates, prices: maps.map(function (m) { return dates.map(function (d) { return m[d]; }); }) };
  }

  function covMatrix(R) {
    const n = R.length, T = R[0].length, m = R.map(mean), C = [];
    for (let i = 0; i < n; i++) { C.push(new Array(n)); for (let j = 0; j <= i; j++) { let s = 0; for (let t = 0; t < T; t++) s += (R[i][t] - m[i]) * (R[j][t] - m[j]); C[i][j] = s / (T - 1); C[j][i] = C[i][j]; } }
    return C;
  }
  function corrMatrix(C) { return C.map(function (row, i) { return row.map(function (v, j) { return v / Math.sqrt(C[i][i] * C[j][j]); }); }); }
  function cholesky(A) {
    const n = A.length, L = A.map(function () { return new Array(n).fill(0); });
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-14)); else L[i][j] = s / L[j][j];
    }
    return L;
  }
  function portfolioReturns(R, w) { const T = R[0].length, out = new Array(T); for (let t = 0; t < T; t++) { let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * R[i][t]; out[t] = s; } return out; }
  function portVol(C, w) { return Math.sqrt(dot(w, matVec(C, w))); }

  // ---- Forward looking risk ----
  function parametricVar(C, w, value, conf, horizon) { return value * zScore(conf) * portVol(C, w) * Math.sqrt(horizon || 1); }
  function historicalVar(rp, value, conf, horizon) { return -percentile(rp, 1 - conf) * value * Math.sqrt(horizon || 1); }
  function cvarEmpirical(rp, value, conf, horizon) {
    const cut = percentile(rp, 1 - conf); const tail = rp.filter(function (r) { return r <= cut; });
    return -mean(tail) * value * Math.sqrt(horizon || 1);
  }
  function cvarParametric(C, w, value, conf, horizon) { const z = zScore(conf); return value * portVol(C, w) * normPdf(z) / (1 - conf) * Math.sqrt(horizon || 1); }
  function marginalVar(C, w, conf) { const sw = matVec(C, w), sp = portVol(C, w), z = zScore(conf); return sw.map(function (v) { return z * v / sp; }); }
  function componentVar(C, w, value, conf) { const mv = marginalVar(C, w, conf); return w.map(function (wi, i) { return wi * mv[i] * value; }); }
  function riskContribution(C, w) { const sw = matVec(C, w), sp2 = dot(w, sw); return w.map(function (wi, i) { return wi * sw[i] / sp2; }); }

  /* Monte Carlo VaR: correlated normal draws via Cholesky, multi day horizon */
  function monteCarloVar(mu, C, w, value, conf, horizon, nSims, rnd, gauss) {
    const L = cholesky(C), n = w.length, h = horizon || 1, sims = new Array(nSims);
    for (let s = 0; s < nSims; s++) {
      let total = 0;
      for (let d = 0; d < h; d++) {
        const z = []; for (let i = 0; i < n; i++) z.push(gauss(rnd));
        let pr = 0;
        for (let i = 0; i < n; i++) { let x = mu[i]; for (let k = 0; k <= i; k++) x += L[i][k] * z[k]; pr += w[i] * x; }
        total += pr;
      }
      sims[s] = total;
    }
    const cut = percentile(sims, 1 - conf);
    const tail = sims.filter(function (r) { return r <= cut; });
    return { var: -cut * value, cvar: -mean(tail) * value, sims: sims };
  }

  // ---- Historical risk ----
  function drawdown(values) {
    let peak = values[0], mdd = 0, peakIdx = 0, mddPeak = 0, mddTrough = 0, maxDur = 0, curStart = 0;
    const dd = values.map(function (v, i) {
      if (v >= peak) { peak = v; peakIdx = i; maxDur = Math.max(maxDur, i - curStart); curStart = i; }
      const d = (peak - v) / peak;
      if (d > mdd) { mdd = d; mddPeak = peakIdx; mddTrough = i; }
      return -d;
    });
    maxDur = Math.max(maxDur, values.length - 1 - curStart);
    return { series: dd, maxDrawdown: mdd, peakIndex: mddPeak, troughIndex: mddTrough, maxDurationDays: maxDur, current: -dd[dd.length - 1] };
  }
  function downsideDeviation(r, mar) { let s = 0; for (let i = 0; i < r.length; i++) { const d = Math.min(r[i] - (mar || 0), 0); s += d * d; } return Math.sqrt(s / r.length); }
  function beta(rp, rb) { const mp = mean(rp), mb = mean(rb); let c = 0, v = 0; for (let i = 0; i < rp.length; i++) { c += (rp[i] - mp) * (rb[i] - mb); v += (rb[i] - mb) * (rb[i] - mb); } return c / v; }
  function skewKurt(r) { const m = mean(r), s = std(r), n = r.length; let a = 0, b = 0; for (let i = 0; i < n; i++) { const z = (r[i] - m) / s; a += z * z * z; b += z * z * z * z; } return { skew: a / n, excessKurtosis: b / n - 3 }; }

  /* Full performance and risk summary of a daily log return series vs an optional benchmark. rf annual. */
  function summary(rp, rb, rf) {
    rf = rf || 0;
    const annRet = Math.exp(mean(rp) * N_YEAR) - 1;      // geometric, since inputs are log returns
    const vol = std(rp) * Math.sqrt(N_YEAR);
    const rfd = rf / N_YEAR;
    const dsd = downsideDeviation(rp, rfd) * Math.sqrt(N_YEAR);
    const values = [1]; rp.forEach(function (r) { values.push(values[values.length - 1] * Math.exp(r)); });
    const dd = drawdown(values);
    let gains = 0, losses = 0; rp.forEach(function (r) { gains += Math.max(r - rfd, 0); losses += Math.max(rfd - r, 0); });
    const out = {
      annReturn: annRet, vol: vol, sharpe: (annRet - rf) / vol, sortino: (annRet - rf) / dsd, downsideDev: dsd,
      maxDrawdown: dd.maxDrawdown, drawdown: dd, calmar: annRet / dd.maxDrawdown, omega: gains / losses,
      skew: skewKurt(rp).skew, excessKurtosis: skewKurt(rp).excessKurtosis, values: values,
      bestDay: Math.max.apply(null, rp), worstDay: Math.min.apply(null, rp)
    };
    if (rb) {
      const b = beta(rp, rb), annB = Math.exp(mean(rb) * N_YEAR) - 1, volB = std(rb) * Math.sqrt(N_YEAR);
      const active = rp.map(function (r, i) { return r - rb[i]; });
      const te = std(active) * Math.sqrt(N_YEAR);
      let upP = 0, upB = 0, dnP = 0, dnB = 0;
      rb.forEach(function (r, i) { if (r > 0) { upP += rp[i]; upB += r; } else if (r < 0) { dnP += rp[i]; dnB += r; } });
      Object.assign(out, {
        beta: b, benchReturn: annB, benchVol: volB, trackingError: te, infoRatio: (annRet - annB) / te,
        treynor: (annRet - rf) / b, alpha: annRet - (rf + b * (annB - rf)),
        upCapture: upP / upB, downCapture: dnP / dnB, m2: rf + out.sharpe * volB,
        correlation: b * volB / vol
      });
    }
    return out;
  }

  // ---- Stress testing: beta scaled index shocks plus historical style scenarios ----
  const STRESS = [
    { name: "Equity crash", shock: -0.30, note: "Broad equities fall 30%" },
    { name: "2008 style crisis", shock: -0.45, note: "Peak to trough of global equities, 2007 to 2009" },
    { name: "2020 Covid sell off", shock: -0.34, note: "Global equities, 19 Feb to 23 Mar 2020" },
    { name: "2022 rate shock", shock: -0.25, note: "Equity drawdown during the 2022 hiking cycle" },
    { name: "Correction", shock: -0.10, note: "Ordinary 10% market correction" },
    { name: "Relief rally", shock: 0.15, note: "Market gains 15%" }
  ];
  function stress(betas, w, value) {
    return STRESS.map(function (s) {
      const byAsset = betas.map(function (b, i) { return w[i] * b * s.shock * value; });
      return { name: s.name, note: s.note, shock: s.shock, pnl: byAsset.reduce(function (a, b) { return a + b; }, 0), byAsset: byAsset };
    });
  }

  // ---- Optimisation ----
  function projectSimplex(v, cap) { // projection onto {w >= 0, sum w = 1, w <= cap}
    const n = v.length; cap = cap || 1;
    let lo = Math.min.apply(null, v) - 1, hi = Math.max.apply(null, v);
    for (let k = 0; k < 60; k++) {
      const tau = (lo + hi) / 2; let s = 0;
      for (let i = 0; i < n; i++) s += Math.min(cap, Math.max(0, v[i] - tau));
      if (s > 1) lo = tau; else hi = tau;
    }
    const tau = (lo + hi) / 2;
    return v.map(function (x) { return Math.min(cap, Math.max(0, x - tau)); });
  }
  /* Long only MVO: maximise w'mu - (lambda/2) w'Cw by projected gradient ascent. mu and C annualised. */
  function mvo(mu, C, lambda, cap, w0) {
    const n = mu.length; let w = w0 ? w0.slice() : new Array(n).fill(1 / n);
    let tr = 0; for (let i = 0; i < n; i++) tr += C[i][i];
    const step = 1 / (Math.max(lambda, 1e-6) * tr + 1e-9);
    for (let it = 0; it < 4000; it++) {
      const g = matVec(C, w).map(function (v, i) { return mu[i] - lambda * v; });
      const nw = projectSimplex(w.map(function (wi, i) { return wi + step * g[i]; }), cap);
      let diff = 0; for (let i = 0; i < n; i++) diff += Math.abs(nw[i] - w[i]);
      w = nw; if (diff < 1e-10) break;
    }
    return w;
  }
  function minVariance(C, cap) { return mvo(new Array(C.length).fill(0), C, 1, cap); }
  function stats(mu, C, w, rf) { const r = dot(w, mu), v = portVol(C, w); return { ret: r, vol: v, sharpe: (r - (rf || 0)) / v }; }
  function frontier(mu, C, rf, cap, points) {
    points = points || 40; const out = []; let w = null, best = null;
    for (let k = 0; k < points; k++) {
      const lambda = Math.exp(Math.log(0.5) + (Math.log(400) - Math.log(0.5)) * k / (points - 1));
      w = mvo(mu, C, lambda, cap, w);
      const s = stats(mu, C, w, rf); s.w = w.slice(); s.lambda = lambda; out.push(s);
      if (!best || s.sharpe > best.sharpe) best = s;
    }
    // refine the tangency portfolio around the best lambda
    for (let k = -10; k <= 10; k++) {
      const lambda = best.lambda * Math.exp(k * 0.03); const ww = mvo(mu, C, lambda, cap, best.w); const s = stats(mu, C, ww, rf);
      if (s.sharpe > best.sharpe) { best = s; best.w = ww; best.lambda = lambda; }
    }
    const mv = minVariance(C, cap); const mvs = stats(mu, C, mv, rf); mvs.w = mv;
    return { points: out, maxSharpe: best, minVar: mvs };
  }
  function riskParity(C) {
    const n = C.length; let w = C.map(function (row, i) { return 1 / Math.sqrt(row[i]); });
    let s = w.reduce(function (a, b) { return a + b; }, 0); w = w.map(function (x) { return x / s; });
    for (let it = 0; it < 2000; it++) {
      const sw = matVec(C, w), sp2 = dot(w, sw);
      const nw = w.map(function (wi, i) { return 0.5 * wi + 0.5 * (sp2 / n) / sw[i]; });
      s = nw.reduce(function (a, b) { return a + b; }, 0);
      const nn = nw.map(function (x) { return x / s; });
      let diff = 0; for (let i = 0; i < n; i++) diff += Math.abs(nn[i] - w[i]);
      w = nn; if (diff < 1e-12) break;
    }
    return w;
  }

  const api = { N_YEAR, mean, std, variance, dot, matVec, percentile, zScore, logReturns, align, covMatrix, corrMatrix, cholesky, portfolioReturns, portVol,
    parametricVar, historicalVar, cvarEmpirical, cvarParametric, marginalVar, componentVar, riskContribution, monteCarloVar,
    drawdown, downsideDeviation, beta, summary, STRESS, stress, projectSimplex, mvo, minVariance, stats, frontier, riskParity };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RISK = api;
})(typeof window !== "undefined" ? window : this);
