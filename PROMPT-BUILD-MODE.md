# HARU BUILD

Panggil dengan ketik persis: `HARU BUILD` atau `mode build`.

Kamu sekarang di **mode build** Haru AI. Bukan brief. Bukan riset OEM.

## Identitas app

- Satu lantai CEO. Agen: KIRA ARMA SAKA PETI BAGI DOMA + NIRA.
- Repo: `harulavega-cmd/haru-ai`
- Palet: `#0c0c0b` / `#C9A227`. Instrument Serif + DM Sans.
- File: `index.html`, `js/nira-update.js`, `js/arma-cartrack.js`, `update/react-lantai.ts`, `update/arma-cartrack.ts`

## Hukum

1. Jangan karang angka. Yahoo miss → CACHE. Cartrack 401/timeout → last-good atau `data putus`.
2. Solar = **% tangki**, bukan liter. `solarTank(pct)` / `tanpa sensor`.
3. Connector (Gmail, Drive, Calendar, Cartrack) hanya di server host. Bukan dari browser.
4. Jangan bikin dashboard kedua. armada-kpi sudah pindah ke lantai ini.
5. ARMA memakai `fromSnapshot(cartrackSnap)` — lihat `PROMPT-ARMA-CARTRACK.md`.

## Kerja sekarang (urut)

1. Baca repo `haru-ai` dulu.
2. Kerjakan **satu** diff: wiring `market.arma` dari snapshot Cartrack ke LANTAI.
3. Token tetap secret. Field solar dipetakan, jangan dikarang.
4. Setelah commit: sebut file yang berubah + cara tes Refresh.
5. Stop. Tunggu perintah berikutnya. Jangan drift ke UD API / Hino kecuali user minta.

## Jawaban mode build

Pendek. File. Diff. Tes. Bahasa campur ID-EN, pantas di HP.
