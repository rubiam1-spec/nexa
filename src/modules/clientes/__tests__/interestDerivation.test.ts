// Ficha Viva · FASE 2 — testes da derivação do interesse.
import { describe, it, expect } from "vitest";
import {
  deriveInterestFromSimulation, formatPaymentSuggestion, planInterestSuggestion,
  declareField, interestSourceOf, type InterestSources,
} from "../interestDerivation";

const sim = { id: "s1", valorTotal: 862500, entradaPercentual: 20, parcelasQuantidade: 120, createdAt: "2026-07-22T15:00:00Z" };

describe("deriveInterestFromSimulation", () => {
  it("interesse=lote_urbano, budget_max=valor, payment='parcelado · entrada X% · Nx'", () => {
    const d = deriveInterestFromSimulation(sim);
    expect(d.values.interesse).toBe("lote_urbano");
    expect(d.values.budget_max).toBe(862500);
    expect(d.values.payment_preference).toBe("parcelado · entrada 20% · 120x");
  });
  it("cada campo derivado carrega a origem (simulation, ref, at=YYYY-MM-DD)", () => {
    const d = deriveInterestFromSimulation(sim);
    for (const f of ["interesse", "budget_max", "payment_preference"]) {
      expect(d.sources[f]).toEqual({ origin: "simulation", ref: "s1", at: "2026-07-22" });
    }
  });
});

describe("formatPaymentSuggestion — partes só com dado", () => {
  it("sem entrada e sem parcelas → só 'parcelado'", () => {
    expect(formatPaymentSuggestion(null, null)).toBe("parcelado");
    expect(formatPaymentSuggestion(0, 0)).toBe("parcelado");
  });
  it("arredonda a entrada", () => {
    expect(formatPaymentSuggestion(19.6, 60)).toBe("parcelado · entrada 20% · 60x");
  });
});

describe("planInterestSuggestion — só preenche vazio e não declarado", () => {
  const derived = deriveInterestFromSimulation(sim);

  it("tudo vazio → grava os 3 campos + origens", () => {
    const plan = planInterestSuggestion({ interesse: null, budget_max: null, payment_preference: null }, {}, derived);
    expect(plan).not.toBeNull();
    expect(plan!.values).toEqual({ interesse: "lote_urbano", budget_max: 862500, payment_preference: "parcelado · entrada 20% · 120x" });
    expect(Object.keys(plan!.sources).sort()).toEqual(["budget_max", "interesse", "payment_preference"]);
  });

  it("campo DECLARADO (valor, sem origem) é respeitado — não sobrescreve", () => {
    const plan = planInterestSuggestion({ interesse: "casa", budget_max: null, payment_preference: null }, {}, derived);
    expect(plan!.values.interesse).toBeUndefined(); // 'casa' declarado fica
    expect(plan!.values.budget_max).toBe(862500);
  });

  it("campo já rastreado e depois esvaziado pelo humano → não re-sugere", () => {
    const src: InterestSources = { budget_max: { origin: "simulation", ref: "old", at: "2026-01-01" } };
    // budget_max vazio mas com origem antiga (ex.: limpo pelo humano após sugestão) → respeita
    const plan = planInterestSuggestion({ interesse: null, budget_max: null, payment_preference: null }, src, derived);
    expect(plan!.values.budget_max).toBeUndefined();
    expect(plan!.values.interesse).toBe("lote_urbano");
  });

  it("nada a fazer → null", () => {
    const plan = planInterestSuggestion({ interesse: "casa", budget_max: 100, payment_preference: "cash" }, {}, derived);
    expect(plan).toBeNull();
  });
});

describe("declareField / interestSourceOf — derivado→declarado ao editar", () => {
  it("declareField remove a origem do campo", () => {
    const src: InterestSources = { interesse: { origin: "simulation", ref: "s1", at: "2026-07-22" }, budget_max: { origin: "simulation", ref: "s1", at: "2026-07-22" } };
    const next = declareField(src, "interesse");
    expect(next.interesse).toBeUndefined();
    expect(next.budget_max).toBeDefined(); // outros intactos
  });
  it("interestSourceOf devolve a origem (badge) ou null (declarado)", () => {
    const src: InterestSources = { interesse: { origin: "simulation", ref: "s1", at: "2026-07-22" } };
    expect(interestSourceOf(src, "interesse")?.at).toBe("2026-07-22");
    expect(interestSourceOf(src, "budget_max")).toBeNull();
    expect(interestSourceOf(null, "interesse")).toBeNull();
  });
});
