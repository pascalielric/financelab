/* Shared portfolio building blocks for the Monte Carlo and Portfolio Risk pages:
   ticker catalogue with clean names, model portfolios with plain language descriptions,
   and an editable holdings table with ticker search and "did you mean" suggestions. */
(function () {
  "use strict";

  const NAMES = {
    "NESN.SW": "Nestlé", "NOVN.SW": "Novartis", "RO.SW": "Roche", "UBSG.SW": "UBS Group", "ZURN.SW": "Zurich Insurance", "ABBN.SW": "ABB",
    "CFR.SW": "Richemont", "GIVN.SW": "Givaudan", "SIKA.SW": "Sika", "LONN.SW": "Lonza", "HOLN.SW": "Holcim", "PGHN.SW": "Partners Group",
    "TEMN.SW": "Temenos", "VACN.SW": "VAT Group", "LOGN.SW": "Logitech", "SREN.SW": "Swiss Re", "LISN.SW": "Lindt & Sprüngli", "SCMN.SW": "Swisscom",
    "ALC.SW": "Alcon", "SGSN.SW": "SGS", "GEBN.SW": "Geberit", "SLHN.SW": "Swiss Life", "KNIN.SW": "Kuehne + Nagel", "STMN.SW": "Straumann",
    "SCHP.SW": "Schindler", "BAER.SW": "Julius Baer", "SOON.SW": "Sonova", "BALN.SW": "Baloise", "SDZ.SW": "Sandoz", "HELN.SW": "Helvetia",
    "EMSN.SW": "EMS Chemie", "UHR.SW": "Swatch Group", "BCVN.SW": "Banque Cantonale Vaudoise", "SQN.SW": "Swissquote", "BUCN.SW": "Bucher Industries", "ADEN.SW": "Adecco",
    "AAPL": "Apple", "MSFT": "Microsoft", "NVDA": "Nvidia", "GOOGL": "Alphabet", "AMZN": "Amazon", "META": "Meta Platforms", "AVGO": "Broadcom",
    "ORCL": "Oracle", "ADBE": "Adobe", "CRM": "Salesforce", "NFLX": "Netflix", "TSLA": "Tesla", "AMD": "Advanced Micro Devices", "ASML": "ASML (US listing)",
    "TSM": "TSMC (US listing)", "SAP": "SAP (US listing)", "JPM": "JPMorgan Chase", "GS": "Goldman Sachs", "MS": "Morgan Stanley", "BAC": "Bank of America",
    "C": "Citigroup", "WFC": "Wells Fargo", "SCHW": "Charles Schwab", "BLK": "BlackRock", "KKR": "KKR", "BX": "Blackstone", "APO": "Apollo Global",
    "V": "Visa", "MA": "Mastercard", "JNJ": "Johnson & Johnson", "LLY": "Eli Lilly", "UNH": "UnitedHealth", "MRK": "Merck & Co", "PFE": "Pfizer",
    "NVO": "Novo Nordisk (US listing)", "PG": "Procter & Gamble", "KO": "Coca Cola", "PEP": "PepsiCo", "COST": "Costco", "WMT": "Walmart",
    "MCD": "McDonald's", "NKE": "Nike", "XOM": "ExxonMobil", "CVX": "Chevron", "CAT": "Caterpillar", "GE": "GE Aerospace", "BRK-B": "Berkshire Hathaway",
    "SPY": "S&P 500 index fund", "QQQ": "Nasdaq 100 index fund", "VT": "Global equity index fund", "VEA": "Developed markets ex US fund",
    "VWO": "Emerging markets fund", "EEM": "Emerging markets fund (iShares)", "IWM": "US small companies fund", "EFA": "Europe, Australasia, Far East fund",
    "AGG": "US aggregate bond fund", "BND": "US total bond fund", "IEF": "US Treasuries, 7 to 10 years", "TLT": "US Treasuries, 20 years and longer",
    "LQD": "US investment grade corporate bonds", "HYG": "US high yield bonds", "TIP": "US inflation linked bonds", "GLD": "Gold", "SLV": "Silver",
    "DBC": "Broad commodities", "VNQ": "US real estate", "CHSPI.SW": "Swiss equity index fund (SPI)", "^SSMI": "Swiss Market Index", "URTH": "MSCI World index fund"
  };

  /* Model portfolios. Weights in percent. */
  const PRESETS = [
    { id: "swiss", name: "Swiss blue chips", bench: "^SSMI",
      desc: "Blue chips are large, long established companies with strong balance sheets and reliable earnings. This portfolio holds ten of the largest members of the Swiss Market Index across food, pharmaceuticals, banking, insurance, industrials and luxury goods.",
      h: [["NESN.SW", 14], ["NOVN.SW", 14], ["UBSG.SW", 12], ["ZURN.SW", 10], ["ABBN.SW", 10], ["CFR.SW", 10], ["SREN.SW", 8], ["GIVN.SW", 8], ["SIKA.SW", 7], ["PGHN.SW", 7]] },
    { id: "swissdef", name: "Swiss defensive dividend", bench: "^SSMI",
      desc: "Companies whose earnings hold up in a recession, such as consumer staples, healthcare, insurance and telecoms, with above average dividends. The aim is lower volatility than the market, not the highest return.",
      h: [["NESN.SW", 20], ["NOVN.SW", 20], ["ZURN.SW", 15], ["SCMN.SW", 15], ["SREN.SW", 10], ["SLHN.SW", 10], ["LISN.SW", 10]] },
    { id: "quality", name: "Global quality and tech", bench: "URTH",
      desc: "Quality companies earn high returns on capital, carry little debt and grow steadily. This mix combines the largest US technology platforms with defensive global leaders in payments, healthcare, retail and food.",
      h: [["MSFT", 15], ["AAPL", 12], ["GOOGL", 10], ["NVDA", 8], ["V", 10], ["JNJ", 10], ["NESN.SW", 10], ["COST", 10], ["BRK-B", 15]] },
    { id: "ustech", name: "US mega cap technology", bench: "SPY",
      desc: "The seven largest US technology companies by market value. High expected growth, but the shares tend to move together, so the portfolio is far less diversified than seven names suggest.",
      h: [["AAPL", 17], ["MSFT", 17], ["NVDA", 17], ["GOOGL", 13], ["AMZN", 13], ["META", 13], ["AVGO", 10]] },
    { id: "fin", name: "Banks, insurers and asset managers", bench: "SPY",
      desc: "Investment banks, insurers and asset managers, including private markets firms such as KKR, Blackstone and Partners Group. Profits depend on interest rates and capital markets activity, so returns are cyclical.",
      h: [["JPM", 15], ["GS", 12], ["MS", 10], ["BLK", 10], ["KKR", 8], ["BX", 8], ["UBSG.SW", 12], ["ZURN.SW", 10], ["PGHN.SW", 8], ["BAER.SW", 7]] },
    { id: "balanced", name: "Balanced 60 / 40", bench: "VT",
      desc: "About 60% shares and 40% defensive assets (government bonds and gold). The classic starting point for pension funds and private banks: a lower long run return than an all equity portfolio, with much smaller drawdowns.",
      h: [["VT", 45], ["CHSPI.SW", 15], ["IEF", 20], ["TLT", 10], ["GLD", 10]] },
    { id: "income", name: "Conservative income", bench: "VT",
      desc: "Mostly high grade bonds with a small equity allocation. Built to preserve capital and pay a steady income; returns are modest and losses are usually shallow.",
      h: [["AGG", 35], ["IEF", 20], ["LQD", 15], ["TIP", 10], ["VT", 15], ["GLD", 5]] },
    { id: "allweather", name: "All weather", bench: "VT",
      desc: "Weights are chosen so that shares, bonds and commodities contribute similar amounts of risk rather than similar amounts of money. Designed to hold up in growth, recession, inflation and deflation alike.",
      h: [["VT", 30], ["TLT", 40], ["IEF", 15], ["GLD", 7.5], ["DBC", 7.5]] }
  ];

  let catalogue = null;
  async function catalog() {
    if (catalogue) return catalogue;
    const ix = (await API.localIndex()) || {};
    const live = ix.prices || [];
    const meta = ix.meta || {};
    const syms = Array.from(new Set(live.concat(Object.keys(NAMES)))).sort();
    catalogue = {
      live: new Set(live), syms: syms,
      name: function (s) { return NAMES[s] || (meta[s] && meta[s].name) || ""; },
      has: function (s) { return live.length ? live.indexOf(s) >= 0 : !!NAMES[s]; }
    };
    if (!document.getElementById("tickerList")) {
      const dl = document.createElement("datalist"); dl.id = "tickerList";
      dl.innerHTML = syms.filter(function (s) { return catalogue.has(s); }).map(function (s) { return '<option value="' + s + '">' + UI.esc(catalogue.name(s)) + "</option>"; }).join("");
      document.body.appendChild(dl);
    }
    return catalogue;
  }

  // Best guess for a ticker that is not in the daily data, by symbol or by company name
  function suggest(q) {
    if (!catalogue || !q) return null;
    const Q = q.toUpperCase(), lq = q.toLowerCase();
    const pool = catalogue.syms.filter(function (s) { return catalogue.has(s); });
    return pool.find(function (s) { return s.split(".")[0] === Q; }) ||
      pool.find(function (s) { return catalogue.name(s).toLowerCase().indexOf(lq) === 0; }) ||
      pool.find(function (s) { return catalogue.name(s).toLowerCase().indexOf(lq) >= 0; }) ||
      pool.find(function (s) { return s.indexOf(Q) === 0; }) || null;
  }

  /* Holdings editor. rows: [[ticker, number]]; mode "value" (position values) or "weight" (percent). */
  function editor(el, rows, opts) {
    opts = opts || {};
    const mode = opts.mode || "value";
    function draw() {
      const tot = rows.reduce(function (s, r) { return s + (+r[1] || 0); }, 0);
      let h = '<div class="table-wrap"><table class="pf-table"><thead><tr><th>Ticker</th><th>Company or fund</th><th class="n">' + (mode === "value" ? "Position value" : "Weight, %") + '</th>' + (mode === "value" ? '<th class="n">Weight</th>' : "") + "<th></th></tr></thead><tbody>";
      rows.forEach(function (r, i) {
        const sym = (r[0] || "").toUpperCase(), known = !sym || !catalogue || catalogue.has(sym), sug = known ? null : suggest(sym);
        h += '<tr><td><input type="text" list="tickerList" data-i="' + i + '" data-f="0" value="' + UI.esc(sym) + '" placeholder="Search" style="width:120px;text-transform:uppercase"></td>' +
          '<td class="nm">' + (known ? UI.esc(catalogue ? catalogue.name(sym) : "") :
            '<span class="warn">Not in the daily data.' + (sug ? ' Did you mean <a data-fix="' + i + '" data-s="' + sug + '">' + sug + " (" + UI.esc(catalogue.name(sug)) + ")</a>?" : " Loads only with a data key.") + "</span>") + "</td>" +
          '<td class="n"><input type="number" data-i="' + i + '" data-f="1" value="' + r[1] + '" min="0" step="' + (mode === "value" ? 1000 : 1) + '" style="width:110px;text-align:right"></td>' +
          (mode === "value" ? '<td class="n">' + (tot ? UI.pct((+r[1] || 0) / tot) : "") + "</td>" : "") +
          '<td><button class="xbtn" data-del="' + i + '" title="Remove">&times;</button></td></tr>';
      });
      h += '<tr class="total"><td>Total</td><td></td><td class="n">' + (mode === "value" ? UI.fmt(tot) : UI.fmt(tot, 1) + "%") + "</td>" + (mode === "value" ? '<td class="n">100.0%</td>' : "") + "<td></td></tr></tbody></table></div>" +
        '<div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn ghost small" data-add="1">Add position</button>' +
        (mode === "weight" && Math.abs(tot - 100) > 0.05 && tot > 0 ? '<span class="note">Weights add up to ' + UI.fmt(tot, 1) + '%; they are scaled to 100% when the simulation runs.</span>' : "") + "</div>";
      el.innerHTML = h;
      el.querySelectorAll("input").forEach(function (inp) {
        inp.onchange = function () { const i = +inp.dataset.i, f = +inp.dataset.f; rows[i][f] = f === 0 ? inp.value.trim().toUpperCase() : +inp.value; changed(); };
      });
      el.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { rows.splice(+b.dataset.del, 1); changed(); }; });
      el.querySelectorAll("[data-fix]").forEach(function (a) { a.onclick = function () { rows[+a.dataset.fix][0] = a.dataset.s; changed(); }; });
      el.querySelector("[data-add]").onclick = function () { rows.push(["", mode === "value" ? 10000 : 10]); draw(); };
    }
    function changed() { draw(); if (opts.onChange) opts.onChange(rows); }
    catalog().then(draw);
    draw();
    return { redraw: draw, set: function (r) { rows = r; draw(); }, rows: function () { return rows; } };
  }

  function holdingsText(h) {
    return h.map(function (r) { return (NAMES[r[0]] || r[0]) + " " + r[1] + "%"; }).join(", ");
  }

  window.PF = { NAMES, PRESETS, catalog, suggest, editor, holdingsText };
})();
