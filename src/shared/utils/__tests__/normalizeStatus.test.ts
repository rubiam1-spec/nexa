import { describe, it, expect } from "vitest";
import {
  normalizeNegotiationStatus,
  isNegotiationActive,
  VALID_NEGOTIATION_STATUSES,
  NEGOTIATION_DONE_STATUSES,
} from "../normalizeStatus";

describe("normalizeNegotiationStatus", () => {
  it("uppercase passthrough: OPEN → OPEN", () => {
    expect(normalizeNegotiationStatus("OPEN")).toBe("OPEN");
  });
  it("uppercase passthrough: IN_PROGRESS → IN_PROGRESS", () => {
    expect(normalizeNegotiationStatus("IN_PROGRESS")).toBe("IN_PROGRESS");
  });
  it("lowercase alias: open → OPEN", () => {
    expect(normalizeNegotiationStatus("open")).toBe("OPEN");
  });
  it("pt-BR alias: vendida → WON", () => {
    expect(normalizeNegotiationStatus("vendida")).toBe("WON");
  });
  it("pt-BR alias: perdida → LOST", () => {
    expect(normalizeNegotiationStatus("perdida")).toBe("LOST");
  });
  it("pt-BR alias: cancelada → CANCELLED", () => {
    expect(normalizeNegotiationStatus("cancelada")).toBe("CANCELLED");
  });
  it("pt-BR alias: em_andamento → IN_PROGRESS", () => {
    expect(normalizeNegotiationStatus("em_andamento")).toBe("IN_PROGRESS");
  });
  it("desconhecido → fallback OPEN", () => {
    expect(normalizeNegotiationStatus("xyz")).toBe("OPEN");
  });
  it("null → OPEN", () => {
    expect(normalizeNegotiationStatus(null)).toBe("OPEN");
  });
  it("undefined → OPEN", () => {
    expect(normalizeNegotiationStatus(undefined)).toBe("OPEN");
  });
});

describe("isNegotiationActive", () => {
  it("OPEN é ativa", () => expect(isNegotiationActive("OPEN")).toBe(true));
  it("IN_PROGRESS é ativa", () => expect(isNegotiationActive("IN_PROGRESS")).toBe(true));
  it("PROPOSAL é ativa", () => expect(isNegotiationActive("PROPOSAL")).toBe(true));
  it("WON NÃO é ativa", () => expect(isNegotiationActive("WON")).toBe(false));
  it("LOST NÃO é ativa", () => expect(isNegotiationActive("LOST")).toBe(false));
  it("CANCELLED NÃO é ativa", () => expect(isNegotiationActive("CANCELLED")).toBe(false));
  it("null → OPEN (ativa)", () => expect(isNegotiationActive(null)).toBe(true));
  it("alias vendida → WON (inativa)", () => expect(isNegotiationActive("vendida")).toBe(false));
});

describe("Constantes de status", () => {
  it("VALID tem 7 status", () => {
    expect(VALID_NEGOTIATION_STATUSES).toHaveLength(7);
  });
  it("DONE tem 3 status", () => {
    expect(NEGOTIATION_DONE_STATUSES).toHaveLength(3);
  });
  it("DONE são subconjunto de VALID", () => {
    for (const s of NEGOTIATION_DONE_STATUSES) {
      expect(VALID_NEGOTIATION_STATUSES).toContain(s);
    }
  });
});
