/* Earnings scenario engine: turns an earnings briefing (consensus, beat / miss record, past price reactions)
   into bull, base and bear cases with probabilities and a prediction.
   Briefing structure follows the earnings-preview skill of github.com/himself65/finance-skills. */
(function (root) {
  "use strict";
  function mean(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
  function sd(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1)); }
  function cdf(x) { // standard normal CDF, Abramowitz and Stegun 7.1.26
    const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804 * Math.exp(-x * x / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }
  function clip(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function analyse(d) {
    const q = (d.eps && d.eps.quarter) || {};
    const consensus = q.avg;
    // Surprise record: prefer the event study rows (they carry the price reaction), else the plain history
    const ev = (d.reactions || []).filter(function (r) { return r.surprisePct != null; });
    const hist = ev.length >= 3 ? ev.map(function (r) { return r.surprisePct; }) : (d.history || []).filter(function (h) { return h.surprisePct != null; }).map(function (h) { return h.surprisePct; });
    const n = hist.length, beats = hist.filter(function (s) { return s > 0; }).length;
    const mSur = mean(hist), sSur = Math.max(sd(hist), 0.02);
    const expSur = 0.5 * mSur;                               // shrink the historical average half way to zero
    const pBeatEmp = n ? (beats + 1) / (n + 2) : 0.5;        // Laplace smoothed beat rate
    const pBeatModel = 1 - cdf((0 - expSur) / sSur);
    const pBeat = n ? 0.5 * (pBeatEmp + pBeatModel) : 0.5;

    // Price reaction model: move = a + b * surprise, fitted on past reports when there are enough of them
    const moves = (d.reactions || []).map(function (r) { return r.move1d; }).filter(function (v) { return v != null; });
    const absMove = moves.length ? mean(moves.map(Math.abs)) : 0.045;
    let a = 0, b = absMove / Math.max(mean(hist.map(Math.abs)), 0.02), fitted = false, r2 = null;
    if (ev.length >= 4) {
      const xs = ev.map(function (r) { return r.surprisePct; }), ys = ev.map(function (r) { return r.move1d; });
      const mx = mean(xs), my = mean(ys);
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
      if (sxx > 0 && sxy / sxx > 0) { b = sxy / sxx; a = my - b * mx; fitted = true; r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : null; }
    }
    const react = function (s) { return clip(a + b * s, -2.5 * absMove, 2.5 * absMove); };

    // Scenarios are regions of the surprise distribution N(expSur, sSur):
    //   bear = miss (surprise below zero), bull = beat by more than the company's usual margin, base = in between.
    // Scenario EPS is the conditional mean of the surprise inside each region (truncated normal).
    const pdf = function (x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); };
    const thrBull = Math.max(mSur, expSur + 0.5 * sSur, 0.01);
    const zb = (0 - expSur) / sSur, zu = (thrBull - expSur) / sSur;
    const mBear = cdf(zb), mBull = 1 - cdf(zu), mBase = Math.max(1e-6, 1 - mBear - mBull);
    const sBear = expSur - sSur * pdf(zb) / Math.max(mBear, 1e-6);
    const sBull = expSur + sSur * pdf(zu) / Math.max(mBull, 1e-6);
    const sBase = expSur + sSur * (pdf(zb) - pdf(zu)) / mBase;
    // Probabilities: the miss probability is 1 - pBeat (which blends the model with the empirical beat rate);
    // the beat probability is split between base and bull in the model's proportions.
    const pBear = 1 - pBeat, pBull = pBeat * mBull / (mBull + mBase), pBase = pBeat - pBull;

    const price = d.price;
    const mk = function (key, label, s, p, story) {
      const mv = react(s);
      return { key: key, label: label, surprise: s, eps: consensus != null ? consensus * (1 + s) : null, prob: p, move: mv, price: price != null ? price * (1 + mv) : null, story: story };
    };
    const scenarios = [
      mk("bull", "Bull", sBull, pBull, "Beat by more than the company's usual margin, the kind of result that comes with a guidance raise"),
      mk("base", "Base", sBase, pBase, "Result in line with or modestly ahead of consensus, as the market has come to expect"),
      mk("bear", "Bear", sBear, pBear, "Reported EPS below consensus, often with cautious guidance")
    ];
    const expMove = scenarios.reduce(function (s, x) { return s + x.prob * x.move; }, 0);

    // Twelve month view: forward EPS range times a P/E multiple that re rates with the outcome
    const y = (d.eps && (d.eps.nextYear || d.eps.year)) || {};
    const pe = d.forwardPE || (d.trailingPE ? d.trailingPE * 0.9 : null);
    let twelve = null;
    if (pe && y.avg) {
      twelve = [
        { key: "bull", label: "Bull", eps: y.high || y.avg * 1.08, pe: pe * 1.10 },
        { key: "base", label: "Base", eps: y.avg, pe: pe },
        { key: "bear", label: "Bear", eps: y.low || y.avg * 0.92, pe: pe * 0.85 }
      ].map(function (t) { t.value = t.eps * t.pe; t.upside = price ? t.value / price - 1 : null; return t; });
    }

    const spread = q.high != null && q.low != null && consensus ? (q.high - q.low) / Math.abs(consensus) : null;
    const lean = expMove > 0.01 ? "Positive" : expMove < -0.01 ? "Negative" : "Neutral";
    const conf = n >= 8 && fitted ? "Medium" : "Low";
    return {
      consensus: consensus, n: n, beats: beats, beatRate: n ? beats / n : null, meanSurprise: mSur, sdSurprise: sSur, expSurprise: expSur,
      pBeat: pBeat, absMove: absMove, impliedRange: [price * (1 - absMove), price * (1 + absMove)], reaction: { a: a, b: b, fitted: fitted, r2: r2, n: ev.length },
      scenarios: scenarios, expMove: expMove, expPrice: price * (1 + expMove), twelve: twelve, spread: spread, lean: lean, confidence: conf,
      predictedEps: consensus != null ? consensus * (1 + expSur) : null
    };
  }

  const api = { analyse: analyse, cdf: cdf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EARN = api;
})(typeof window !== "undefined" ? window : this);
