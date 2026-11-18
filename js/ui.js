/* Shared UI: header, footer, formatting, tables, charts, math helpers, data key modal. */
(function () {
  "use strict";
  const PAGES = [
    ["index.html", "Home"], ["dcf.html", "DCF"], ["lbo.html", "LBO"], ["monte-carlo.html", "Monte Carlo"],
    ["portfolio.html", "Portfolio Risk"], ["earnings.html", "Earnings"]
  ];

  function header() {
    const here = location.pathname.split("/").pop() || "index.html";
    const cfg = window.SITE_CONFIG || {};
    const el = document.createElement("header");
    el.className = "topbar";
    el.innerHTML = '<div class="topbar-in"><a class="brand" href="index.html">' + esc(cfg.ownerName || "Finance") + ' <span>&nbsp;&middot;&nbsp; ' + esc(cfg.siteName || "Finance Lab") + '</span></a><nav class="nav">' +
      PAGES.map(function (p) { return '<a href="' + p[0] + '"' + (p[0] === here ? ' class="active"' : "") + ">" + p[1] + "</a>"; }).join("") +
      '</nav><button class="mkt" id="dataPill" title="Daily closing prices from Yahoo Finance, refreshed every weekday. Click to add live data keys.">' +
      '<span class="mkt-k" id="mktK">Swiss Market Index</span><span class="mkt-v" id="mktV">&nbsp;</span></button></div>';
    document.body.prepend(el);
    refreshPill();
    document.getElementById("dataPill").onclick = keyModal;
  }
  function refreshPill() {
    const pill = document.getElementById("dataPill");
    if (!pill || !window.API) return;
    const K = document.getElementById("mktK"), V = document.getElementById("mktV");
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = function (iso) { const d = iso.slice(0, 10).split("-"); return (+d[2]) + " " + MON[+d[1] - 1] + " " + d[0]; };
    const live = API.hasLive();
    K.textContent = live ? "Live data connected" : "Demo data";
    API.localQuote("^SSMI").then(function (q) {
      if (q) {
        K.textContent = "SMI \u00b7 " + (live ? "live keys on \u00b7 " : "") + "close " + day(q.date);
        const ch = q.pct * 100, sign = ch >= 0 ? "+" : "\u2212";
        V.innerHTML = '<b>' + q.price.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/'/g, "\u2019") + '</b>' +
          '<i class="' + (ch >= 0 ? "up" : "dn") + '">' + sign + Math.abs(ch).toFixed(2) + '%</i>';
        return;
      }
      return API.localIndex().then(function (ix) {
        if (ix && ix.updated) { K.textContent = "Market data"; V.innerHTML = "<b>Close " + day(ix.updated) + "</b>"; }
      });
    });
  }

  function footer() {
    const cfg = window.SITE_CONFIG || {};
    const links = [];
    if (cfg.email) links.push('<a href="mailto:' + esc(cfg.email) + '">' + esc(cfg.email) + "</a>");
    if (cfg.linkedin) links.push('<a href="' + esc(cfg.linkedin) + '">LinkedIn</a>');
    if (cfg.github) links.push('<a href="' + esc(cfg.github) + '">GitHub</a>');
    const f = document.createElement("footer");
    f.innerHTML = '<div class="wrap"><div class="row" style="justify-content:space-between"><div><strong>' + esc(cfg.ownerName || "") + "</strong> · " + esc(cfg.ownerTitle || "") +
      (links.length ? " · " + links.join(" · ") : "") + '</div><div>Built with plain HTML, JavaScript and Plotly. Market data: Yahoo Finance (daily refresh), Finnhub and Twelve Data (live, optional).</div></div>' +
      '<p class="note" style="margin-top:10px">Educational portfolio project. Nothing on this site is investment advice or a recommendation to buy or sell any security. Company figures are taken from public filings; projections are the author&#39;s own assumptions.</p></div>';
    document.body.appendChild(f);
  }

  function keyModal() {
    const k = API.keys();
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = '<div class="modal"><h3>Live market data</h3><p>This site uses two free data providers. Keys you enter here stay in your browser only.</p>' +
      '<div class="ctl"><label>Finnhub key <a href="https://finnhub.io/register" target="_blank" rel="noopener">get one</a></label><input id="kFh" type="text" value="' + esc(k.finnhub) + '" placeholder="quotes, earnings, profiles"></div><br>' +
      '<div class="ctl"><label>Twelve Data key <a href="https://twelvedata.com/register" target="_blank" rel="noopener">get one</a></label><input id="kTd" type="text" value="' + esc(k.twelve) + '" placeholder="daily price history"></div>' +
      '<p class="note">Without keys, price history tools run on simulated demo prices and are labelled as such. Free plans cover mainly US listings, so use US tickers or ADRs (for example NSRGY for Nestle).</p>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn ghost" id="kCancel">Cancel</button><button class="btn" id="kSave">Save and reload</button></div></div>';
    document.body.appendChild(bg);
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    document.getElementById("kCancel").onclick = function () { bg.remove(); };
    document.getElementById("kSave").onclick = function () {
      API.setKeys({ finnhub: document.getElementById("kFh").value.trim(), twelve: document.getElementById("kTd").value.trim() });
      location.reload();
    };
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(v, d) { if (v == null || !isFinite(v)) return "n.a."; d = d == null ? 0 : d; const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, "’"); return v < 0 ? "(" + s + ")" : s; }
  function pct(v, d) { if (v == null || !isFinite(v)) return "n.a."; return (v * 100).toFixed(d == null ? 1 : d).replace(/^-/, "\u2212") + "%"; }
  function mult(v, d) { if (v == null || !isFinite(v)) return "n.a."; return v.toFixed(d == null ? 1 : d) + "x"; }
  function signPct(v, d) { if (v == null || !isFinite(v)) return "n.a."; return (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d == null ? 1 : d) + "%"; }
  function cls(v) { return v >= 0 ? "pos" : "neg"; }

  /* Simple table: cols = [{h, n(umeric), f(row)}], rows = array, opts.rowClass(row) */
  function table(el, cols, rows, opts) {
    opts = opts || {};
    let h = '<div class="table-wrap"><table' + (opts.cls ? ' class="' + opts.cls + '"' : "") + "><thead><tr>" +
      cols.map(function (c) { return "<th" + (c.n ? ' class="n"' : "") + ">" + c.h + "</th>"; }).join("") + "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += "<tr" + (opts.rowClass ? ' class="' + (opts.rowClass(r) || "") + '"' : "") + ">" +
        cols.map(function (c) { return "<td" + (c.n ? ' class="n"' : "") + ">" + c.f(r) + "</td>"; }).join("") + "</tr>";
    });
    h += "</tbody></table></div>";
    (typeof el === "string" ? document.getElementById(el) : el).innerHTML = h;
  }

  /* Financial statement style table: header years, lines = [{label, vals[], f, cls}] */
  function fin(el, heads, lines, estFrom) {
    let h = '<div class="table-wrap"><table><thead><tr><th></th>' + heads.map(function (y, i) { return '<th class="n">' + y + "</th>"; }).join("") + "</tr></thead><tbody>";
    lines.forEach(function (l) {
      h += '<tr class="' + (l.cls || "") + '"><td>' + l.label + "</td>" + l.vals.map(function (v, i) {
        return '<td class="n' + (estFrom != null && i >= estFrom ? " est" : "") + '">' + (v === "" || v == null ? "" : (l.f ? l.f(v) : fmt(v))) + "</td>";
      }).join("") + "</tr>";
    });
    h += "</tbody></table></div>";
    (typeof el === "string" ? document.getElementById(el) : el).innerHTML = h;
  }

  function sens(el, rowLabel, colLabel, rowVals, colVals, grid, rf, cf, vf, baseR, baseC, colorFn) {
    let h = '<div class="table-wrap"><table class="sens"><thead><tr><th class="corner">' + rowLabel + " ↓ / " + colLabel + " →</th>" +
      colVals.map(function (c) { return '<th class="n">' + cf(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
    grid.forEach(function (row, i) {
      h += "<tr><th>" + rf(rowVals[i]) + "</th>" + row.map(function (v, j) {
        const st = colorFn ? ' style="background:' + colorFn(v) + '"' : "";
        return '<td class="n' + (i === baseR && j === baseC ? " base" : "") + '"' + st + ">" + vf(v) + "</td>";
      }).join("") + "</tr>";
    });
    h += "</tbody></table></div>";
    document.getElementById(el).innerHTML = h;
  }
  function heat(v, lo, mid, hi) {
    if (!isFinite(v)) return "#fff";
    const t = v >= mid ? Math.min(1, (v - mid) / (hi - mid || 1)) : -Math.min(1, (mid - v) / (mid - lo || 1));
    if (t >= 0) return "rgba(47,74,54," + (0.05 + 0.22 * t).toFixed(2) + ")";
    return "rgba(122,30,30," + (0.05 + 0.22 * -t).toFixed(2) + ")";
  }

  // Plotly defaults: one typeface, warm greys, oxblood only where it carries meaning
  const INK = "#111111", MUTED = "#6E6A61", RULE = "#E4DFD3", NEG = "#7A1E1E", POS = "#2F4A36", BRASS = "#8C6D3F";
  const COLORS = [INK, "#8C877C", NEG, "#4A4A4A", "#B9B3A6", POS, BRASS, "#5E5A52", "#CFC9BC", "#2E2E2E"];
  const FONT = "Times New Roman, Times, Liberation Serif, serif";
  function axis(extra) { return Object.assign({ gridcolor: RULE, zerolinecolor: "#BDB7AA", linecolor: "#BDB7AA", tickfont: { size: 13 }, title: { font: { size: 13, color: MUTED } }, automargin: true }, extra || {}); }
  function layout(extra) {
    extra = extra || {};
    const out = Object.assign({
      font: { family: FONT, size: 13, color: "#2E2E2E" },
      margin: { l: 60, r: 24, t: 24, b: 48 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      separators: ".\u2019", legend: { orientation: "h", y: -0.2, font: { size: 13 } }, colorway: COLORS,
      hoverlabel: { font: { family: FONT, size: 13 }, bgcolor: "#FCFBF8", bordercolor: INK }
    }, extra);
    ["xaxis", "yaxis", "yaxis2", "xaxis2"].forEach(function (k) {
      if (k in extra || k === "xaxis" || k === "yaxis") {
        const e = extra[k] || {};
        if (typeof e.title === "string") e.title = { text: e.title };
        out[k] = axis(e);
        if (e.title) out[k].title = Object.assign({ font: { size: 13, color: MUTED } }, e.title);
      }
    });
    return out;
  }
  function plot(id, data, lay) { Plotly.react(id, data, layout(lay), { displayModeBar: false, responsive: true }); }

  // Math helpers
  function rng(seed) { let s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function std(a) { const m = mean(a); return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1)); }
  function quantile(sorted, q) { const pos = (sorted.length - 1) * q, b = Math.floor(pos), r = pos - b; return sorted[b + 1] !== undefined ? sorted[b] + r * (sorted[b + 1] - sorted[b]) : sorted[b]; }
  function covMatrix(R) { // R: assets x T
    const n = R.length, T = R[0].length, m = R.map(mean);
    const C = [];
    for (let i = 0; i < n; i++) { C.push([]); for (let j = 0; j < n; j++) { let s = 0; for (let t = 0; t < T; t++) s += (R[i][t] - m[i]) * (R[j][t] - m[j]); C[i].push(s / (T - 1)); } }
    return C;
  }
  function cholesky(A) {
    const n = A.length, L = A.map(function () { return new Array(n).fill(0); });
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12)); else L[i][j] = s / L[j][j];
    }
    return L;
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  document.addEventListener("DOMContentLoaded", function () { header(); footer(); });
  window.UI = { INK, MUTED, NEG, POS, BRASS, RULE, FONT, esc, fmt, pct, mult, signPct, cls, table, fin, sens, heat, plot, layout, COLORS, rng, gauss, mean, std, quantile, covMatrix, cholesky, download, refreshPill, keyModal };
})();
