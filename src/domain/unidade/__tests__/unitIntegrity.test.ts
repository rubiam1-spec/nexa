import { describe, it, expect } from "vitest";
import { buildIntegrityCards, isDataConsistent } from "../unitIntegrityIssues";
import { isDimmedInFocus, isFocusActive, focusBannerLabel } from "../unitIntegrityFocus";

describe("buildIntegrityCards — contadores → cards", () => {
  it("só issues com contagem > 0, ordenados por severidade (placar principal 1º)", () => {
    const cards = buildIntegrityCards({
      won_sem_unidade: 12,
      reservada_sem_reserva_ativa: 9,
      vendida_sem_registro_venda: 50,
      disponivel_com_vinculo_vivo: 0, // omitido (0)
      unidades_com_multiplas_vivas: 0, // omitido (0)
      em_negociacao_sem_negociacao_viva: 0, // omitido (0)
    });
    expect(cards.map((c) => c.id)).toEqual([
      "vendida_sem_registro_venda",
      "reservada_sem_reserva_ativa",
      "won_sem_unidade",
    ]);
    expect(cards[0]).toMatchObject({ count: 50, kind: "unit" });
    expect(cards[2]).toMatchObject({ count: 12, kind: "negotiation" });
  });

  it("ignora o legado vendida_sem_venda_nem_won", () => {
    const cards = buildIntegrityCards({ vendida_sem_venda_nem_won: 46 });
    expect(cards).toHaveLength(0);
  });

  it("zero-estado: sem contadores conhecidos > 0 → sem cards e consistente", () => {
    const counters = { vendida_sem_registro_venda: 0, won_sem_unidade: 0, vendida_sem_venda_nem_won: 46 };
    expect(buildIntegrityCards(counters)).toHaveLength(0);
    expect(isDataConsistent(counters)).toBe(true); // legado não conta
  });

  it("com divergência conhecida → não é consistente", () => {
    expect(isDataConsistent({ vendida_sem_registro_venda: 1 })).toBe(false);
  });

  it("null/undefined → vazio e não consistente", () => {
    expect(buildIntegrityCards(null)).toEqual([]);
    expect(isDataConsistent(undefined)).toBe(false);
  });
});

describe("unitIntegrityFocus — modo foco", () => {
  it("sem foco (null): nada esmaecido, foco inativo", () => {
    expect(isFocusActive(null)).toBe(false);
    expect(isDimmedInFocus("u1", null)).toBe(false);
  });

  it("com foco: fora do Set esmaece, dentro não", () => {
    const focus = new Set(["u1", "u2"]);
    expect(isFocusActive(focus)).toBe(true);
    expect(isDimmedInFocus("u3", focus)).toBe(true);
    expect(isDimmedInFocus("u1", focus)).toBe(false);
  });

  it("banner: singular/plural", () => {
    expect(focusBannerLabel(1, "vendidas sem registro de venda")).toBe("Mostrando 1 unidade: vendidas sem registro de venda");
    expect(focusBannerLabel(50, "vendidas sem registro de venda")).toBe("Mostrando 50 unidades: vendidas sem registro de venda");
  });
});
