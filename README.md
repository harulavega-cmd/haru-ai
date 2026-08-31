# Haru AI · NIRA — update kit

Drop-in for **other Haru apps**. One floor. No second dashboard.

Palette: `#0c0c0b` / `#C9A227`. Instrument Serif + DM Sans.

## Rules

- Do **not** invent numbers. Yahoo miss → `CACHE`. GitHub 02 TAPE copy stays until Yahoo is actually live.
- Solar = **% tangki**, never liters. Use `HaruNira.solarTank(pct)` / `solarTank(pct)`.
- Gmail / Drive / Calendar / **Cartrack** only via the host app’s existing server functions. Never from the client.

## ARMA × Cartrack (now)

Optimizer lives in [`js/arma-cartrack.js`](js/arma-cartrack.js) and [`update/arma-cartrack.ts`](update/arma-cartrack.ts). Staff prompt: [`PROMPT-ARMA-CARTRACK.md`](PROMPT-ARMA-CARTRACK.md).

```js
const arma = HaruArma.fromSnapshot({
  ok: true,
  status: "ok",
  units: liveUnits,
  lastGood: cachedUnitsSnap, // used on 401 / timeout
});
// arma.kpi   → "2 kritis" | "1 stale" | "8 unit" | "data putus"
// arma.line  → "B9207FYX 12% tangki" or "CACHE · …"
// arma.status → perhatian | siap
```

Ambang: kritis ≤ 20% tangki, waspada 21–35%, stale ≥ 30 menit. Token tetap di server.

Feed into lantai:

```js
window.HARU_LANTAI_FETCH = async () => {
  const market = await getMarket(); // market.arma = fromSnapshot(cartrackSnap)
  return { market, inbox, calendar };
};
```

## Vanilla HTML (GitHub Pages, armada-kpi, any static app)

```html
<script src="./js/nira-update.js"></script>
<script src="./js/arma-cartrack.js"></script>
<script>
  HaruNira.mount();
  HaruNira.refresh();
</script>
```

Or pass rows directly:

```js
HaruNira.setLantai([
  { id: "arma", mark: "AR", name: "ARMA", kpi: "2 kritis", line: "2 solar kritis", status: "perhatian" },
]);

HaruNira.solarTank(22);     // "22% tangki"
HaruNira.solarTank(null);   // "tanpa sensor"
```

## Grok Build / React

Copy [`update/react-lantai.ts`](update/react-lantai.ts) + [`update/arma-cartrack.ts`](update/arma-cartrack.ts).

Keep using `getMarket` / `getInbox` / `getCalendar` / `refreshAll` on the server. Do not add client connector calls.

Rebuild prompt:

> Rebuild Haru AI from this repo. Keep #0c0c0b / #C9A227, Instrument Serif + DM Sans. Use js/nira-update.js + js/arma-cartrack.js. Solar = % tangki. Cartrack 401/timeout → CACHE or `data putus`, never invent unit counts. One floor.
