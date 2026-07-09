import { describe, it, expect } from "vitest";
import {
  columnOfStatus,
  stageLabelOfStatus,
  STAGES,
  STAGE_ORDER,
  FUNNEL_FLOW,
} from "../stageColumn";
import { NegotiationStatus } from "../../../../domain/status/negotiation";

describe("stageColumn — mapeamento estágio→coluna (Fase B)", () => {
  it("OPEN e IN_PROGRESS caem em 'em_negociacao'", () => {
    expect(columnOfStatus(NegotiationStatus.OPEN)).toBe("em_negociacao");
    expect(columnOfStatus(NegotiationStatus.IN_PROGRESS)).toBe("em_negociacao");
  });
  it("PROPOSAL → proposta, RESERVATION → reserva, WON → venda", () => {
    expect(columnOfStatus(NegotiationStatus.PROPOSAL)).toBe("proposta");
    expect(columnOfStatus(NegotiationStatus.RESERVATION)).toBe("reserva");
    expect(columnOfStatus(NegotiationStatus.WON)).toBe("venda");
  });
  it("LOST e CANCELLED caem em 'perdido'", () => {
    expect(columnOfStatus(NegotiationStatus.LOST)).toBe("perdido");
    expect(columnOfStatus(NegotiationStatus.CANCELLED)).toBe("perdido");
  });

  it("todo status canônico mapeia para uma coluna existente", () => {
    for (const s of Object.values(NegotiationStatus)) {
      const col = columnOfStatus(s);
      expect(STAGE_ORDER).toContain(col);
    }
  });

  it("rótulos canônicos de exibição", () => {
    expect(stageLabelOfStatus(NegotiationStatus.OPEN)).toBe("Em negociação");
    expect(stageLabelOfStatus(NegotiationStatus.PROPOSAL)).toBe("Proposta");
    expect(stageLabelOfStatus(NegotiationStatus.RESERVATION)).toBe("Reserva");
    expect(stageLabelOfStatus(NegotiationStatus.WON)).toBe("Venda");
    expect(stageLabelOfStatus(NegotiationStatus.LOST)).toBe("Perdido");
    expect(stageLabelOfStatus(NegotiationStatus.CANCELLED)).toBe("Perdido");
  });

  it("STAGES tem 5 colunas com cores distintas; FUNNEL_FLOW exclui perdido", () => {
    expect(STAGES).toHaveLength(5);
    const colors = new Set(STAGES.map((s) => s.color));
    expect(colors.size).toBe(5);
    expect(FUNNEL_FLOW).not.toContain("perdido");
    expect(FUNNEL_FLOW).toEqual(["em_negociacao", "proposta", "reserva", "venda"]);
  });
});
