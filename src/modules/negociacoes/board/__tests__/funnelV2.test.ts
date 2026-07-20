import { describe, it, expect } from "vitest";
import { computeMonthlyEvolution, computeBrokerRanking, periodSeries, pctDelta } from "../funnelMetrics";
import type { KanbanCard } from "../../hooks/useKanbanData";

const NOW = new Date("2026-07-15T12:00:00Z").getTime();

// Fábrica mínima de card (só os campos usados pelas agregações v2).
function card(p: Partial<KanbanCard>): KanbanCard {
  return { id: Math.random().toString(36).slice(2), status: "OPEN", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", clienteNome: null, clienteId: null, quadra: null, lote: null, valor: null, unitId: null, unitStatus: null, corretorNome: null, corretorId: null, propostaId: null, propostaStatus: null, reservaExpiresAt: null, reservaStatus: null, reservaRequestId: null, reservaRequestStatus: null, ...p } as KanbanCard;
}

describe("Funil v2 — agregações puras", () => {
  it("computeMonthlyEvolution: bucketiza criadas e vendas por mês (12 meses)", () => {
    const cards = [
      card({ createdAt: "2026-07-02T00:00:00Z" }),
      card({ createdAt: "2026-07-10T00:00:00Z" }),
      card({ createdAt: "2026-06-05T00:00:00Z" }),
      card({ status: "WON", createdAt: "2026-05-01T00:00:00Z", stageChangedAt: "2026-07-08T00:00:00Z", valor: 100 }),
    ];
    const evo = computeMonthlyEvolution(cards, NOW, 12);
    expect(evo).toHaveLength(12);
    const jul = evo[evo.length - 1];
    expect(jul.label).toMatch(/^jul\/26$/);
    expect(jul.criadas).toBe(2); // 02 e 10 de julho
    expect(jul.vendas).toBe(1); // venda fechada em julho (stage_changed_at)
    expect(jul.vgvVendas).toBe(100);
    const jun = evo[evo.length - 2];
    expect(jun.criadas).toBe(1);
  });

  it("computeBrokerRanking: top N por vendas, depois VGV", () => {
    const cards = [
      card({ corretorNome: "Ana", status: "WON", valor: 200, stageChangedAt: "2026-07-01T00:00:00Z" }),
      card({ corretorNome: "Ana", status: "OPEN" }),
      card({ corretorNome: "Bruno", status: "WON", valor: 500, stageChangedAt: "2026-07-01T00:00:00Z" }),
      card({ corretorNome: "Bruno", status: "WON", valor: 100, stageChangedAt: "2026-07-01T00:00:00Z" }),
    ];
    const rank = computeBrokerRanking(cards, 5);
    expect(rank[0].name).toBe("Bruno"); // 2 vendas
    expect(rank[0].vendas).toBe(2);
    expect(rank[0].vgv).toBe(600);
    expect(rank[1].name).toBe("Ana");
    expect(rank[1].conv).toBeCloseTo(0.5); // 1 venda / 2 criadas
  });

  it("periodSeries: distribui criadas/vendas em sub-buckets", () => {
    const start = NOW - 6 * 86_400_000;
    const cards = [
      card({ createdAt: new Date(start + 100).toISOString() }),
      card({ createdAt: new Date(NOW - 100).toISOString() }),
    ];
    const s = periodSeries(cards, start, NOW, 6);
    expect(s.criadas.reduce((a, b) => a + b, 0)).toBe(2);
    expect(s.criadas[0]).toBe(1); // primeiro bucket
  });

  it("pctDelta: base zero → null; caso normal", () => {
    expect(pctDelta(5, 0)).toBeNull();
    expect(pctDelta(0, 0)).toBe(0);
    expect(pctDelta(12, 10)).toBeCloseTo(0.2);
  });
});
