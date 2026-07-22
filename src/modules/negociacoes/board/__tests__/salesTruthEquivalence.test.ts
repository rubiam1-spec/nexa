// E3 · FASE 3 — PROVA DE EQUIVALÊNCIA do Funil sob a fonte única.
// A leitura de "vendido/evolução/ranking/série" foi re-roteada por salesTruth
// (WON ∪ sales, dedupe por negociação/unidade). Com sales=[] (estado de hoje) o
// resultado tem de ser IDÊNTICO à antiga leitura WON. Divergir = FALHA.
// Abaixo reproduzimos as fórmulas ANTIGAS (WON-based, in-line) e comparamos com
// as funções ATUAIS. Fixture cobre os casos reais: WON com valor, WON sem valor,
// WON sem unidade, colisão de unidade entre dois WON, abertas, e corretores.
import { describe, it, expect } from "vitest";
import {
  computeFunnelMetrics, computeMonthlyEvolution, computeBrokerRanking, periodSeries, wonRefIso,
} from "../funnelMetrics";
import { columnOfStatusRaw } from "../stageColumn";
import type { KanbanCard } from "../../hooks/useKanbanData";
import type { SaleTruthSaleRow } from "../../../../domain/venda/salesTruth";

const NOW = new Date("2026-07-15T12:00:00Z").getTime();

function card(p: Partial<KanbanCard>): KanbanCard {
  return { id: Math.random().toString(36).slice(2), status: "OPEN", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", clienteNome: null, clienteId: null, quadra: null, lote: null, valor: null, unitId: null, unitStatus: null, corretorNome: null, corretorId: null, propostaId: null, propostaStatus: null, reservaExpiresAt: null, reservaStatus: null, reservaRequestId: null, reservaRequestStatus: null, ...p } as KanbanCard;
}

// Coorte representativa do dataset real (sales=0): 19-like mix, escala reduzida.
function cohortFixture(): KanbanCard[] {
  return [
    // WON com unidade + valor + corretor
    card({ id: "w1", status: "WON", unitId: "u1", valor: 300_000, corretorNome: "Ana", createdAt: "2026-06-02T00:00:00Z", stageChangedAt: "2026-07-01T00:00:00Z" }),
    card({ id: "w2", status: "WON", unitId: "u2", valor: 250_000, corretorNome: "Bruno", createdAt: "2026-05-10T00:00:00Z", stageChangedAt: "2026-06-20T00:00:00Z" }),
    // colisão de unidade: dois WON no mesmo u3 (real: won_unit_colisao=1) → sem sale NÃO deduplica
    card({ id: "w3", status: "WON", unitId: "u3", valor: 200_000, corretorNome: "Ana", createdAt: "2026-06-15T00:00:00Z", stageChangedAt: "2026-07-05T00:00:00Z" }),
    card({ id: "w4", status: "WON", unitId: "u3", valor: 200_000, corretorNome: "Ana", createdAt: "2026-06-16T00:00:00Z", stageChangedAt: "2026-07-06T00:00:00Z" }),
    // WON sem unidade → valor null (real: won_sem_unit=12) · stageChangedAt null → cai em created_at
    card({ id: "w5", status: "WON", unitId: null, valor: null, corretorNome: "Bruno", createdAt: "2026-07-02T00:00:00Z", stageChangedAt: null }),
    card({ id: "w6", status: "WON", unitId: null, valor: null, corretorNome: null, createdAt: "2026-07-03T00:00:00Z", stageChangedAt: null }), // sem corretor
    // abertas (não vendidas)
    card({ id: "o1", status: "IN_PROGRESS", valor: 400_000, corretorNome: "Ana", createdAt: "2026-07-01T00:00:00Z" }),
    card({ id: "o2", status: "PROPOSAL", valor: 150_000, corretorNome: "Bruno", createdAt: "2026-06-25T00:00:00Z" }),
    card({ id: "o3", status: "OPEN", corretorNome: "Célia", createdAt: "2026-07-04T00:00:00Z" }),
  ];
}

// ── Fórmulas ANTIGAS (WON-based), reproduzidas para servir de referência ──
function oldVendido(cohort: KanbanCard[]) {
  const v = cohort.filter((c) => columnOfStatusRaw(c.status) === "venda");
  return { count: v.length, vgv: v.reduce((s, c) => s + (c.valor ?? 0), 0) };
}
function oldMonthlyVendas(negs: KanbanCard[]) {
  const m = new Map<string, { vendas: number; vgv: number; comValor: number }>();
  for (const c of negs) {
    if (columnOfStatusRaw(c.status) !== "venda") continue;
    const ym = wonRefIso(c).slice(0, 7);
    const b = m.get(ym) ?? { vendas: 0, vgv: 0, comValor: 0 };
    b.vendas += 1; b.vgv += c.valor ?? 0; if (c.valor != null) b.comValor += 1;
    m.set(ym, b);
  }
  return m;
}
function oldRanking(cohort: KanbanCard[]) {
  const map = new Map<string, { criadas: number; vendas: number; vgv: number }>();
  let sem = 0;
  for (const c of cohort) {
    const won = columnOfStatusRaw(c.status) === "venda";
    if (!c.corretorNome) { if (won) sem += 1; continue; }
    const r = map.get(c.corretorNome) ?? { criadas: 0, vendas: 0, vgv: 0 };
    r.criadas += 1; if (won) { r.vendas += 1; r.vgv += c.valor ?? 0; }
    map.set(c.corretorNome, r);
  }
  return { map, sem };
}

describe("E3 FASE 3 — equivalência Funil (salesTruth com sales=[] ≡ WON)", () => {
  const cohort = cohortFixture();
  const noSales: SaleTruthSaleRow[] = [];

  it("vendido: count e vgv idênticos à leitura WON antiga", () => {
    const m = computeFunnelMetrics(cohort, [], 7, NOW, noSales);
    const old = oldVendido(cohort);
    expect(m.vendido.count).toBe(old.count); // 6 (inclui colisão de unidade, sem dedupe)
    expect(m.vendido.vgv).toBe(old.vgv); // 300k+250k+200k+200k (w5/w6 sem valor)
    expect(m.vendido.count).toBe(6);
    expect(m.vendido.vgv).toBe(950_000);
  });

  it("evolução mensal: vendas/vgv/cobertura por mês idênticos", () => {
    const evo = computeMonthlyEvolution(cohort, NOW, 24, noSales);
    const old = oldMonthlyVendas(cohort);
    for (const p of evo) {
      const o = old.get(p.key) ?? { vendas: 0, vgv: 0, comValor: 0 };
      expect(p.vendas).toBe(o.vendas);
      expect(p.vgvVendas).toBe(o.vgv);
      expect(p.vendasComValor).toBe(o.comValor);
    }
    // soma total confere com o vendido
    expect(evo.reduce((s, p) => s + p.vendas, 0)).toBe(6);
  });

  it("ranking: vendas, vgv e semCorretor idênticos à leitura antiga", () => {
    const { rows, semCorretorVendas } = computeBrokerRanking(cohort, 5, noSales);
    const old = oldRanking(cohort);
    expect(semCorretorVendas).toBe(old.sem); // w6 (WON sem corretor)
    for (const r of rows) {
      const o = old.map.get(r.name)!;
      expect(r.vendas).toBe(o.vendas);
      expect(r.vgv).toBe(o.vgv);
      expect(r.criadas).toBe(o.criadas);
    }
    const ana = rows.find((r) => r.name === "Ana")!;
    expect(ana.vendas).toBe(3); // w1, w3, w4
    expect(ana.vgv).toBe(700_000);
  });

  it("série do período: vendas por bucket idênticas à fórmula WON antiga", () => {
    const start = new Date("2026-06-01T00:00:00Z").getTime();
    // referência antiga (WON por wonRefIso), reproduzida in-line
    const buckets = 6, size = Math.max(1, NOW - start) / buckets;
    const idxOf = (t: number) => Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / size)));
    const oldVendas = new Array(buckets).fill(0);
    for (const c of cohort) {
      if (columnOfStatusRaw(c.status) !== "venda") continue;
      const wt = new Date(wonRefIso(c)).getTime();
      if (Number.isFinite(wt) && wt >= start && wt <= NOW) oldVendas[idxOf(wt)] += 1;
    }
    const now = periodSeries(cohort, start, NOW, 6, noSales);
    expect(now.vendas).toEqual(oldVendas);
    expect(now.vendas.reduce((a: number, b: number) => a + b, 0)).toBe(6);
  });
});

