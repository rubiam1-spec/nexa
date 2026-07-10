import { describe, it, expect } from "vitest";
import { computeLeadSnapshot, computeEntryConversion, type LeadFunnelRow } from "../leadFunnel";
import { LeadQualificationStatus as S } from "../../../../domain/status/leadQualification";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 10); // 2026-07-10
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function row(q: LeadFunnelRow["qualification"], msAgo = DAY): LeadFunnelRow {
  return { createdAt: iso(msAgo), qualification: q };
}

describe("computeLeadSnapshot — quebra novos/atendimento (fonte única)", () => {
  it("novos = NEW; emAtendimento = IN_SERVICE + QUALIFIED; ativos = soma", () => {
    const rows = [
      row(S.NEW), row(S.NEW),
      row(S.IN_SERVICE),
      row(S.QUALIFIED), row(S.QUALIFIED),
      row(S.CONVERTED), row(S.DISCARDED), // terminais não contam como ativos
    ];
    const snap = computeLeadSnapshot(rows);
    expect(snap.novos).toBe(2);
    expect(snap.emAtendimento).toBe(3);
    expect(snap.ativos).toBe(5);
  });

  it("lista vazia → tudo zero", () => {
    expect(computeLeadSnapshot([])).toEqual({ novos: 0, emAtendimento: 0, ativos: 0 });
  });

  it("ativos é exatamente novos + emAtendimento (nunca conta terminais)", () => {
    const snap = computeLeadSnapshot([row(S.CONVERTED), row(S.DISCARDED)]);
    expect(snap.ativos).toBe(0);
  });
});

describe("computeEntryConversion — coorte por período (Leads → Negociações)", () => {
  const start = NOW - 30 * DAY; // últimos 30 dias

  it("conta só leads criados no período; convertidos ÷ criados", () => {
    const rows = [
      row(S.CONVERTED, 5 * DAY),   // dentro, convertido
      row(S.NEW, 10 * DAY),         // dentro, não convertido
      row(S.QUALIFIED, 20 * DAY),   // dentro, não convertido
      row(S.CONVERTED, 60 * DAY),   // FORA do período — ignorado
    ];
    const e = computeEntryConversion(rows, start);
    expect(e.leadsCriados).toBe(3);
    expect(e.convertidos).toBe(1);
    expect(e.taxa).toBeCloseTo(1 / 3);
  });

  it("sem leads criados no período → taxa null (UI mostra —)", () => {
    const e = computeEntryConversion([row(S.CONVERTED, 90 * DAY)], start);
    expect(e.leadsCriados).toBe(0);
    expect(e.taxa).toBeNull();
  });

  it("createdAt inválido é ignorado (nunca inventa)", () => {
    const rows: LeadFunnelRow[] = [{ createdAt: "não-é-data", qualification: S.CONVERTED }];
    const e = computeEntryConversion(rows, start);
    expect(e.leadsCriados).toBe(0);
    expect(e.taxa).toBeNull();
  });

  it("100% quando todos os criados no período converteram", () => {
    const e = computeEntryConversion([row(S.CONVERTED, 2 * DAY), row(S.CONVERTED, 3 * DAY)], start);
    expect(e.taxa).toBe(1);
  });
});
