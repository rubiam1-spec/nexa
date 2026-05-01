import { describe, it, expect } from "vitest";
import { getSaldoLabel } from "../utils/getSaldoLabel";

describe("getSaldoLabel", () => {
  it("null → default incorporadora", () => {
    const r = getSaldoLabel(null);
    expect(r.titulo).toContain("incorporadora");
    expect(r.subtitulo).toContain("sem juros");
  });

  it("parcelas_incorporadora → texto padrão", () => {
    const r = getSaldoLabel({ tipoSaldo: "parcelas_incorporadora", textoSaldoPersonalizado: null });
    expect(r.titulo).toContain("incorporadora");
  });

  it("financiamento_bancario → texto financiamento", () => {
    const r = getSaldoLabel({ tipoSaldo: "financiamento_bancario", textoSaldoPersonalizado: null });
    expect(r.titulo).toContain("financiamento");
    expect(r.subtitulo).toContain("crédito");
  });

  it("saldo_entrega → texto entrega", () => {
    const r = getSaldoLabel({ tipoSaldo: "saldo_entrega", textoSaldoPersonalizado: null });
    expect(r.titulo).toContain("entrega");
    expect(r.subtitulo).toContain("FGTS");
  });

  it("texto personalizado sobrescreve tipo", () => {
    const r = getSaldoLabel({ tipoSaldo: "financiamento_bancario", textoSaldoPersonalizado: "Meu texto custom" });
    expect(r.titulo).toBe("Meu texto custom");
    expect(r.subtitulo).toBe("");
  });

  it("tipo desconhecido → fallback incorporadora", () => {
    const r = getSaldoLabel({ tipoSaldo: "xyz", textoSaldoPersonalizado: null });
    expect(r.titulo).toContain("incorporadora");
  });
});
