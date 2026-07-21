import { describe, it, expect } from "vitest";
import { historicalSaleErrorLabel } from "../historicalSaleReason";

describe("historicalSaleErrorLabel — mapa PT-BR do register_historical_sale", () => {
  it.each([
    ["not_authenticated", "Sessão expirada. Faça login novamente."],
    ["unit_not_found", "Unidade não encontrada."],
    ["forbidden", "Sem permissão para registrar venda."],
    ["client_not_found", "Comprador não encontrado."],
    ["sale_already_registered", "Esta unidade já tem venda registrada."],
    ["invalid_amount", "Valor inválido."],
  ])("mapeia %s", (code, expected) => {
    expect(historicalSaleErrorLabel(code)).toBe(expected);
  });

  it("reconhece o código mesmo dentro de mensagem maior (RAISE EXCEPTION)", () => {
    expect(historicalSaleErrorLabel('new row violates ... "sale_already_registered"')).toBe("Esta unidade já tem venda registrada.");
  });

  it("fallback para mensagem desconhecida", () => {
    expect(historicalSaleErrorLabel("boom")).toBe("Não foi possível registrar a venda. Tente novamente.");
    expect(historicalSaleErrorLabel("")).toBe("Não foi possível registrar a venda. Tente novamente.");
  });
});
