# ARMA × Cartrack — tempel di Grok Build / staff

Satu lantai. Jangan bikin dashboard kedua.

## Wajib

- Solar = **% tangki**, bukan liter.
- Jangan karang jumlah unit / % kalau Cartrack 401 atau timeout.
- Token Cartrack hanya di server / secret Grok. Bukan di `index.html`.
- Pakai last-good cache. Tulis `CACHE` di line ARMA.

## Ambang

- Kritis: solar ≤ 20% tangki
- Waspada: 21–35%
- Stale: last GPS ≥ 30 menit
- Tanpa sensor: field solar kosong → `tanpa sensor`

## Slice `market.arma`

```ts
import { fromSnapshot } from "./update/arma-cartrack";

const snap = await getCartrack(); // connector host
const arma = fromSnapshot(snap);
// { kpi: "2 kritis", line: "B9207FYX 12% tangki", status: "perhatian", source: "live"|"cache" }
return { saka, bagi, arma, doma, clockLabel };
```

`HARU_LANTAI_FETCH` di host:

```js
window.HARU_LANTAI_FETCH = async () => {
  const market = await getMarket(); // includes arma from fromSnapshot
  return { market, inbox, calendar };
};
```

## Kalau API gagal

| Status | KPI | Line |
|---|---|---|
| 401 / 403 | `data putus` | `Cartrack 401 — token` |
| timeout | `data putus` | `Cartrack timeout` |
| 200 + lastGood | hitung dari cache | prefix `CACHE` |

Jangan isi `2 kritis` kalau tidak ada array unit.

## Prioritas unit di line

1. solar kritis  
2. stale  
3. waspada  
4. sisanya

Contoh line: `CACHE · B9207FYX 12% tangki · 1 stale`
