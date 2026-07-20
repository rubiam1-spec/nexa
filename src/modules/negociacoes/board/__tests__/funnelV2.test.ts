import { describe, it, expect } from "vitest";
import { computeMonthlyEvolution, computeBrokerRanking, periodSeries, pctDelta, computeFunnelMetrics } from "../funnelMetrics";
import { generateOperationReading } from "../operationReading";
import type { KanbanCard } from "../../hooks/useKanbanData";

const NOW = new Date("2026-07-15T12:00:00Z").getTime();

// Fábrica mínima de card (só os campos usados pelas agregações v2).
function card(p: Partial<KanbanCard>): KanbanCard {
  return { id: Math.random().toString(36).slice(2), status: "OPEN", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", clienteNome: null, clienteId: null, quadra: null, lote: null, valor: null, unitId: null, unitStatus: null, corretorNome: null, corretorId: null, propostaId: null, propostaStatus: null, reservaExpiresAt: null, reservaStatus: null, reservaRequestId: null, reservaRequestStatus: null, ...p } as KanbanCard;
}

describe("Funil v2.1 — semântica honesta", () => {
  it("(1) evolução mensal: janela dinâmica com bucket de overflow quando span > cap", () => {
    const cards = [
      card({ createdAt: "2023-01-10T00:00:00Z" }), // ~30 meses atrás → overflow
      card({ createdAt: "2026-07-02T00:00:00Z" }),
    ];
    const evo = computeMonthlyEvolution(cards, NOW, 24);
    expect(evo.length).toBeLessThanOrEqual(24);
    expect(evo[0].overflow).toBe(true);
    expect(evo[0].label).toMatch(/^antes de /);
    expect(evo[0].criadas).toBe(1); // a de 2023 caiu no overflow
    expect(evo[evo.length - 1].label).toMatch(/^jul\/26$/);
    expect(evo[evo.length - 1].criadas).toBe(1);
  });

  it("(1) sem overflow quando span <= cap: primeiro bucket é o mês mais antigo real", () => {
    const cards = [card({ createdAt: "2026-05-03T00:00:00Z" }), card({ createdAt: "2026-07-01T00:00:00Z" })];
    const evo = computeMonthlyEvolution(cards, NOW, 24);
    expect(evo[0].overflow).toBeUndefined();
    expect(evo[0].label).toMatch(/^mai\/26$/);
    expect(evo.length).toBe(3); // mai, jun, jul
  });

  it("(2) data da venda: fallback stage_changed_at → created_at (NUNCA updated_at)", () => {
    // stage_changed_at ausente; updated_at em julho seria a data errada.
    const cards = [card({ status: "WON", createdAt: "2026-03-10T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", stageChangedAt: null, valor: 100 })];
    const evo = computeMonthlyEvolution(cards, NOW, 24);
    const mar = evo.find((e) => e.label === "mar/26")!;
    const jul = evo.find((e) => e.label === "jul/26")!;
    expect(mar.vendas).toBe(1); // caiu em março (created_at), não julho (updated_at)
    expect(jul.vendas).toBe(0);
  });

  it("(3) ranking: exclui 'Sem corretor' (vira rodapé), completa por criadas, valor 0 fica sem venda", () => {
    const cards = [
      card({ corretorNome: "Ana", status: "WON", stageChangedAt: "2026-07-01T00:00:00Z", valor: null }), // venda sem valor
      card({ corretorNome: "Bruno", status: "OPEN" }),
      card({ corretorNome: "Bruno", status: "IN_PROGRESS" }),
      card({ corretorNome: null, status: "WON", stageChangedAt: "2026-07-01T00:00:00Z", valor: 500 }), // sem corretor
    ];
    const { rows, semCorretorVendas } = computeBrokerRanking(cards, 5);
    expect(semCorretorVendas).toBe(1);
    expect(rows.some((r) => r.name === "Sem corretor")).toBe(false);
    expect(rows[0].name).toBe("Ana");
    expect(rows[0].vendas).toBe(1);
    expect(rows[0].vgv).toBe(0); // a UI exibe "—", nunca "R$ 0"
    // Bruno entra por criadas (0 vendas) rotulado semVenda.
    const bruno = rows.find((r) => r.name === "Bruno");
    expect(bruno?.semVenda).toBe(true);
  });

  it("(4) leitura: gargalo ignora ghost importado sem responsável e o texto avisa", () => {
    const cohort = [
      card({ status: "WON", stageChangedAt: "2026-07-10T00:00:00Z", corretorNome: "Ana", ownerProfileId: "u1" }),
      card({ status: "PROPOSAL", ownerProfileId: "u1", lastActivityAt: "2026-07-12T00:00:00Z" }), // viva e assumida
      card({ status: "IN_PROGRESS", ownerProfileId: null, lastActivityAt: null, importBatchId: "b1" }), // ghost importado
    ];
    const metrics = computeFunnelMetrics(cohort, [], 7, NOW);
    const reading = generateOperationReading(metrics, cohort, 7, NOW);
    expect(reading.text).toContain("aguardando responsável");
  });

  it("(4) sem ghosts importados: nenhum aviso de responsável no texto", () => {
    const cohort = [card({ status: "PROPOSAL", ownerProfileId: "u1" }), card({ status: "WON", stageChangedAt: "2026-07-01T00:00:00Z", ownerProfileId: "u1" })];
    const reading = generateOperationReading(computeFunnelMetrics(cohort, [], 7, NOW), cohort, 7, NOW);
    expect(reading.text).not.toContain("aguardando responsável");
  });

  it("periodSeries + pctDelta seguem íntegros", () => {
    const start = NOW - 6 * 86_400_000;
    const s = periodSeries([card({ createdAt: new Date(start + 100).toISOString() })], start, NOW, 6);
    expect(s.criadas[0]).toBe(1);
    expect(pctDelta(12, 10)).toBeCloseTo(0.2);
    expect(pctDelta(5, 0)).toBeNull();
  });
});
