import { describe, it, expect } from "vitest";
import { formatHistoricalStatus } from "../formatHistoricalStatus";
import { isNegotiationActive } from "../../../domain/status/negotiation";

describe("formatHistoricalStatus — tradutor de exibição de auditoria (tolerante)", () => {
  // Valores legados REAIS confirmados em negotiation_history (produção).
  it("traduz valores legados de proposta/reserva (UPPER)", () => {
    expect(formatHistoricalStatus("DRAFT")).toBe("Rascunho");
    expect(formatHistoricalStatus("SENT")).toBe("Enviada");
    expect(formatHistoricalStatus("UNDER_ANALYSIS")).toBe("Em análise");
    expect(formatHistoricalStatus("REQUESTED")).toBe("Solicitada");
    expect(formatHistoricalStatus("APPROVED")).toBe("Aprovada");
    expect(formatHistoricalStatus("IN_PROGRESS")).toBe("Em andamento");
  });
  it("tolerante a case e vocabulário EN/PT", () => {
    expect(formatHistoricalStatus("draft")).toBe("Rascunho");
    expect(formatHistoricalStatus("active")).toBe("Ativa");
    expect(formatHistoricalStatus("convertida")).toBe("Convertida");
    expect(formatHistoricalStatus("vendida")).toBe("Ganha");
  });
  it("null/vazio → travessão (nunca quebra a timeline)", () => {
    expect(formatHistoricalStatus(null)).toBe("—");
    expect(formatHistoricalStatus(undefined)).toBe("—");
    expect(formatHistoricalStatus("")).toBe("—");
  });
  it("fallback: valor desconhecido é exibido cru", () => {
    expect(formatHistoricalStatus("VALOR_LEGADO_ESTRANHO")).toBe("VALOR_LEGADO_ESTRANHO");
  });
});

describe("isNegotiationActive — lógica ESTRITA (fonte única)", () => {
  it("estados vivos ativos", () => {
    expect(isNegotiationActive("OPEN")).toBe(true);
    expect(isNegotiationActive("IN_PROGRESS")).toBe(true);
    expect(isNegotiationActive("PROPOSAL")).toBe(true);
    expect(isNegotiationActive("RESERVATION")).toBe(true);
  });
  it("estados terminais NÃO são ativos", () => {
    expect(isNegotiationActive("WON")).toBe(false);
    expect(isNegotiationActive("LOST")).toBe(false);
    expect(isNegotiationActive("CANCELLED")).toBe(false);
  });
  it("estrito: alias legado NÃO é reconhecido como terminal (só canônico)", () => {
    // "vendida" não é canônico → não está em DONE → tratado como ativo.
    // (Dados vivos são sempre canônicos pelo CHECK; isto documenta o comportamento estrito.)
    expect(isNegotiationActive("vendida")).toBe(true);
  });
});
