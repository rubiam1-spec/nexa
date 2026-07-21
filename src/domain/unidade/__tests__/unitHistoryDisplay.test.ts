import { describe, it, expect } from "vitest";
import { parseUnitHistoryAction, unitStatusLabelTolerant } from "../unitHistoryDisplay";

describe("unitHistoryDisplay — trilha tolerante PT-BR", () => {
  it("alteração manual: extrai o motivo embutido", () => {
    expect(parseUnitHistoryAction("manual_status_change: Ajuste de estoque")).toEqual({
      label: "Alteração manual de status",
      reason: "Ajuste de estoque",
    });
  });

  it("alteração manual sem motivo → reason null", () => {
    expect(parseUnitHistoryAction("manual_status_change:")).toEqual({
      label: "Alteração manual de status",
      reason: null,
    });
  });

  it("ações canônicas conhecidas", () => {
    expect(parseUnitHistoryAction("RESERVATION_ACTIVATED").label).toBe("Reserva ativada");
    expect(parseUnitHistoryAction("SALE_CREATED").label).toBe("Venda registrada");
    expect(parseUnitHistoryAction("historical_sale_registered").label).toBe("Venda histórica registrada");
    expect(parseUnitHistoryAction("imported").label).toBe("Importada");
  });

  it("ação desconhecida cai num humanize seguro (nunca quebra)", () => {
    expect(parseUnitHistoryAction("some_weird_action").label).toBe("Some weird action");
    expect(parseUnitHistoryAction("").label).toBe("—");
  });

  it("status de banco e enum → PT-BR; desconhecido/vazio tolerado", () => {
    expect(unitStatusLabelTolerant("available")).toBe("Disponível");
    expect(unitStatusLabelTolerant("sold")).toBe("Vendido");
    expect(unitStatusLabelTolerant("in_negotiation")).toBe("Em negociação");
    expect(unitStatusLabelTolerant("DISPONIVEL")).toBe("Disponível");
    expect(unitStatusLabelTolerant(null)).toBe("—");
    expect(unitStatusLabelTolerant("weird")).toBe("weird");
  });
});
