/**
 * Haru NIRA — React / Grok Build adapter.
 * Copy into other TanStack apps. Keep one floor. Do not restore a second dashboard.
 *
 * Rules:
 *   - Do not invent numbers.
 *   - Solar = % tangki, never liters (use solarTank).
 *   - Gmail / Drive / Calendar only via existing server functions
 *     (getMarket / getInbox / getCalendar / refreshAll). Never from the client.
 *
 * Wire:
 *   const marketQ = useQuery({ queryKey: ["pos","market"], queryFn: getMarket });
 *   const inboxQ  = useQuery({ queryKey: ["pos","inbox"],  queryFn: getInbox });
 *   const calQ    = useQuery({ queryKey: ["pos","calendar"], queryFn: getCalendar });
 *   const dash = useMemo(
 *     () => mergeOps(emptyDash(), marketQ.data, inboxQ.data, calQ.data),
 *     [marketQ.data, inboxQ.data, calQ.data],
 *   );
 *   const ops = compactOps(dash);
 *   const isu = pentingItems(dash);
 *   const over = overlayTapeLane(quotes, live); // null until Yahoo is live
 */

export type TickDir = "up" | "down" | "flat";

export type TapeQuote = {
  key: string;
  label: string;
  value: string;
  dir: TickDir;
  delta?: string;
};

export type OpsRow = {
  id: string;
  mark: string;
  name: string;
  kpi: string;
  line: string;
  status: string;
  featured?: boolean;
};

export const ROSTER: Omit<OpsRow, "kpi" | "status">[] = [
  { id: "kira", mark: "KR", name: "KIRA", line: "Surat, legal, nada resmi" },
  { id: "arma", mark: "AR", name: "ARMA", line: "Armada, solar, service" },
  { id: "saka", mark: "SK", name: "SAKA", line: "Kas & kontrol tower" },
  { id: "peti", mark: "PT", name: "PETI", line: "Plastik, rPET, QC" },
  { id: "bagi", mark: "BG", name: "BAGI", line: "Kebun Bagolo, musim, irigasi" },
  { id: "doma", mark: "DM", name: "DOMA", line: "Digital, Whop, build" },
  {
    id: "nira",
    mark: "NI",
    name: "NIRA",
    line: "X intel · 5 pick · keputusan",
    featured: true,
  },
];

export function solarTank(pct: number | null | undefined): string {
  if (pct == null) return "tanpa sensor";
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% tangki`;
}

/** GitHub 02 TAPE stays until Yahoo is actually live. Do not invent prices. */
export function overlayTapeLane(
  quotes: TapeQuote[],
  live: boolean,
): { h: string; t: string } | null {
  if (!live) return null;
  const spx = quotes.find((q) => q.key === "spx");
  const ndx = quotes.find((q) => q.key === "ndx");
  const wti = quotes.find((q) => q.key === "wti");
  const gold = quotes.find((q) => q.key === "gold");
  if (!spx || !wti) return null;
  const bit = (q?: TapeQuote) =>
    q ? `${q.value}${q.delta ? ` ${q.delta}` : ""}` : "—";
  return {
    h: `S&P ${spx.value} · WTI ${wti.value}`,
    t: `Live Yahoo: S&P ${bit(spx)} · Nasdaq ${bit(ndx)} · WTI ${bit(wti)} · Gold ${bit(gold)}. Angka tidak dikarang.`,
  };
}

type AgentLike = {
  kpi?: string;
  line?: string;
  status?: string;
};

type DashLike = {
  agents?: Record<string, AgentLike>;
  morningBrief?: { items?: Array<{ kind: string }> };
  clockLabel?: string;
};

type MarketLike = {
  saka?: AgentLike;
  bagi?: AgentLike;
  arma?: AgentLike;
  doma?: AgentLike;
  clockLabel?: string;
};

type InboxLike = { kira?: AgentLike; peti?: AgentLike };
type CalLike = { doma?: AgentLike };

export function mergeOps<T extends DashLike>(
  fallback: T,
  market?: MarketLike,
  inbox?: InboxLike,
  cal?: CalLike,
): T {
  const agents = { ...(fallback.agents ?? {}) };
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
  if (cal?.doma) agents.doma = cal.doma;
  return {
    ...fallback,
    agents,
    clockLabel: market?.clockLabel ?? fallback.clockLabel,
  };
}

export function compactOps(d: DashLike): OpsRow[] {
  return ROSTER.map((r) => {
    if (r.id === "nira") {
      return { ...r, kpi: "5 pick", status: "siap" };
    }
    const card = d.agents?.[r.id];
    if (!card) return { ...r, kpi: "…", status: "bekerja" };
    return {
      ...r,
      kpi: card.kpi ?? "…",
      line: card.line ?? r.line,
      status: card.status ?? "bekerja",
    };
  });
}

export function pentingItems<I extends { kind: string }>(d: {
  morningBrief?: { items?: I[] };
}): I[] {
  return (d.morningBrief?.items ?? [])
    .filter((i) => i.kind === "penting")
    .slice(0, 4);
}
