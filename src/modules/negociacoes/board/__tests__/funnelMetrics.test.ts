import { describe, it, expect } from "vitest";
import { computeFunnelMetrics, periodStartMs } from "../funnelMetrics";
import { generateOperationReading } from "../operationReading";
import type { KanbanCard } from "../../hooks/useKanbanData";

const NOW = new Date("2026-07-09T12:00:00Z").getTime();
const T = 7;

function card(p: Partial<KanbanCard> & { id: string; status: string }): KanbanCard {
  return {
    createdAt: "2026-06-01", updatedAt: "2026-06-01",
    clienteNome: null, clienteId: null, quadra: null, lote: null, valor: 100, unitId: null,
    unitStatus: null, corretorNome: null, corretorId: null, propostaId: null, propostaStatus: null,
    reservaExpiresAt: null, reservaStatus: null, reservaRequestId: null, reservaRequestStatus: null,
    ...p,
  } as KanbanCard;
}

function mk(n: number, status: string, extra: Partial<KanbanCard> = {}): KanbanCard[] {
  return Array.from({ length: n }, (_, i) => card({ id: `${status}-${i}`, status, ...extra }));
}

describe("computeFunnelMetrics (Bloco 2)", () => {
  const cohort = [
    ...mk(4, "IN_PROGRESS"),
    ...mk(3, "PROPOSAL"),
    ...mk(2, "RESERVATION"),
    ...mk(1, "WON", { createdAt: "2026-06-01", stageChangedAt: "2026-06-11" }),
  ];
  const m = computeFunnelMetrics(cohort, [], T, NOW);

  it("reached por estágio (cumulativo no fluxo)", () => {
    expect(m.reached.em_negociacao).toBe(10);
    expect(m.reached.proposta).toBe(6); // 3 + 2 + 1
    expect(m.reached.reserva).toBe(3); // 2 + 1
    expect(m.reached.venda).toBe(1);
    expect(m.entradas).toBe(10);
  });

  it("conversões por transição e geral", () => {
    const conv = Object.fromEntries(m.transitions.map((t) => [`${t.from}->${t.to}`, t.conv]));
    expect(conv["em_negociacao->proposta"]).toBeCloseTo(0.6);
    expect(conv["proposta->reserva"]).toBeCloseTo(0.5);
    expect(conv["reserva->venda"]).toBeCloseTo(1 / 3);
    expect(m.conversaoGeral).toBeCloseTo(0.1);
  });

  it("gargalo = menor conversão", () => {
    expect(m.bottleneck?.from).toBe("reserva");
    expect(m.bottleneck?.to).toBe("venda");
  });

  it("ciclo médio e vendido no período", () => {
    expect(m.cicloMedioDias).toBeCloseTo(10);
    expect(m.vendido.count).toBe(1);
    expect(m.vendido.vgv).toBe(100);
  });

  it("degrada honesto: coorte vazia → nulls, não zeros forjados", () => {
    const e = computeFunnelMetrics([], [], T, NOW);
    expect(e.entradas).toBe(0);
    expect(e.conversaoGeral).toBeNull();
    expect(e.cicloMedioDias).toBeNull();
    expect(e.bottleneck).toBeNull();
  });

  it("periodStartMs: 30d retrocede 30 dias; month zera ao dia 1", () => {
    expect(periodStartMs("30d", NOW)).toBe(NOW - 30 * 86400000);
    const monthStart = new Date(periodStartMs("month", NOW));
    expect(monthStart.getUTCDate()).toBe(1);
    expect(monthStart.getUTCMonth()).toBe(6); // julho (0-based)
  });
});

describe("generateOperationReading (Bloco 2)", () => {
  it("coorte vazia → frase honesta, sem CTA", () => {
    const m = computeFunnelMetrics([], [], T, NOW);
    const r = generateOperationReading(m, [], T, NOW);
    expect(r.text).toMatch(/Sem negociações/);
    expect(r.cta).toBeNull();
  });

  it("aponta o gargalo e o item mais antigo travado (com CTA)", () => {
    const cohort = [
      ...mk(5, "IN_PROGRESS"),
      card({ id: "stuck", status: "PROPOSAL", clienteNome: "Ana", lastActivityAt: "2026-05-01", stageChangedAt: "2026-05-01" }),
      card({ id: "fresh", status: "PROPOSAL", clienteNome: "Beto", nextActionAt: "2026-07-20T00:00:00Z" }),
    ];
    const m = computeFunnelMetrics(cohort, [], T, NOW);
    const r = generateOperationReading(m, cohort, T, NOW);
    expect(r.text).toMatch(/gargalo/i);
    expect(r.text).toMatch(/Ana/);
    expect(r.cta?.negotiationId).toBe("stuck");
  });
});

describe("journeyConvsForDisplay — % honesto entre coortes", () => {
  const S = (key: string, tone: "lead" | "negotiation", count: number) => ({ key, label: key, tone, count } as unknown as import("../funnelMetrics").JourneyStage);
  const T2 = (conv: number | null) => ({ fromKey: "x", toKey: "y", conv } as unknown as import("../funnelMetrics").JourneyTransition);

  it("fronteira leads→negociação: sem % (null) mesmo com números", async () => {
    const { journeyConvsForDisplay } = await import("../funnelMetrics");
    const stages = [S("atendimento", "lead", 22), S("em_negociacao", "negotiation", 24)];
    const trans = [T2(24 / 22)];
    expect(journeyConvsForDisplay(stages, trans)).toEqual([null]);
  });

  it("mesma coorte com 24/22 (>100%): sem % (coortes distintas)", async () => {
    const { journeyConvsForDisplay } = await import("../funnelMetrics");
    const stages = [S("em_negociacao", "negotiation", 22), S("proposta", "negotiation", 24)];
    const trans = [T2(24 / 22)];
    expect(journeyConvsForDisplay(stages, trans)).toEqual([null]);
  });

  it("mesma coorte, <=100%: preserva o %", async () => {
    const { journeyConvsForDisplay } = await import("../funnelMetrics");
    const stages = [S("em_negociacao", "negotiation", 24), S("proposta", "negotiation", 12)];
    const trans = [T2(0.5)];
    expect(journeyConvsForDisplay(stages, trans)).toEqual([0.5]);
  });

  it("sem base (from=0 → conv null): permanece null", async () => {
    const { journeyConvsForDisplay } = await import("../funnelMetrics");
    const stages = [S("reserva", "negotiation", 0), S("venda", "negotiation", 0)];
    const trans = [T2(null)];
    expect(journeyConvsForDisplay(stages, trans)).toEqual([null]);
  });
});
