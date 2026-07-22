import { describe, it, expect } from "vitest";
import { buildSalesTruth, salesTruthTotals, salesTruthMonthly, salesTruthInWindow, type SaleTruthSaleRow, type SaleTruthWon } from "../salesTruth";

const sale = (p: Partial<SaleTruthSaleRow> & { id: string }): SaleTruthSaleRow => ({ negotiationId: null, unitId: null, amount: null, saleDate: null, status: "completed", createdAt: "2026-05-01T00:00:00Z", ...p });
const won = (p: Partial<SaleTruthWon> & { negotiationId: string }): SaleTruthWon => ({ unitId: null, valor: null, stageChangedAt: null, createdAt: "2026-05-01T00:00:00Z", ...p });

describe("buildSalesTruth — união com dedupe", () => {
  it("EQUIVALÊNCIA: sales vazio ⇒ união == WON (mesma contagem e ids)", () => {
    const w = [won({ negotiationId: "n1", unitId: "u1", valor: 100 }), won({ negotiationId: "n2", unitId: "u2", valor: 200 })];
    const items = buildSalesTruth([], w);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.negotiationId).sort()).toEqual(["n1", "n2"]);
    expect(items.every((i) => i.origin === "won_sem_registro")).toBe(true);
  });

  it("dedupe por negotiation_id: WON com sale de mesma negociação não duplica", () => {
    const s = [sale({ id: "s1", negotiationId: "n1", unitId: "uX", amount: 500 })];
    const w = [won({ negotiationId: "n1", unitId: "uX", valor: 500 })];
    const items = buildSalesTruth(s, w);
    expect(items).toHaveLength(1);
    expect(items[0].origin).toBe("registrada");
  });

  it("dedupe por unit_id: WON e sale na mesma unidade (negociações diferentes) não duplica", () => {
    const s = [sale({ id: "s1", negotiationId: "nA", unitId: "u9", amount: 700 })];
    const w = [won({ negotiationId: "nB", unitId: "u9", valor: 700 })];
    expect(buildSalesTruth(s, w)).toHaveLength(1);
  });

  it("sem overlap: sale + WON distintos somam", () => {
    const s = [sale({ id: "s1", negotiationId: "n1", unitId: "u1", amount: 100 })];
    const w = [won({ negotiationId: "n2", unitId: "u2", valor: 200 })];
    const items = buildSalesTruth(s, w);
    expect(items).toHaveLength(2);
    expect(items.filter((i) => i.origin === "registrada")).toHaveLength(1);
    expect(items.filter((i) => i.origin === "won_sem_registro")).toHaveLength(1);
  });

  it("cadeia de datas: sale_date preferido; WON usa stage_changed_at; fallback created_at", () => {
    const s = buildSalesTruth([sale({ id: "s1", saleDate: "2026-03-10", createdAt: "2026-05-01T00:00:00Z" })], [])[0];
    expect(s.dateIso).toBe("2026-03-10");
    const wStage = buildSalesTruth([], [won({ negotiationId: "n1", stageChangedAt: "2026-02-15T00:00:00Z", createdAt: "2026-05-01T00:00:00Z" })])[0];
    expect(wStage.dateIso).toBe("2026-02-15T00:00:00Z");
    const wFallback = buildSalesTruth([], [won({ negotiationId: "n2", stageChangedAt: null, createdAt: "2026-01-05T00:00:00Z" })])[0];
    expect(wFallback.dateIso).toBe("2026-01-05T00:00:00Z");
  });

  it("cobertura: amount/valor nulo ou 0 ⇒ sem valor (nunca R$ 0)", () => {
    const items = buildSalesTruth(
      [sale({ id: "s1", amount: 0 }), sale({ id: "s2", amount: 300 })],
      [won({ negotiationId: "n3", valor: null })],
    );
    const t = salesTruthTotals(items);
    expect(t.count).toBe(3);
    expect(t.withValue).toBe(1); // só s2
    expect(t.vgv).toBe(300);
    expect(items.find((i) => i.id === "s1")!.amount).toBeNull();
    expect(items.find((i) => i.id === "s1")!.hasValue).toBe(false);
  });
});

describe("salesTruthMonthly + window", () => {
  const NOW = Date.parse("2026-07-15T12:00:00Z");
  it("série de 12 meses, agrupa por mês da venda", () => {
    const items = buildSalesTruth([], [
      won({ negotiationId: "n1", valor: 100, stageChangedAt: "2026-07-01T00:00:00Z" }),
      won({ negotiationId: "n2", valor: 200, stageChangedAt: "2026-07-20T00:00:00Z" }),
      won({ negotiationId: "n3", valor: 50, stageChangedAt: "2026-06-10T00:00:00Z" }),
    ]);
    const m = salesTruthMonthly(items, NOW, 12);
    expect(m).toHaveLength(12);
    const jul = m[m.length - 1];
    expect(jul.count).toBe(2);
    expect(jul.vgv).toBe(300);
    const jun = m[m.length - 2];
    expect(jun.count).toBe(1);
  });

  it("salesTruthInWindow filtra pela data da venda", () => {
    const items = buildSalesTruth([], [
      won({ negotiationId: "n1", stageChangedAt: "2026-07-10T00:00:00Z" }),
      won({ negotiationId: "n2", stageChangedAt: "2026-01-10T00:00:00Z" }),
    ]);
    const start = Date.parse("2026-07-01T00:00:00Z");
    expect(salesTruthInWindow(items, start, NOW)).toHaveLength(1);
  });
});