describe("E3 FASE 3 — comportamento futuro (quando a Manu registra em sales)", () => {
  const cohort = cohortFixture();

  it("sale numa negociação WON: count ESTÁVEL (dedupe) e vgv passa a vir da sale", () => {
    // registra sale para w5 (WON sem valor) com amount → dedupe cobre a WON e traz valor
    const sales: SaleTruthSaleRow[] = [
      { id: "s5", negotiationId: "w5", unitId: null, amount: 180_000, saleDate: "2026-07-10", status: "completed", createdAt: "2026-07-10T00:00:00Z" },
    ];
    const before = computeFunnelMetrics(cohort, [], 7, NOW, []);
    const after = computeFunnelMetrics(cohort, [], 7, NOW, sales);
    expect(after.vendido.count).toBe(before.vendido.count); // dedupe por negociação: NÃO soma duplicado
    expect(after.vendido.vgv).toBe(before.vendido.vgv + 180_000); // agora w5 tem valor (era null)
  });

  it("sale numa negociação AINDA aberta: entra como venda (fato registrado)", () => {
    const sales: SaleTruthSaleRow[] = [
      { id: "s-o1", negotiationId: "o1", unitId: null, amount: 400_000, saleDate: "2026-07-11", status: "completed", createdAt: "2026-07-11T00:00:00Z" },
    ];
    const before = computeFunnelMetrics(cohort, [], 7, NOW, []);
    const after = computeFunnelMetrics(cohort, [], 7, NOW, sales);
    expect(after.vendido.count).toBe(before.vendido.count + 1); // o1 não era WON, a sale a torna venda
    expect(after.vendido.vgv).toBe(before.vendido.vgv + 400_000);
  });

  it("sale cancelada é ignorada (nunca conta)", () => {
    const sales: SaleTruthSaleRow[] = [
      { id: "s-x", negotiationId: "o2", unitId: null, amount: 999, saleDate: "2026-07-11", status: "cancelled", createdAt: "2026-07-11T00:00:00Z" },
    ];
    const before = computeFunnelMetrics(cohort, [], 7, NOW, []);
    const after = computeFunnelMetrics(cohort, [], 7, NOW, sales);
    expect(after.vendido.count).toBe(before.vendido.count);
    expect(after.vendido.vgv).toBe(before.vendido.vgv);
  });
});
