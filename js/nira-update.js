/**
 * Haru NIRA — drop-in update for other apps.
 *
 * Vanilla. No framework. Attach window.HaruNira.
 *
 * Rules (do not relax):
 *   - Never invent prices / KPIs. Yahoo miss → CACHE, keep GitHub tape copy.
 *   - Solar is % tangki, never liters.
 *   - Gmail / Drive / Calendar: host supplies lantai. Never call connectors
 *     from the browser.
 *
 * Usage:
 *   <script src="./js/nira-update.js"></script>
 *   <script>
 *     HaruNira.mount();
 *     HaruNira.refresh();
 *     // optional: host feeds live lantai (from YOUR server, not the client)
 *     window.HARU_LANTAI_FETCH = async () => rows;
 *   </script>
 */
(function (root) {
  "use strict";

  var HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  var SYMBOLS = "^GSPC,^IXIC,CL=F,GC=F";
  var SPARK_MS = 1600;

  var TAPE_FALLBACK = [
    { key: "spx", label: "S&P", value: "7,712", dir: "down" },
    { key: "ndx", label: "NASDAQ", value: "26,402", dir: "down" },
    { key: "wti", label: "WTI", value: "$83.40", dir: "down" },
    { key: "gold", label: "GOLD", value: "$4,455", dir: "down" },
  ];

  var ROSTER = [
    { id: "kira", mark: "KR", name: "KIRA", line: "Surat, legal, nada resmi" },
    { id: "arma", mark: "AR", name: "ARMA", line: "Armada, solar, service" },
    { id: "saka", mark: "SK", name: "SAKA", line: "Kas & kontrol tower" },
    { id: "peti", mark: "PT", name: "PETI", line: "Plastik, rPET, QC" },
    { id: "bagi", mark: "BG", name: "BAGI", line: "Kebun Bagolo, musim, irigasi" },
    { id: "doma", mark: "DM", name: "DOMA", line: "Digital, Whop, build" },
    { id: "nira", mark: "NI", name: "NIRA", line: "X intel · 5 pick · keputusan", featured: true },
  ];

  var VOICES = [
    "Tiga pintu malam ini: pita minyak, asap Kalimantan, dan jangan kejar emas yang sedang turun napas.",
    "Yang valid sudah cukup. Sisanya noise. Pegang tiga centang di atas, tutup HP.",
    "Pasar libur. Keputusan tidak libur. Kunci pita, sisakan tenaga untuk Senin.",
  ];

  var lastTape = { live: false, quotes: TAPE_FALLBACK, stamp: "", source: "cache" };
  var lastLantai = null;
  var origLane02 = null;

  function wibDate(from) {
    var src = from || new Date();
    return new Date(src.getTime() + 7 * 60 * 60 * 1000);
  }

  function nowStamp(from) {
    var d = wibDate(from);
    var dd = String(d.getUTCDate()).padStart(2, "0");
    var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    var hh = String(d.getUTCHours()).padStart(2, "0");
    var mi = String(d.getUTCMinutes()).padStart(2, "0");
    return HARI[d.getUTCDay()] + ", " + dd + "/" + mm + ", " + hh + "." + mi;
  }

  function putusanTitle(from) {
    var h = wibDate(from).getUTCHours();
    if (h < 11) return "Putusan pagi ini";
    if (h < 15) return "Putusan siang ini";
    if (h < 18) return "Putusan sore ini";
    return "Putusan malam ini";
  }

  function solarTank(pct) {
    if (pct == null || pct === "") return "tanpa sensor";
    var n = Number(pct);
    if (!isFinite(n)) return "tanpa sensor";
    return n.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "% tangki";
  }

  function num(v) {
    return typeof v === "number" && isFinite(v) ? v : null;
  }

  function asRecord(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  }

  function fmtEn(n, digits) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtPct(n) {
    var body = n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return n > 0 ? "+" + body + "%" : body + "%";
  }

  function dirOf(n) {
    if (n == null || Math.abs(n) < 0.04) return "flat";
    return n > 0 ? "up" : "down";
  }

  function tick(key, label, q, kind, fallback) {
    if (!q) return fallback;
    var value =
      kind === "index"
        ? fmtEn(q.price, 0)
        : kind === "usd2"
          ? "$" + fmtEn(q.price, 2)
          : "$" + fmtEn(q.price, 0);
    return {
      key: key,
      label: label,
      value: value,
      dir: dirOf(q.changePct),
      delta: q.changePct != null ? fmtPct(q.changePct) : undefined,
    };
  }

  function parseSpark(json) {
    var root = asRecord(json);
    if (!root) return {};
    var spark = asRecord(root.spark);
    var items = Array.isArray(spark && spark.result)
      ? spark.result
      : Array.isArray(root.result)
        ? root.result
        : [];
    var out = {};
    for (var i = 0; i < items.length; i++) {
      var rec = asRecord(items[i]);
      if (!rec) continue;
      var symbol = String(rec.symbol || "");
      if (!symbol) continue;
      var closes = Array.isArray(rec.close)
        ? rec.close.map(num)
        : [];
      var last = null;
      for (var c = closes.length - 1; c >= 0; c--) {
        if (closes[c] != null) {
          last = closes[c];
          break;
        }
      }
      var prev =
        num(rec.chartPreviousClose) ||
        num(rec.previousClose) ||
        (closes.length > 1 ? closes[closes.length - 2] : null);
      if (last == null) continue;
      out[symbol] = {
        price: last,
        changePct: prev && prev !== 0 ? ((last - prev) / prev) * 100 : null,
      };
    }
    return out;
  }

  function payloadFromMap(map, live) {
    var quotes = [
      tick("spx", "S&P", map["^GSPC"], "index", TAPE_FALLBACK[0]),
      tick("ndx", "NASDAQ", map["^IXIC"], "index", TAPE_FALLBACK[1]),
      tick("wti", "WTI", map["CL=F"], "usd2", TAPE_FALLBACK[2]),
      tick("gold", "GOLD", map["GC=F"], "usd", TAPE_FALLBACK[3]),
    ];
    var hit = quotes.some(function (q, i) {
      return q.value !== TAPE_FALLBACK[i].value || Boolean(q.delta);
    });
    return {
      quotes: quotes,
      live: Boolean(live && hit),
      stamp: nowStamp(),
      source: live && hit ? "yahoo" : "cache",
    };
  }

  function fetchJson(url, ms) {
    var ctrl = new AbortController();
    var t = setTimeout(function () {
      ctrl.abort();
    }, ms);
    return fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).finally(function () {
      clearTimeout(t);
    });
  }

  function fetchTape() {
    var q = encodeURIComponent(SYMBOLS);
    var urls = [
      "https://query1.finance.yahoo.com/v8/finance/spark?symbols=" + q + "&range=5d&interval=1d",
      "https://query2.finance.yahoo.com/v8/finance/spark?symbols=" + q + "&range=5d&interval=1d",
    ];
    return Promise.any(urls.map(function (u) {
      return fetchJson(u, SPARK_MS);
    })).then(function (json) {
      var next = payloadFromMap(parseSpark(json), true);
      lastTape = next;
      return next;
    }).catch(function () {
      var cached = {
        quotes: lastTape.quotes && lastTape.quotes.length ? lastTape.quotes : TAPE_FALLBACK,
        live: false,
        stamp: nowStamp(),
        source: "cache",
      };
      lastTape = cached;
      return cached;
    });
  }

  function overlayTapeLane(quotes, live) {
    if (!live) return null;
    var spx, ndx, wti, gold, i;
    for (i = 0; i < (quotes || []).length; i++) {
      if (quotes[i].key === "spx") spx = quotes[i];
      if (quotes[i].key === "ndx") ndx = quotes[i];
      if (quotes[i].key === "wti") wti = quotes[i];
      if (quotes[i].key === "gold") gold = quotes[i];
    }
    if (!spx || !wti) return null;
    function bit(q) {
      return q ? q.value + (q.delta ? " " + q.delta : "") : "—";
    }
    return {
      h: "S&P " + spx.value + " · WTI " + wti.value,
      t:
        "Live Yahoo: S&P " +
        bit(spx) +
        " · Nasdaq " +
        bit(ndx) +
        " · WTI " +
        bit(wti) +
        " · Gold " +
        bit(gold) +
        ". Angka tidak dikarang.",
    };
  }

  function compactOps(d) {
    var agents = (d && d.agents) || {};
    return ROSTER.map(function (r) {
      if (r.id === "nira") {
        return {
          id: r.id,
          mark: r.mark,
          name: r.name,
          kpi: "5 pick",
          line: r.line,
          status: "siap",
          featured: true,
        };
      }
      var card = agents[r.id];
      if (!card) {
        return {
          id: r.id,
          mark: r.mark,
          name: r.name,
          kpi: "…",
          line: r.line,
          status: "bekerja",
        };
      }
      return {
        id: r.id,
        mark: r.mark,
        name: r.name,
        kpi: card.kpi || "…",
        line: card.line || r.line,
        status: card.status || "bekerja",
      };
    });
  }

  function mergeOps(market, inbox, cal) {
    var agents = {};
    ROSTER.forEach(function (r) {
      if (r.id === "nira") return;
      agents[r.id] = {
        kpi: "…",
        line: r.line,
        status: "bekerja",
      };
    });
    if (market) {
      if (market.saka) agents.saka = market.saka;
      if (market.bagi) agents.bagi = market.bagi;
      if (market.arma) agents.arma = market.arma;
      if (market.doma) agents.doma = market.doma;
    }
    if (inbox) {
      if (inbox.kira) agents.kira = inbox.kira;
      if (inbox.peti) agents.peti = inbox.peti;
    }
    if (cal && cal.doma) agents.doma = cal.doma;
    return {
      agents: agents,
      clockLabel: (market && market.clockLabel) || "",
      rows: compactOps({ agents: agents }),
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function paintTicks(quotes) {
    var el = $("ticks");
    if (!el) return;
    el.innerHTML = (quotes || TAPE_FALLBACK)
      .map(function (q) {
        var cls = q.dir === "up" ? "up" : q.dir === "down" ? "dn" : "";
        return (
          "<div><b>" +
          q.label +
          "</b><strong class=\"" +
          cls +
          "\">" +
          q.value +
          "</strong></div>"
        );
      })
      .join("");
  }

  function paintLane02(quotes, live) {
    var art = document.querySelector('[data-lane="02"]');
    if (!art) return;
    var hEl = art.querySelector("h3");
    var pEl = art.querySelector("p");
    if (!origLane02 && hEl && pEl) {
      origLane02 = { h: hEl.textContent, t: pEl.textContent };
    }
    var over = overlayTapeLane(quotes, live);
    if (over) {
      if (hEl) hEl.textContent = over.h;
      if (pEl) pEl.textContent = over.t;
    } else if (origLane02) {
      if (hEl) hEl.textContent = origLane02.h;
      if (pEl) pEl.textContent = origLane02.t;
    }
  }

  function paintTape(tape) {
    lastTape = tape || lastTape;
    paintTicks(lastTape.quotes);
    paintLane02(lastTape.quotes, lastTape.live);
    var chip = $("liveChip");
    if (chip) chip.textContent = lastTape.live ? "● LIVE" : "● CACHE";
    var time = $("timeChip");
    if (time) time.textContent = lastTape.stamp || nowStamp();
    var title = $("putusanTitle");
    if (title) title.textContent = putusanTitle();
  }

  function statusClass(status) {
    if (status === "perhatian") return "hot";
    if (status === "siap") return "ok";
    return "";
  }

  function paintLantai(rows, clockLabel) {
    lastLantai = rows;
    var head = $("lantaiHead");
    var ready = rows && rows.some(function (r) {
      return r.id !== "nira" && r.kpi && r.kpi !== "…";
    });
    if (head) {
      head.textContent =
        "LANTAI · " +
        (ready ? "LIVE" : "MEMUAT") +
        (clockLabel ? " · " + clockLabel : "");
    }
    var grid = $("nira-lantai");
    if (grid) {
      var lantai = (rows || []).filter(function (r) {
        return r.id !== "nira";
      });
      grid.innerHTML = lantai
        .map(function (r) {
          return (
            "<button type=\"button\" data-open=\"" +
            r.id +
            "\"><b>" +
            r.name +
            "</b><strong class=\"" +
            statusClass(r.status) +
            "\">" +
            (r.kpi || "…") +
            "</strong></button>"
          );
        })
        .join("");
      grid.querySelectorAll("[data-open]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var tabBtn = document.querySelector("[data-tab='s-home']");
          if (typeof root.tab === "function" && tabBtn) root.tab("s-home", tabBtn);
        });
      });
    }
    (rows || []).forEach(function (r) {
      var row = document.querySelector('[data-nira-agent="' + r.id + '"]');
      if (!row) return;
      var line = row.querySelector("[data-nira-line]");
      if (line) {
        line.textContent =
          r.kpi && r.kpi !== "…" ? r.kpi + " · " + r.line : r.line;
      }
      if (r.status === "perhatian") row.setAttribute("data-hot", "1");
      else row.removeAttribute("data-hot");
    });
  }

  function setLantai(rows, clockLabel) {
    paintLantai(rows, clockLabel);
    return rows;
  }

  function fromSlices(market, inbox, cal) {
    var merged = mergeOps(market, inbox, cal);
    setLantai(merged.rows, merged.clockLabel);
    return merged;
  }

  function cannedVoice() {
    return VOICES[Math.floor(Date.now() / 8.64e7) % VOICES.length];
  }

  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 1600);
  }

  function log(msg) {
    var el = $("logBox");
    var row = nowStamp() + " — " + msg;
    var prev = "";
    try {
      prev = localStorage.getItem("nira_log") || "";
    } catch (e) {}
    var next = (row + "\n" + prev).slice(0, 1800);
    try {
      localStorage.setItem("nira_log", next);
    } catch (e2) {}
    if (el) el.textContent = next;
  }

  function refresh() {
    var btn = $("btnRefresh");
    var chip = $("liveChip");
    if (btn) btn.classList.add("busy");
    if (chip) chip.textContent = "● SYNC";
    var jobs = [fetchTape()];
    if (typeof root.HARU_LANTAI_FETCH === "function") {
      jobs.push(
        Promise.resolve(root.HARU_LANTAI_FETCH()).catch(function () {
          return null;
        })
      );
    }
    return Promise.all(jobs)
      .then(function (res) {
        var tape = res[0];
        paintTape(tape);
        var extra = res[1];
        if (extra) {
          if (Array.isArray(extra)) setLantai(extra);
          else if (extra.rows) setLantai(extra.rows, extra.clockLabel);
          else if (extra.market || extra.inbox || extra.calendar) {
            fromSlices(extra.market, extra.inbox, extra.calendar);
          }
        }
        var voice = $("niraVoice");
        if (voice) voice.textContent = (tape && tape.voice) || cannedVoice();
        try {
          localStorage.setItem("nira_last", tape.stamp);
        } catch (e) {}
        toast(tape.live ? "NIRA synced · lantai + tape" : "NIRA synced · cache");
        log(
          "Refresh · tape " +
            tape.source +
            (extra ? " + lantai" : "") +
            ". Angka tidak dikarang."
        );
        return tape;
      })
      .catch(function () {
        paintTape({
          quotes: lastTape.quotes || TAPE_FALLBACK,
          live: false,
          stamp: nowStamp(),
          source: "cache",
        });
        toast("NIRA synced · cache");
        log("Refresh · sebagian gagal. Jam tetap diupdate.");
      })
      .finally(function () {
        if (btn) btn.classList.remove("busy");
      });
  }

  function mount() {
    paintTicks(TAPE_FALLBACK);
    var time = $("timeChip");
    if (time) {
      var saved = null;
      try {
        saved = localStorage.getItem("nira_last");
      } catch (e) {}
      time.textContent = saved || nowStamp();
    }
    var title = $("putusanTitle");
    if (title) title.textContent = putusanTitle();
    var voice = $("niraVoice");
    if (voice && !voice.textContent) voice.textContent = cannedVoice();
    var logEl = $("logBox");
    if (logEl) {
      try {
        var prev = localStorage.getItem("nira_log");
        if (prev) logEl.textContent = prev;
      } catch (e2) {}
    }
    fetchTape().then(paintTape);
    if (typeof root.HARU_LANTAI_FETCH === "function") {
      Promise.resolve(root.HARU_LANTAI_FETCH())
        .then(function (extra) {
          if (!extra) return;
          if (Array.isArray(extra)) setLantai(extra);
          else if (extra.rows) setLantai(extra.rows, extra.clockLabel);
          else fromSlices(extra.market, extra.inbox, extra.calendar);
        })
        .catch(function () {});
    }
    var btn = $("btnRefresh");
    if (btn) {
      btn.onclick = function (ev) {
        ev.preventDefault();
        refresh();
      };
    }
  }

  root.HaruNira = {
    TAPE_FALLBACK: TAPE_FALLBACK,
    ROSTER: ROSTER,
    nowStamp: nowStamp,
    putusanTitle: putusanTitle,
    solarTank: solarTank,
    overlayTapeLane: overlayTapeLane,
    fetchTape: fetchTape,
    compactOps: compactOps,
    mergeOps: mergeOps,
    fromSlices: fromSlices,
    setLantai: setLantai,
    paintTape: paintTape,
    mount: mount,
    refresh: refresh,
  };
})(typeof window !== "undefined" ? window : globalThis);
