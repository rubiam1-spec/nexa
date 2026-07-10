import { describe, it, expect } from "vitest";
import { computeEndToEndJourney } from "../funnelMetrics";
import { LeadQualificationStatus as S, type LeadQualificationStatus } from "../../../../domain/status/leadQualification";
import type { LeadFunnelRow } from "../leadFunnel";
import type { BoardStage } from "../stageColumn";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 10);
const start = NOW - 30 * DAY;
const row = (q: LeadQualificationStatus, daysAgo = 5): LeadFunnelRow => ({ createdAt: new Date(NOW - daysAgo * DAY).toISOString(), qualification: q });
const reached = (o: Partial<Record<BoardStage, number>>): Record<BoardStage, number> =>
  ({ em_negociacao: 0, proposta: 0, reserva: 0, venda: 0, perdido: 0, ...o });

describe("computeEndToEndJourney — jornada Leads→…→Venda (L1.8)", () => {
  it("monta 6 estágios com contagens da coorte de leads + reached de negociação", () => {
    const leadRows = [row(S.NEW), row(S.NEW), row(S.IN_SERVICE), row(S.QUALIFIED), row(S.CONVERTED)];
    const j = computeEndToEndJourney(reached({ em_negociacao: 3, proposta: 2, reserva: 1, venda: 1 }), leadRows, start);
    expect(j.stages.map((s) => [s.key, s.count])).toEqual([
      ["leads", 5], ["atendimento", 3], ["em_negociacao", 3], ["proposta", 2], ["reserva", 1], ["venda", 1],
    ]);
    // atendidos = todos que saíram de NEW (in_service+qualified+converted) = 3
    expect(j.leadsSemResposta).toBe(2);
  });

  it("% entre cada par; sem base → null", () => {
    const j = computeEndToEndJourney(reached({ em_negociacao: 2, proposta: 1, reserva: 0, venda: 0 }), [row(S.NEW), row(S.IN_SERVICE)], start);
    // leads=2, atendimento=1 → 50%; atendimento→neg = 2/1 = 200% (fluxo cruza coortes); ...
    expect(j.transitions[0].conv).toBeCloseTo(0.5); // leads(2)→atendimento(1)
    expect(j.transitions[3].conv).toBe(0); // proposta(1)→reserva(0) = 0/1 = 0
    expect(j.transitions[4].conv).toBeNull(); // reserva(0)→venda(0): from=0 → null
  });

  it("tons: leads/atendimento = lead; negociação = negotiation", () => {
    const j = computeEndToEndJourney(reached({}), [], start);
    expect(j.stages.filter((s) => s.tone === "lead").map((s) => s.key)).toEqual(["leads", "atendimento"]);
    expect(j.stages.filter((s) => s.tone === "negotiation").map((s) => s.key)).toEqual(["em_negociacao", "proposta", "reserva", "venda"]);
  });

  it("leads fora do período não contam", () => {
    const j = computeEndToEndJourney(reached({}), [row(S.NEW, 60), row(S.IN_SERVICE, 5)], start);
    expect(j.stages[0].count).toBe(1); // só o de 5 dias
  });
});
