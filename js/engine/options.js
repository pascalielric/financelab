/* Options engine: Black Scholes and Black 76 prices and Greeks, a Cox Ross Rubinstein binomial tree
   (European and American), implied volatility, put call parity forwards and an SVI fit of the smile.
   Plain functions, no DOM; the website and the Excel pricer use the same formulas. */
(function (root) {
  "use strict";
  const SQ2PI = Math.sqrt(2 * Math.PI);
  function pdf(x) { return Math.exp(-0.5 * x * x) / SQ2PI; }
  // Cumulative normal: West (2005) / Hart double precision algorithm, accurate to about 1e-15
  function cdf(x) {
    const z = Math.abs(x);
    let c;
    if (z > 37) c = 0;
    else {
      const e = Math.exp(-z * z / 2);
      if (z < 7.07106781186547) {
        let n = 3.52624965998911e-02 * z + 0.700383064443688; n = n * z + 6.37396220353165; n = n * z + 33.912866078383; n = n * z + 112.079291497871; n = n * z + 221.213596169931; n = n * z + 220.206867912376;
        let d = 8.83883476483184e-02 * z + 1.75566716318264; d = d * z + 16.064177579207; d = d * z + 86.7807322029461; d = d * z + 296.564248779674; d = d * z + 637.333633378831; d = d * z + 793.826512519948; d = d * z + 440.413735824752;
        c = e * n / d;
      } else {
        let b = z + 0.65; b = z + 4 / b; b = z + 3 / b; b = z + 2 / b; b = z + 1 / b;
        c = e / b / 2.506628274631;
      }
    }
    return x > 0 ? 1 - c : c;
  }

  /* Black Scholes Merton with continuous dividend yield q. type "call" or "put".
     Theta per calendar day, vega and rho per 1 percentage point. */
  function bs(S, K, T, r, q, v, type) {
    const call = type !== "put";
    if (T <= 0 || v <= 0) {
      const intr = Math.max(call ? S - K : K - S, 0);
      return { price: intr, delta: call ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, vega: 0, theta: 0, rho: 0, d1: NaN, d2: NaN };
    }
    const sT = v * Math.sqrt(T), d1 = (Math.log(S / K) + (r - q + 0.5 * v * v) * T) / sT, d2 = d1 - sT;
    const dq = Math.exp(-q * T), dr = Math.exp(-r * T);
    const price = call ? S * dq * cdf(d1) - K * dr * cdf(d2) : K * dr * cdf(-d2) - S * dq * cdf(-d1);
    const delta = call ? dq * cdf(d1) : -dq * cdf(-d1);
    const gamma = dq * pdf(d1) / (S * sT);
    const vega = S * dq * pdf(d1) * Math.sqrt(T) / 100;
    const thetaY = call ? -S * dq * pdf(d1) * v / (2 * Math.sqrt(T)) - r * K * dr * cdf(d2) + q * S * dq * cdf(d1)
                        : -S * dq * pdf(d1) * v / (2 * Math.sqrt(T)) + r * K * dr * cdf(-d2) - q * S * dq * cdf(-d1);
    const rho = (call ? K * T * dr * cdf(d2) : -K * T * dr * cdf(-d2)) / 100;
    return { price: price, delta: delta, gamma: gamma, vega: vega, theta: thetaY / 365, rho: rho, d1: d1, d2: d2 };
  }

  // Black 76 on the forward F with discount factor DF: the market convention once F and DF come from put call parity
  function black(F, K, T, DF, v, type) {
    if (T <= 0 || v <= 0) return DF * Math.max(type === "put" ? K - F : F - K, 0);
    const sT = v * Math.sqrt(T), d1 = (Math.log(F / K) + 0.5 * v * v * T) / sT, d2 = d1 - sT;
    return type === "put" ? DF * (K * cdf(-d2) - F * cdf(-d1)) : DF * (F * cdf(d1) - K * cdf(d2));
  }

  // Implied volatility from Black 76 by safeguarded Newton on vega with bisection fallback
  function impliedVol(price, F, K, T, DF, type) {
    const intr = DF * Math.max(type === "put" ? K - F : F - K, 0), upper = DF * (type === "put" ? K : F);
    if (!(price > intr + 1e-10) || price >= upper) return null;
    let lo = 1e-4, hi = 5, v = 0.3;
    for (let i = 0; i < 100; i++) {
      const p = black(F, K, T, DF, v, type), diff = p - price;
      if (Math.abs(diff) < 1e-10) return v;
      if (diff > 0) hi = v; else lo = v;
      const sT = v * Math.sqrt(T), d1 = (Math.log(F / K) + 0.5 * v * v * T) / sT;
      const vega = DF * F * pdf(d1) * Math.sqrt(T);
      let nv = vega > 1e-12 ? v - diff / vega : (lo + hi) / 2;
      if (!(nv > lo && nv < hi)) nv = (lo + hi) / 2;
      if (Math.abs(nv - v) < 1e-12) return nv;
      v = nv;
    }
    return v;
  }

  /* Cox Ross Rubinstein binomial tree. american = true allows early exercise at every node. */
  function crr(S, K, T, r, q, v, N, type, american) {
    const dt = T / N, u = Math.exp(v * Math.sqrt(dt)), d = 1 / u, disc = Math.exp(-r * dt);
    const p = (Math.exp((r - q) * dt) - d) / (u - d);
    const call = type !== "put";
    const vals = new Float64Array(N + 1);
    for (let j = 0; j <= N; j++) {
      const ST = S * Math.pow(u, j) * Math.pow(d, N - j);
      vals[j] = Math.max(call ? ST - K : K - ST, 0);
    }
    for (let i = N - 1; i >= 0; i--) {
      for (let j = 0; j <= i; j++) {
        let cont = disc * (p * vals[j + 1] + (1 - p) * vals[j]);
        if (american) {
          const ST = S * Math.pow(u, j) * Math.pow(d, i - j);
          cont = Math.max(cont, call ? ST - K : K - ST);
        }
        vals[j] = cont;
      }
    }
    return { price: vals[0], u: u, d: d, p: p };
  }

  // Mid price of a quote [strike, bid, ask, last, volume, oi, yahooIV]; falls back to last when the book is empty
  function mid(row) {
    const bid = row[1], ask = row[2], last = row[3];
    if (bid > 0 && ask > 0 && ask >= bid) return { px: (bid + ask) / 2, src: "mid", spread: (ask - bid) / ((ask + bid) / 2) };
    if (last > 0) return { px: last, src: "last", spread: null };
    return null;
  }

  /* Put call parity: C - P = DF * (F - K). A least squares line of (C - P) on K near the money gives
     slope -DF and intercept DF * F, so the market implies both the discount factor and the forward. */
  function parity(chain, spot) {
    const puts = {}; chain.puts.forEach(function (p) { puts[p[0]] = p; });
    const pts = [];
    chain.calls.forEach(function (c) {
      const p = puts[c[0]]; if (!p) return;
      const k = c[0]; if (k < 0.85 * spot || k > 1.15 * spot) return;
      const mc = mid(c), mp = mid(p); if (!mc || !mp) return;
      pts.push([k, mc.px - mp.px]);
    });
    if (pts.length < 3) return null;
    const n = pts.length, sx = pts.reduce(function (s, x) { return s + x[0]; }, 0), sy = pts.reduce(function (s, x) { return s + x[1]; }, 0);
    const sxx = pts.reduce(function (s, x) { return s + x[0] * x[0]; }, 0), sxy = pts.reduce(function (s, x) { return s + x[0] * x[1]; }, 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
    const DF = -slope, F = icpt / DF;
    const res = pts.map(function (x) { return x[1] - (icpt + slope * x[0]); });
    const rmse = Math.sqrt(res.reduce(function (s, e) { return s + e * e; }, 0) / n);
    return { DF: DF, F: F, n: n, rmse: rmse, pts: pts };
  }

  /* One expiry slice: forward and discount factor from parity (sanity bounded, else from the rate and dividend
     yield), then implied volatility from out of the money options: puts below the forward, calls above. */
  function slice(chain, spot, T, rate, divYield) {
    const par = parity(chain, spot);
    // Discount factor from the Treasury bill rate (robust for short expiries, where parity is too noisy to pin down
    // a rate); the forward from put call parity near the money given that discount factor, as a median across strikes.
    const DF = Math.exp(-rate * T), Fm = spot * Math.exp((rate - divYield) * T);
    let F = Fm, source = "rate and dividend yield";
    if (par) {
      const est = par.pts.map(function (x) { return x[0] + x[1] / DF; }).sort(function (a, b) { return a - b; });
      const med = est[Math.floor(est.length / 2)];
      if (Math.abs(med / Fm - 1) < 0.01 + 0.03 * Math.sqrt(T)) { F = med; source = "put call parity"; }
    }
    const pts = [];
    const use = function (rows, type) {
      rows.forEach(function (row) {
        const K = row[0];
        if (type === "put" && K > F) return;
        if (type === "call" && K < F) return;
        const m = mid(row); if (!m || m.px < 0.05) return;
        if (m.spread != null && m.spread > 0.6) return;
        const iv = impliedVol(m.px, F, K, T, DF, type);
        if (iv == null || iv < 0.02 || iv > 3) return;
        pts.push({ K: K, k: Math.log(K / F), iv: iv, type: type, src: m.src, yahoo: row[6], vol: row[4], oi: row[5] });
      });
    };
    use(chain.puts, "put"); use(chain.calls, "call");
    pts.sort(function (a, b) { return a.K - b.K; });
    const impliedRate = par && par.DF > 0 ? -Math.log(par.DF) / T : null;
    return { F: F, DF: DF, source: source, parity: par, impliedRate: impliedRate, carry: Math.log(F / spot) / T, pts: pts };
  }

  // Raw SVI total variance w(k) = a + b (rho (k - m) + sqrt((k - m)^2 + s^2))
  function sviW(p, k) { const x = k - p.m; return p.a + p.b * (p.rho * x + Math.sqrt(x * x + p.s * p.s)); }

  // Nelder Mead minimiser
  function nelderMead(f, x0, steps, iters) {
    const n = x0.length;
    let simplex = [x0.slice()];
    for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += steps[i]; simplex.push(x); }
    let vals = simplex.map(f);
    for (let it = 0; it < (iters || 600); it++) {
      const idx = vals.map(function (v, i) { return i; }).sort(function (a, b) { return vals[a] - vals[b]; });
      simplex = idx.map(function (i) { return simplex[i]; }); vals = idx.map(function (i) { return vals[i]; });
      const c = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
      const xr = c.map(function (v, j) { return v + (v - simplex[n][j]); }), fr = f(xr);
      if (fr < vals[0]) {
        const xe = c.map(function (v, j) { return v + 2 * (v - simplex[n][j]); }), fe = f(xe);
        if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
      } else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
      else {
        const xc = c.map(function (v, j) { return v + 0.5 * (simplex[n][j] - v); }), fc = f(xc);
        if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; }
        else {
          for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map(function (v, j) { return simplex[0][j] + 0.5 * (v - simplex[0][j]); }); vals[i] = f(simplex[i]); }
        }
      }
      if (Math.abs(vals[n] - vals[0]) < 1e-14) break;
    }
    return { x: simplex[0], f: vals[0] };
  }

  /* Fit SVI to one slice by least squares on total variance, weighted towards the money.
     Constraints by penalty: b >= 0, |rho| < 1, s > 0, and a + b s sqrt(1 - rho^2) >= 0 (no negative variance). */
  function fitSvi(pts, T) {
    if (pts.length < 5) return null;
    const data = pts.map(function (p) { return { k: p.k, w: p.iv * p.iv * T, wt: 1 / (0.05 + Math.abs(p.k)) }; });
    const atm = data.reduce(function (b, d) { return Math.abs(d.k) < Math.abs(b.k) ? d : b; }, data[0]);
    const obj = function (x) {
      const p = { a: x[0], b: Math.exp(x[1]), rho: Math.tanh(x[2]), m: x[3], s: Math.exp(x[4]) };
      let e = 0; data.forEach(function (d) { const r = sviW(p, d.k) - d.w; e += d.wt * r * r; });
      const minW = p.a + p.b * p.s * Math.sqrt(1 - p.rho * p.rho);
      if (minW < 0) e += 1e3 * minW * minW;
      return e;
    };
    let best = null;
    [[-0.5, 0.05], [-0.8, 0.1], [-0.2, 0.2]].forEach(function (g) {
      const x0 = [atm.w * 0.5, Math.log(Math.max(atm.w, 1e-4) * 2), Math.atanh(g[0]), 0, Math.log(g[1])];
      const r = nelderMead(obj, x0, [atm.w * 0.3 + 1e-4, 0.5, 0.3, 0.05, 0.5], 1500);
      if (!best || r.f < best.f) best = r;
    });
    const x = best.x;
    const p = { a: x[0], b: Math.exp(x[1]), rho: Math.tanh(x[2]), m: x[3], s: Math.exp(x[4]) };
    const rmse = Math.sqrt(pts.reduce(function (s, q) { const iv = Math.sqrt(Math.max(sviW(p, q.k), 1e-10) / T); return s + (iv - q.iv) * (iv - q.iv); }, 0) / pts.length);
    p.rmse = rmse;
    return p;
  }
  function sviVol(p, k, T) { return Math.sqrt(Math.max(sviW(p, k), 1e-10) / T); }

  const api = { pdf: pdf, cdf: cdf, bs: bs, black: black, impliedVol: impliedVol, crr: crr, mid: mid, parity: parity, slice: slice, fitSvi: fitSvi, sviVol: sviVol, sviW: sviW, nelderMead: nelderMead };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Options = api;
})(typeof window !== "undefined" ? window : this);
