import { describe, it, expect } from "vitest";
import { ProposalService } from "../proposta/ProposalService";
import { ProposalStatus } from "../proposta/ProposalStatus";
import { getProposalStatusLabel } from "../proposta/ProposalStatusLabel";
import type { Proposal } from "../../shared/types/proposal";

function makeProp(status: Proposal["status"]): Proposal {
  return {
    id: "prop-1", negotiationId: "neg-1", accountId: "acc-1",
    developmentId: "dev-1", unitId: "unit-1", clientId: null, brokerId: null,
    title: "Proposta Lote Q1-L4", amount: 948750, status,
    tipo: "standard", entradaTipo: null, entradaValor: null, entradaPercentual: null,
    parcelasQuantidade: null, parcelasValor: null, balaoQuantidade: null, balaoValor: null,
    permutaValor: null, permutaDescricao: null, observacoes: null, simulationId: null, createdBy: null,
    createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("ProposalStatus — constantes", () => {
  it("define 7 estados", () => {
    expect(Object.values(ProposalStatus)).toHaveLength(7);
  });
});

describe("ProposalService", () => {
  describe("podeEnviar", () => {
    it("DRAFT pode enviar", () => expect(ProposalService.podeEnviar(makeProp("DRAFT"))).toBe(true));
    it("SENT NÃO pode enviar", () => expect(ProposalService.podeEnviar(makeProp("SENT"))).toBe(false));
    it("ACCEPTED NÃO pode enviar", () => expect(ProposalService.podeEnviar(makeProp("ACCEPTED"))).toBe(false));
  });

  describe("podeColocarEmAnalise", () => {
    it("SENT pode colocar em análise", () => expect(ProposalService.podeColocarEmAnalise(makeProp("SENT"))).toBe(true));
    it("DRAFT NÃO pode", () => expect(ProposalService.podeColocarEmAnalise(makeProp("DRAFT"))).toBe(false));
  });

  describe("podeAceitar", () => {
    it("SENT pode aceitar", () => expect(ProposalService.podeAceitar(makeProp("SENT"))).toBe(true));
    it("UNDER_ANALYSIS pode aceitar", () => expect(ProposalService.podeAceitar(makeProp("UNDER_ANALYSIS"))).toBe(true));
    it("DRAFT NÃO pode aceitar", () => expect(ProposalService.podeAceitar(makeProp("DRAFT"))).toBe(false));
    it("REJECTED NÃO pode aceitar", () => expect(ProposalService.podeAceitar(makeProp("REJECTED"))).toBe(false));
  });

  describe("podeRecusar", () => {
    it("DRAFT pode recusar", () => expect(ProposalService.podeRecusar(makeProp("DRAFT"))).toBe(true));
    it("SENT pode recusar", () => expect(ProposalService.podeRecusar(makeProp("SENT"))).toBe(true));
    it("UNDER_ANALYSIS pode recusar", () => expect(ProposalService.podeRecusar(makeProp("UNDER_ANALYSIS"))).toBe(true));
    it("ACCEPTED NÃO pode recusar", () => expect(ProposalService.podeRecusar(makeProp("ACCEPTED"))).toBe(false));
    it("EXPIRED NÃO pode recusar", () => expect(ProposalService.podeRecusar(makeProp("EXPIRED"))).toBe(false));
  });

  describe("isActionable", () => {
    it("DRAFT é acionável", () => expect(ProposalService.isActionable(makeProp("DRAFT"))).toBe(true));
    it("SENT é acionável", () => expect(ProposalService.isActionable(makeProp("SENT"))).toBe(true));
    it("UNDER_ANALYSIS é acionável", () => expect(ProposalService.isActionable(makeProp("UNDER_ANALYSIS"))).toBe(true));
    it("ACCEPTED NÃO é acionável", () => expect(ProposalService.isActionable(makeProp("ACCEPTED"))).toBe(false));
    it("REJECTED NÃO é acionável", () => expect(ProposalService.isActionable(makeProp("REJECTED"))).toBe(false));
    it("EXPIRED NÃO é acionável", () => expect(ProposalService.isActionable(makeProp("EXPIRED"))).toBe(false));
    it("COUNTER_PROPOSAL NÃO é acionável", () => expect(ProposalService.isActionable(makeProp("COUNTER_PROPOSAL"))).toBe(false));
  });

  describe("alterarStatus", () => {
    it("retorna proposta com novo status sem mutar", () => {
      const p = makeProp("DRAFT");
      const updated = ProposalService.alterarStatus(p, "SENT");
      expect(updated.status).toBe("SENT");
      expect(p.status).toBe("DRAFT");
    });
  });
});

describe("getProposalStatusLabel", () => {
  it("DRAFT → Rascunho", () => expect(getProposalStatusLabel("DRAFT")).toBe("Rascunho"));
  it("SENT → Enviada", () => expect(getProposalStatusLabel("SENT")).toBe("Enviada"));
  it("UNDER_ANALYSIS → Em analise", () => expect(getProposalStatusLabel("UNDER_ANALYSIS")).toBe("Em analise"));
  it("ACCEPTED → Aceita", () => expect(getProposalStatusLabel("ACCEPTED")).toBe("Aceita"));
  it("REJECTED → Recusada", () => expect(getProposalStatusLabel("REJECTED")).toBe("Recusada"));
  it("EXPIRED → Expirada", () => expect(getProposalStatusLabel("EXPIRED")).toBe("Expirada"));
  it("COUNTER_PROPOSAL → Contraproposta", () => expect(getProposalStatusLabel("COUNTER_PROPOSAL")).toBe("Contraproposta"));
});
