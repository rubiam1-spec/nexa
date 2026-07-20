import { describe, it, expect } from "vitest";
import { mapStatus } from "../statusMapping";
import type { NegotiationStatus } from "../types";

describe("mapStatus — auto-mapeamento de status do importador", () => {
  const ENUM: NegotiationStatus[] = [
    "OPEN",
    "IN_PROGRESS",
    "PROPOSAL",
    "RESERVATION",
    "WON",
    "LOST",
    "CANCELLED",
  ];

  it("IDENTIDADE: cada membro do enum mapeia para si mesmo, sem 'a revisar'", () => {
    for (const s of ENUM) {
      expect(mapStatus(s)).toEqual({
        status: s,
        classe: s === "WON" || s === "LOST" || s === "CANCELLED" ? "arquivada" : "ativa",
        revisar: false,
      });
    }
  });

  it("IDENTIDADE tolera caixa/espacos (trim + uppercase)", () => {
    expect(mapStatus("  won ").status).toBe("WON");
    expect(mapStatus("in_progress").status).toBe("IN_PROGRESS");
    expect(mapStatus("Cancelled").revisar).toBe(false);
  });

  it("SINÔNIMOS PT-BR mapeiam corretamente e sem 'a revisar'", () => {
    expect(mapStatus("Vendido").status).toBe("WON");
    expect(mapStatus("vendida").status).toBe("WON");
    expect(mapStatus("Ganho").status).toBe("WON");
    expect(mapStatus("Perdido").status).toBe("LOST");
    expect(mapStatus("perdida").status).toBe("LOST");
    expect(mapStatus("Cancelado").status).toBe("CANCELLED");
    expect(mapStatus("cancelada").status).toBe("CANCELLED");
    expect(mapStatus("Proposta enviada").status).toBe("PROPOSAL");
    expect(mapStatus("Reserva").status).toBe("RESERVATION");
    expect(mapStatus("Em negociação").status).toBe("IN_PROGRESS");
    expect(mapStatus("Negociando").status).toBe("IN_PROGRESS");
    expect(mapStatus("Em aberto").status).toBe("OPEN");
    expect(mapStatus("Novo").status).toBe("OPEN");
    // sinônimos reconhecidos não pedem revisão
    expect(mapStatus("Vendido").revisar).toBe(false);
    expect(mapStatus("Em aberto").revisar).toBe(false);
  });

  it("'venda NÃO efetivada' não vira WON (guarda de negação)", () => {
    expect(mapStatus("Venda não efetivada").status).not.toBe("WON");
  });

  it("VALOR DESCONHECIDO cai no default OPEN com 'a revisar'", () => {
    const r = mapStatus("xpto qualquer coisa");
    expect(r.status).toBe("OPEN");
    expect(r.revisar).toBe(true);
    expect(r.classe).toBe("ativa");
  });

  it("vazio/placeholder → OPEN com 'a revisar'", () => {
    expect(mapStatus("").revisar).toBe(true);
    expect(mapStatus("---").revisar).toBe(true);
  });
});
