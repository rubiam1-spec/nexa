import { describe, it, expect } from "vitest";
import { notificationSubject, unitLabel } from "../notificationSubject";

describe("notificationSubject — nome NUNCA vazio, proibido '()' (cap. A)", () => {
  it("cliente + unidade", () => {
    expect(notificationSubject({ clientName: "Fulano", quadra: 4, lote: 14 })).toBe("Fulano · Q4·L14");
  });
  it("só cliente (sem unidade) — sem parênteses vazios", () => {
    expect(notificationSubject({ clientName: "Fulano", quadra: null, lote: null })).toBe("Fulano");
  });
  it("cliente ausente + unidade → 'Sem cliente · Q4·L14'", () => {
    expect(notificationSubject({ clientName: "", quadra: 4, lote: 14 })).toBe("Sem cliente · Q4·L14");
  });
  it("cliente ausente + sem unidade + negId → código da negociação", () => {
    expect(notificationSubject({ clientName: null, negotiationId: "1a2b3c4d5e6f" })).toBe("Negociação #1a2b3c4d");
  });
  it("nada de nada → 'Sem cliente' (nunca vazio)", () => {
    expect(notificationSubject({})).toBe("Sem cliente");
  });
  it("nome só com espaços conta como ausente", () => {
    expect(notificationSubject({ clientName: "   ", quadra: 4, lote: 14 })).toBe("Sem cliente · Q4·L14");
  });
  it("PROIBIDO '()' — nenhuma combinação produz parênteses vazios", () => {
    const combos = [
      { clientName: "X", quadra: 1, lote: 2 },
      { clientName: "X" },
      { clientName: "", quadra: 1, lote: 2 },
      { clientName: "", quadra: 1 },
      { clientName: null, negotiationId: "abcdef123456" },
      {},
    ];
    for (const c of combos) {
      const s = notificationSubject(c);
      expect(s).not.toMatch(/\(\s*\)/);
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });
  it("unitLabel cobre quadra-só e lote-só", () => {
    expect(unitLabel(4, 14)).toBe("Q4·L14");
    expect(unitLabel(4, null)).toBe("Q4");
    expect(unitLabel(null, 14)).toBe("L14");
    expect(unitLabel(null, null)).toBeNull();
  });
});
