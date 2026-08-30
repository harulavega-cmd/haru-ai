# Haru AI · NIRA — update kit

Drop-in for **other Haru apps**. One floor. No second dashboard.

Palette: `#0c0c0b` / `#C9A227`. Instrument Serif + DM Sans.

## Rules

- Do **not** invent numbers. Yahoo miss → `CACHE`. GitHub 02 TAPE copy stays until Yahoo is actually live.
- Solar = **% tangki**, never liters. Use `HaruNira.solarTank(pct)` / `solarTank(pct)`.
- Gmail / Drive / Calendar **only** via the host app’s existing server functions. Never from the client.

## Vanilla HTML (GitHub Pages, armada-kpi, any static app)

```html
<script src="./js/nira-update.js"></script>
<script>
  HaruNira.mount();          // paints tape, WIB stamp, Refresh
  HaruNira.refresh();        // Yahoo tape — no jitter
</script>
```

Feed lantai from **your** backend (not the browser):

```html
<script>
  window.HARU_LANTAI_FETCH = async () => {
    // server already merged market + inbox + calendar
    return {
      market,   // { saka, bagi, arma, doma, clockLabel }
      inbox,    // { kira, peti }
      calendar  // { doma }
    };
  };
</script>
```

Or pass rows directly:

```js
HaruNira.setLantai([
  { id: "arma", mark: "AR", name: "ARMA", kpi: "2 kritis", line: "2 solar kritis", status: "perhatian" },
  // ...
]);

HaruNira.solarTank(22);     // "22% tangki"
HaruNira.solarTank(null);   // "tanpa sensor"
```

DOM hooks the kit paints:

| id / attr | what |
|---|---|
| `#ticks` | S&P · NASDAQ · WTI · GOLD |
| `#liveChip` `#timeChip` | LIVE / CACHE + WIB stamp |
| `#nira-lantai` `#lantaiHead` | 3×2 KPI strip |
| `[data-nira-agent="kira"] [data-nira-line]` | Agen roster line |
| `[data-lane="02"]` | 02 TAPE overlay only when Yahoo is live |
| `#btnRefresh` `#niraVoice` `#logBox` `#toast` | Refresh / voice / log |

## Grok Build / React

Copy [`update/react-lantai.ts`](update/react-lantai.ts).

```ts
const dash = mergeOps(emptyDash(), marketQ.data, inboxQ.data, calQ.data);
const ops = compactOps(dash);
const over = overlayTapeLane(quotes, live); // null until Yahoo live
```

Keep using `getMarket` / `getInbox` / `getCalendar` / `refreshAll` on the server. Do not add client connector calls.

## What Refresh does

1. Yahoo spark `^GSPC,^IXIC,CL=F,GC=F` — last-good cache on miss, never Math.random.
2. Optional `HARU_LANTAI_FETCH` → LANTAI + Agen lines.
3. Word / voice / WIB stamp.

Rebuild prompt:

> Rebuild Haru AI from this repo. Keep #0c0c0b / #C9A227, Instrument Serif + DM Sans. Use js/nira-update.js: live Yahoo tape, LANTAI from host slices, solar = % tangki, one floor, no invented numbers.
