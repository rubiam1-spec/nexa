// Verdade ÚNICA de vendas (TRANSICIONAL). PURO e testável.
//   vendas = sales (status <> cancelled) ∪ negociações WON SEM linha em sales
//   dedupe por negotiation_id e por unit_id.
// Conforme a Manu registra em `sales`, a união converge para sales puro — sem
// migração futura (por design). Data e valor com cadeia de fallback declarada.
export type SaleTruthSaleRow = {
  id: string;
  negotiationId: string | null;
  unitId: string | null;
  amount: number | null;
  saleDate: string | null; // 'YYYY-MM-DD'
  status: string; // linhas canceladas já foram filtradas na query, mas reforçamos aqui
  createdAt: string;
};

export type SaleTruthWon = {
  negotiationId: string;
  unitId: string | null;
  valor: number | null; // valor da negociação (unit.valor)
  stageChangedAt: string | null;
  createdAt: string;
};

export type SaleTruthOrigin = "registrada" | "won_sem_registro";

export type SaleTruthItem = {
  id: string; // sale.id OU "won:<negId>"
  negotiationId: string | null;
  unitId: string | null;
  amount: number | null; // null quando não há valor (nunca 0 exibido como R$ 0)
  hasValue: boolean;
  dateIso: string; // data da venda (cadeia de fallback)
  origin: SaleTruthOrigin;
};

function pos(v: number | null | undefined): number | null {
  return v != null && Number(v) > 0 ? Number(v) : null;
}

// Une sales + WON-sem-sale. Dedupe por negotiation_id e por unit_id (uma sale já
// "cobre" a WON correspondente). Data: sale_date → stage_changed_at → created_at.
export function buildSalesTruth(sales: SaleTruthSaleRow[], won: SaleTruthWon[]): SaleTruthItem[] {
  const active = sales.filter((s) => s.status !== "cancelled");

  const items: SaleTruthItem[] = active.map((s) => {
    const amount = pos(s.amount);
    return {
      id: s.id,
      negotiationId: s.negotiationId,
      unitId: s.unitId,
      amount,
      hasValue: amount != null,
      dateIso: s.saleDate ?? s.createdAt, // sale_date → (sem stage) → created_at
      origin: "registrada" as const,
    };
  });

  const negCovered = new Set(active.map((s) => s.negotiationId).filter(Boolean) as string[]);
  const unitCovered = new Set(active.map((s) => s.unitId).filter(Boolean) as string[]);

  for (const w of won) {
    if (w.negotiationId && negCovered.has(w.negotiationId)) continue; // dedupe por negociação
    if (w.unitId && unitCovered.has(w.unitId)) continue; // dedupe por unidade
    const amount = pos(w.valor);
    items.push({
      id: `won:${w.negotiationId}`,
      negotiationId: w.negotiationId,
      unitId: w.unitId,
      amount,
      hasValue: amount != null,
      dateIso: w.stageChangedAt ?? w.createdAt, // (sem sale_date) → stage_changed_at → created_at
      origin: "won_sem_registro" as const,
    });
  }

  return items;
}

export type SalesTruthTotals = { count: number; vgv: number; withValue: number; total: number };

export function salesTruthTotals(items: SaleTruthItem[]): SalesTruthTotals {
  const withValue = items.filter((i) => i.hasValue);
  return {
    count: items.length,
    vgv: withValue.reduce((s, i) => s + (i.amount ?? 0), 0),
    withValue: withValue.length,
    total: items.length,
  };
}

// Filtra por janela [startMs, nowMs] pela data da venda (dateIso).
export function salesTruthInWindow(items: SaleTruthItem[], startMs: number, nowMs: number): SaleTruthItem[] {
  return items.filter((i) => {
    const t = new Date(i.dateIso).getTime();
    return Number.isFinite(t) && t >= startMs && t <= nowMs;
  });
}

export type SalesTruthMonth = { ym: string; label: string; count: number; vgv: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Série dos últimos N meses (default 12), do mês mais antigo ao atual.
// Mês por 'YYYY-MM' (determinístico, sem shift de fuso): sale_date é DATE;
// timestamps usam o mês armazenado (UTC), coerente entre janela e itens.
export function salesTruthMonthly(items: SaleTruthItem[], nowMs: number, months = 12): SalesTruthMonth[] {
  const nowYm = new Date(nowMs).toISOString().slice(0, 7);
  const [ny, nm] = nowYm.split("-").map(Number);
  const baseIdx = ny * 12 + (nm - 1);
  const order: { key: string; label: string }[] = [];
  const buckets = new Map<string, { count: number; vgv: number }>();
  for (let k = months - 1; k >= 0; k--) {
    const idx = baseIdx - k;
    const y = Math.floor(idx / 12), m = idx % 12;
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    order.push({ key, label: MESES[m] });
    buckets.set(key, { count: 0, vgv: 0 });
  }
  for (const it of items) {
    const b = buckets.get((it.dateIso || "").slice(0, 7));
    if (!b) continue; // fora da janela de N meses
    b.count += 1;
    b.vgv += it.amount ?? 0;
  }
  return order.map((o) => ({ ym: o.key, label: o.label, count: buckets.get(o.key)!.count, vgv: buckets.get(o.key)!.vgv }));
}
