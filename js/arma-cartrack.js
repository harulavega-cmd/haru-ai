/**
 * Haru ARMA — Cartrack optimizer for Haru AI floor.
 *
 * Runs in the HOST (Grok server / staff prompt), not in the browser.
 * Never call Cartrack from the client. Never invent unit counts or %.
 *
 * Solar = % tangki only. Last-good cache on 401 / timeout.
 *
 * Usage (server / HARU_LANTAI_FETCH):
 *   const snap = await fetchCartrackSnapshot(); // your existing connector
 *   const arma = HaruArma.fromSnapshot(snap);
 *   return { market: { arma } };
 */
(function (root) {
  "use strict";

  var SOLAR_KRITIS = 20;
  var SOLAR_WASPAD = 35;
  var STALE_MIN = 30;

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function pick(obj, keys) {
    if (!obj) return null;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== "") return obj[keys[i]];
    }
    return null;
  }

  function solarPct(u) {
    var raw = pick(u, [
      "fuelLevel",
      "FuelLevel",
      "fuel_level",
      "fuelPercent",
      "FuelPercent",
      "tankPercent",
      "solarPct",
      "fuel",
    ]);
    if (raw == null) return null;
    if (typeof raw === "object") raw = raw.percent != null ? raw.percent : raw.value;
    var n = num(raw);
    if (n == null) return null;
    if (n > 100 && n <= 1000) return null;
    if (n < 0) return null;
    if (n > 100) n = 100;
    return n;
  }

  function plateOf(u) {
    return String(
      pick(u, ["registration", "RegistrationNumber", "plate", "nopol", "name", "Name", "vehicleName"]) || "unit"
    ).trim();
  }

  function idOf(u, i) {
    return String(pick(u, ["id", "Id", "vehicleId", "DeviceID", "imei"]) || plateOf(u) || i);
  }

  function whenOf(u) {
    var raw = pick(u, [
      "lastUpdate",
      "LastUpdate",
      "timestamp",
      "Timestamp",
      "eventDateTime",
      "EventDateTime",
      "gpsTime",
      "updatedAt",
    ]);
    if (!raw) return null;
    var t = Date.parse(raw);
    if (!isFinite(t) && typeof raw === "number") t = raw < 1e12 ? raw * 1000 : raw;
    return isFinite(t) ? t : null;
  }

  function ignitionOn(u) {
    var v = pick(u, ["ignition", "Ignition", "isIgnitionOn", "engineOn"]);
    if (v === true || v === 1 || v === "1" || v === "on" || v === "ON") return true;
    if (v === false || v === 0 || v === "0" || v === "off" || v === "OFF") return false;
    return null;
  }

  function speedOf(u) {
    return num(pick(u, ["speed", "Speed", "velocity"]));
  }

  function unitsFrom(snap) {
    if (!snap) return [];
    if (Array.isArray(snap)) return snap;
    if (Array.isArray(snap.units)) return snap.units;
    if (Array.isArray(snap.vehicles)) return snap.vehicles;
    if (Array.isArray(snap.data)) return snap.data;
    if (Array.isArray(snap.result)) return snap.result;
    return [];
  }

  function classify(u, i, now) {
    var pct = solarPct(u);
    var ts = whenOf(u);
    var ageMin = ts != null ? Math.max(0, (now - ts) / 60000) : null;
    var stale = ageMin != null && ageMin >= STALE_MIN;
    var speed = speedOf(u);
    var ign = ignitionOn(u);
    var moving = speed != null && speed >= 5;
    var tag = "ok";
    if (pct != null && pct <= SOLAR_KRITIS) tag = "kritis";
    else if (stale) tag = "stale";
    else if (pct != null && pct <= SOLAR_WASPAD) tag = "waspada";
    else if (pct == null) tag = "no-sensor";
    return {
      id: idOf(u, i),
      plate: plateOf(u),
      solarPct: pct,
      solarLabel: pct == null ? "tanpa sensor" : pct.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "% tangki",
      ageMin: ageMin == null ? null : Math.round(ageMin),
      stale: stale,
      ignition: ign,
      speed: speed,
      moving: moving,
      tag: tag,
    };
  }

  function emptyCard(reason) {
    return {
      kpi: "data putus",
      line: reason || "Cartrack tidak tersedia",
      status: "perhatian",
      source: "none",
      counts: { total: 0, kritis: 0, waspada: 0, stale: 0, moving: 0, noSensor: 0 },
      units: [],
      reason: reason || "empty",
    };
  }

  /**
   * snap: {
   *   ok: boolean,
   *   status: number | 'timeout' | '401' | 'ok',
   *   fetchedAt: ISO string,
   *   units: array,
   *   lastGood?: previous snap
   * }
   */
  function fromSnapshot(snap) {
    if (!snap) return emptyCard("snapshot kosong");

    var fail =
      snap.ok === false ||
      snap.status === 401 ||
      snap.status === "401" ||
      snap.status === 403 ||
      snap.status === "timeout" ||
      snap.status === 0;

    var liveUnits = unitsFrom(snap);
    var cacheUnits = unitsFrom(snap.lastGood || snap.cache);
    var usedCache = fail || liveUnits.length === 0;
    var list = usedCache ? cacheUnits : liveUnits;

    if (!list.length) {
      if (fail && (snap.status === 401 || snap.status === "401")) {
        return emptyCard("Cartrack 401 — token. Pakai cache kalau ada.");
      }
      if (fail && snap.status === "timeout") {
        return emptyCard("Cartrack timeout — jangan isi angka.");
      }
      return emptyCard("Cartrack kosong — jangan karangan unit.");
    }

    var now = Date.now();
    var rows = list.map(function (u, i) {
      return classify(u, i, now);
    });

    var kritis = rows.filter(function (r) {
      return r.tag === "kritis";
    });
    var waspada = rows.filter(function (r) {
      return r.tag === "waspada";
    });
    var stale = rows.filter(function (r) {
      return r.tag === "stale";
    });
    var moving = rows.filter(function (r) {
      return r.moving;
    });
    var noSensor = rows.filter(function (r) {
      return r.tag === "no-sensor";
    });

    var kpi;
    var status;
    if (kritis.length) {
      kpi = kritis.length + " kritis";
      status = "perhatian";
    } else if (stale.length) {
      kpi = stale.length + " stale";
      status = "perhatian";
    } else if (waspada.length) {
      kpi = waspada.length + " waspada";
      status = "perhatian";
    } else {
      kpi = rows.length + " unit";
      status = "siap";
    }

    var head = kritis[0] || waspada[0] || stale[0];
    var lineParts = [];
    if (usedCache) lineParts.push("CACHE");
    if (head) lineParts.push(head.plate + " " + head.solarLabel);
    else lineParts.push(moving.length + " jalan");
    if (stale.length && head && head.tag !== "stale") lineParts.push(stale.length + " stale");

    return {
      kpi: kpi,
      line: lineParts.join(" · "),
      status: status,
      source: usedCache ? "cache" : "live",
      counts: {
        total: rows.length,
        kritis: kritis.length,
        waspada: waspada.length,
        stale: stale.length,
        moving: moving.length,
        noSensor: noSensor.length,
      },
      units: rows.sort(function (a, b) {
        var rank = { kritis: 0, stale: 1, waspada: 2, "no-sensor": 3, ok: 4 };
        return (rank[a.tag] || 9) - (rank[b.tag] || 9);
      }),
      reason: usedCache ? String(snap.status || "cache") : "ok",
    };
  }

  var api = {
    SOLAR_KRITIS: SOLAR_KRITIS,
    SOLAR_WASPAD: SOLAR_WASPAD,
    STALE_MIN: STALE_MIN,
    solarPct: solarPct,
    fromSnapshot: fromSnapshot,
    emptyCard: emptyCard,
  };

  root.HaruArma = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
