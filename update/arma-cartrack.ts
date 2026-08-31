/**
 * Haru ARMA — Cartrack snapshot → lantai card.
 * Copy into Grok Build server. Do not call Cartrack from the browser.
 * Solar = % tangki. 401 / timeout → last-good, never invent counts.
 */

export type ArmaUnit = {
  id: string;
  plate: string;
  solarPct: number | null;
  solarLabel: string;
  ageMin: number | null;
  stale: boolean;
  ignition: boolean | null;
  speed: number | null;
  moving: boolean;
  tag: "kritis" | "waspada" | "stale" | "no-sensor" | "ok";
};

export type ArmaCard = {
  kpi: string;
  line: string;
  status: "perhatian" | "siap" | "bekerja";
  source: "live" | "cache" | "none";
  counts: {
    total: number;
    kritis: number;
    waspada: number;
    stale: number;
    moving: number;
    noSensor: number;
  };
  units: ArmaUnit[];
  reason: string;
};

export type CartrackSnap = {
  ok?: boolean;
  status?: number | string;
  fetchedAt?: string;
  units?: unknown[];
  vehicles?: unknown[];
  data?: unknown[];
  lastGood?: CartrackSnap;
  cache?: CartrackSnap;
};

export const SOLAR_KRITIS = 20;
export const SOLAR_WASPAD = 35;
export const STALE_MIN = 30;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

export function solarPct(u: Record<string, unknown>): number | null {
  let raw = pick(u, [
    "fuelLevel",
    "FuelLevel",
    "fuel_level",
    "fuelPercent",
    "FuelPercent",
    "tankPercent",
    "solarPct",
    "fuel",
  ]);
  if (raw && typeof raw === "object") {
    const o = raw as { percent?: unknown; value?: unknown };
    raw = o.percent ?? o.value;
  }
  const n = num(raw);
  if (n == null || n < 0 || n > 1000) return null;
  if (n > 100) return 100;
  return n;
}

export function solarTank(pct: number | null | undefined): string {
  if (pct == null) return "tanpa sensor";
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% tangki`;
}

function unitsFrom(snap?: CartrackSnap | null): Record<string, unknown>[] {
  if (!snap) return [];
  const list = snap.units ?? snap.vehicles ?? snap.data;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

export function fromSnapshot(snap?: CartrackSnap | null): ArmaCard {
  const empty = (reason: string): ArmaCard => ({
    kpi: "data putus",
    line: reason,
    status: "perhatian",
    source: "none",
    counts: { total: 0, kritis: 0, waspada: 0, stale: 0, moving: 0, noSensor: 0 },
    units: [],
    reason,
  });

  if (!snap) return empty("snapshot kosong");

  const fail =
    snap.ok === false ||
    snap.status === 401 ||
    snap.status === "401" ||
    snap.status === 403 ||
    snap.status === "timeout" ||
    snap.status === 0;

  const live = unitsFrom(snap);
  const cached = unitsFrom(snap.lastGood ?? snap.cache);
  const usedCache = fail || live.length === 0;
  const list = usedCache ? cached : live;

  if (!list.length) {
    if (snap.status === 401 || snap.status === "401") {
      return empty("Cartrack 401 — token. Pakai cache kalau ada.");
    }
    if (snap.status === "timeout") return empty("Cartrack timeout — jangan isi angka.");
    return empty("Cartrack kosong — jangan karangan unit.");
  }

  const now = Date.now();
  const rows: ArmaUnit[] = list.map((u, i) => {
    const pct = solarPct(u);
    const rawTs = pick(u, [
      "lastUpdate",
      "LastUpdate",
      "timestamp",
      "Timestamp",
      "eventDateTime",
      "EventDateTime",
      "gpsTime",
      "updatedAt",
    ]);
    let ts: number | null = null;
    if (typeof rawTs === "string") {
      const p = Date.parse(rawTs);
      ts = Number.isFinite(p) ? p : null;
    } else if (typeof rawTs === "number") {
      ts = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    }
    const ageMin = ts != null ? Math.max(0, (now - ts) / 60000) : null;
    const stale = ageMin != null && ageMin >= STALE_MIN;
    const speed = num(pick(u, ["speed", "Speed", "velocity"]));
    const ignRaw = pick(u, ["ignition", "Ignition", "isIgnitionOn", "engineOn"]);
    const ignition =
      ignRaw === true || ignRaw === 1 || ignRaw === "1" || ignRaw === "on" || ignRaw === "ON"
        ? true
        : ignRaw === false || ignRaw === 0 || ignRaw === "0" || ignRaw === "off" || ignRaw === "OFF"
          ? false
          : null;
    let tag: ArmaUnit["tag"] = "ok";
    if (pct != null && pct <= SOLAR_KRITIS) tag = "kritis";
    else if (stale) tag = "stale";
    else if (pct != null && pct <= SOLAR_WASPAD) tag = "waspada";
    else if (pct == null) tag = "no-sensor";
    const plate = String(
      pick(u, ["registration", "RegistrationNumber", "plate", "nopol", "name", "Name", "vehicleName"]) || "unit",
    ).trim();
    return {
      id: String(pick(u, ["id", "Id", "vehicleId", "DeviceID", "imei"]) || plate || i),
      plate,
      solarPct: pct,
      solarLabel: solarTank(pct),
      ageMin: ageMin == null ? null : Math.round(ageMin),
      stale,
      ignition,
      speed,
      moving: speed != null && speed >= 5,
      tag,
    };
  });

  const kritis = rows.filter((r) => r.tag === "kritis");
  const waspada = rows.filter((r) => r.tag === "waspada");
  const stale = rows.filter((r) => r.tag === "stale");
  const moving = rows.filter((r) => r.moving);
  const noSensor = rows.filter((r) => r.tag === "no-sensor");

  let kpi: string;
  let status: ArmaCard["status"];
  if (kritis.length) {
    kpi = `${kritis.length} kritis`;
    status = "perhatian";
  } else if (stale.length) {
    kpi = `${stale.length} stale`;
    status = "perhatian";
  } else if (waspada.length) {
    kpi = `${waspada.length} waspada`;
    status = "perhatian";
  } else {
    kpi = `${rows.length} unit`;
    status = "siap";
  }

  const head = kritis[0] ?? waspada[0] ?? stale[0];
  const lineParts: string[] = [];
  if (usedCache) lineParts.push("CACHE");
  if (head) lineParts.push(`${head.plate} ${head.solarLabel}`);
  else lineParts.push(`${moving.length} jalan`);
  if (stale.length && head?.tag !== "stale") lineParts.push(`${stale.length} stale`);

  const rank: Record<string, number> = {
    kritis: 0,
    stale: 1,
    waspada: 2,
    "no-sensor": 3,
    ok: 4,
  };

  return {
    kpi,
    line: lineParts.join(" · "),
    status,
    source: usedCache ? "cache" : "live",
    counts: {
      total: rows.length,
      kritis: kritis.length,
      waspada: waspada.length,
      stale: stale.length,
      moving: moving.length,
      noSensor: noSensor.length,
    },
    units: rows.sort((a, b) => (rank[a.tag] ?? 9) - (rank[b.tag] ?? 9)),
    reason: usedCache ? String(snap.status ?? "cache") : "ok",
  };
}
