import { describe, it, expect } from "vitest";
import { NegotiationService } from "../negociacao/NegotiationService";
import { NegotiationStatus } from "../negociacao/NegotiationStatus";
import { getNegotiationStatusLabel } from "../negociacao/NegotiationStatusLabel";
import type { Negotiation } from "../../shared/types/negotiation";

function makeNeg(status: Negotiation["status"]): Negotiation {
  return {
    id: "neg-1", accountId: "acc-1", developmentId: "dev-1", unitId: "unit-1",
    clientId: null, brokerId: null, thirdPartyPropertyId: null,
    status, score: 50, temperature: "warm",
    createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("NegotiationStatus — constantes", () => {
  it("define 5 estados", () => {
    const values = Object.values(NegotiationStatus);
    expect(values).toHaveLength(5);
    expect(values).toContain("OPEN");
    expect(values).toContain("IN_PROGRESS");
    expect(values).toContain("WON");
    expect(values).toContain("LOST");
    expect(values).toContain("CANCELLED");
  });
});

describe("NegotiationService", () => {
  describe("podeIniciar", () => {
    it("OPEN pode iniciar", () => expect(NegotiationService.podeIniciar(makeNeg("OPEN"))).toBe(true));
    it("IN_PROGRESS NÃO pode iniciar", () => expect(NegotiationService.podeIniciar(makeNeg("IN_PROGRESS"))).toBe(false));
    it("WON NÃO pode iniciar", () => expect(NegotiationService.podeIniciar(makeNeg("WON"))).toBe(false));
    it("LOST NÃO pode iniciar", () => expect(NegotiationService.podeIniciar(makeNeg("LOST"))).toBe(false));
    it("CANCELLED NÃO pode iniciar", () => expect(NegotiationService.podeIniciar(makeNeg("CANCELLED"))).toBe(false));
  });

  describe("podeCancelar", () => {
    it("OPEN pode cancelar", () => expect(NegotiationService.podeCancelar(makeNeg("OPEN"))).toBe(true));
    it("IN_PROGRESS pode cancelar", () => expect(NegotiationService.podeCancelar(makeNeg("IN_PROGRESS"))).toBe(true));
    it("WON NÃO pode cancelar", () => expect(NegotiationService.podeCancelar(makeNeg("WON"))).toBe(false));
    it("LOST NÃO pode cancelar", () => expect(NegotiationService.podeCancelar(makeNeg("LOST"))).toBe(false));
    it("CANCELLED NÃO pode cancelar", () => expect(NegotiationService.podeCancelar(makeNeg("CANCELLED"))).toBe(false));
  });

  describe("podeCriarProposta", () => {
    it("OPEN pode criar proposta", () => expect(NegotiationService.podeCriarProposta(makeNeg("OPEN"))).toBe(true));
    it("IN_PROGRESS pode criar proposta", () => expect(NegotiationService.podeCriarProposta(makeNeg("IN_PROGRESS"))).toBe(true));
    it("WON NÃO pode", () => expect(NegotiationService.podeCriarProposta(makeNeg("WON"))).toBe(false));
    it("LOST NÃO pode", () => expect(NegotiationService.podeCriarProposta(makeNeg("LOST"))).toBe(false));
    it("CANCELLED NÃO pode", () => expect(NegotiationService.podeCriarProposta(makeNeg("CANCELLED"))).toBe(false));
  });

  describe("alterarStatus", () => {
    it("retorna negociação com novo status", () => {
      const neg = makeNeg("OPEN");
      const updated = NegotiationService.alterarStatus(neg, "IN_PROGRESS");
      expect(updated.status).toBe("IN_PROGRESS");
      expect(updated.id).toBe(neg.id);
    });
    it("não muta o objeto original", () => {
      const neg = makeNeg("OPEN");
      NegotiationService.alterarStatus(neg, "IN_PROGRESS");
      expect(neg.status).toBe("OPEN");
    });
  });
});

describe("getNegotiationStatusLabel", () => {
  it("OPEN → Aberta", () => expect(getNegotiationStatusLabel("OPEN")).toBe("Aberta"));
  it("IN_PROGRESS → Em negociação", () => expect(getNegotiationStatusLabel("IN_PROGRESS")).toBe("Em negociação"));
  it("WON → Ganha", () => expect(getNegotiationStatusLabel("WON")).toBe("Ganha"));
  it("LOST → Perdida", () => expect(getNegotiationStatusLabel("LOST")).toBe("Perdida"));
  it("CANCELLED → Cancelada", () => expect(getNegotiationStatusLabel("CANCELLED")).toBe("Cancelada"));
});
