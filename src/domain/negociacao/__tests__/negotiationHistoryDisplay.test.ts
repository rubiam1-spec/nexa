import { describe, it, expect } from "vitest";
import { describeNegotiationHistoryAction } from "../negotiationHistoryDisplay";
import { NegotiationHistoryAction } from "../NegotiationHistoryAction";

describe("describeNegotiationHistoryAction — tolerância por contrato", () => {
  it("ação conhecida → rótulo específico, sem title bruto", () => {
    expect(describeNegotiationHistoryAction(NegotiationHistoryAction.SALE_COMPLETED)).toEqual({
      label: "Venda concluída",
      rawTitle: null,
    });
  });

  it("unit_unlinked_conflict → rótulo de conflito de disputa", () => {
    expect(describeNegotiationHistoryAction("unit_unlinked_conflict")).toEqual({
      label: "Unidade desvinculada (conflito de disputa resolvido)",
      rawTitle: null,
    });
  });

  it("ação desconhecida → rótulo genérico + ação bruta no title (NUNCA lança)", () => {
    expect(() => describeNegotiationHistoryAction("nova_acao_do_backend")).not.toThrow();
    expect(describeNegotiationHistoryAction("nova_acao_do_backend")).toEqual({
      label: "Atualização do registro",
      rawTitle: "nova_acao_do_backend",
    });
  });
});
