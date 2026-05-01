import { describe, it, expect } from "vitest";
import { UnidadeService } from "../unidade/UnidadeService";
import { UnidadeStatus } from "../unidade/UnidadeStatus";
import { getUnidadeStatusLabel } from "../unidade/UnidadeStatusLabel";
import type { Unidade } from "../unidade/Unidade";

function makeUnit(status: Unidade["status"]): Unidade {
  return {
    id: "unit-1", accountId: "acc-1", empreendimentoId: "dev-1",
    quadra: "Q1", lote: "L4", valor: 1035000,
    status, createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("UnidadeStatus — constantes", () => {
  it("define 4 estados", () => {
    expect(Object.values(UnidadeStatus)).toHaveLength(4);
  });
});

describe("UnidadeService — validações", () => {
  describe("podeEntrarEmNegociacao", () => {
    it("DISPONIVEL pode", () => expect(UnidadeService.podeEntrarEmNegociacao(makeUnit("DISPONIVEL"))).toBe(true));
    it("EM_NEGOCIACAO NÃO pode", () => expect(UnidadeService.podeEntrarEmNegociacao(makeUnit("EM_NEGOCIACAO"))).toBe(false));
    it("RESERVADO NÃO pode", () => expect(UnidadeService.podeEntrarEmNegociacao(makeUnit("RESERVADO"))).toBe(false));
    it("VENDIDO NÃO pode", () => expect(UnidadeService.podeEntrarEmNegociacao(makeUnit("VENDIDO"))).toBe(false));
  });

  describe("podeReservar", () => {
    it("DISPONIVEL pode", () => expect(UnidadeService.podeReservar(makeUnit("DISPONIVEL"))).toBe(true));
    it("EM_NEGOCIACAO NÃO pode reservar diretamente", () => expect(UnidadeService.podeReservar(makeUnit("EM_NEGOCIACAO"))).toBe(false));
    it("VENDIDO NÃO pode", () => expect(UnidadeService.podeReservar(makeUnit("VENDIDO"))).toBe(false));
  });

  describe("podeMarcarComoReservadaNoFluxo", () => {
    it("DISPONIVEL pode", () => expect(UnidadeService.podeMarcarComoReservadaNoFluxo(makeUnit("DISPONIVEL"))).toBe(true));
    it("EM_NEGOCIACAO pode", () => expect(UnidadeService.podeMarcarComoReservadaNoFluxo(makeUnit("EM_NEGOCIACAO"))).toBe(true));
    it("RESERVADO NÃO pode", () => expect(UnidadeService.podeMarcarComoReservadaNoFluxo(makeUnit("RESERVADO"))).toBe(false));
    it("VENDIDO NÃO pode", () => expect(UnidadeService.podeMarcarComoReservadaNoFluxo(makeUnit("VENDIDO"))).toBe(false));
  });

  describe("podeVender", () => {
    it("RESERVADO pode", () => expect(UnidadeService.podeVender(makeUnit("RESERVADO"))).toBe(true));
    it("DISPONIVEL NÃO pode", () => expect(UnidadeService.podeVender(makeUnit("DISPONIVEL"))).toBe(false));
    it("EM_NEGOCIACAO NÃO pode", () => expect(UnidadeService.podeVender(makeUnit("EM_NEGOCIACAO"))).toBe(false));
    it("VENDIDO NÃO pode (já vendido)", () => expect(UnidadeService.podeVender(makeUnit("VENDIDO"))).toBe(false));
  });

  describe("podeLiberarNoFluxo", () => {
    it("EM_NEGOCIACAO pode liberar", () => expect(UnidadeService.podeLiberarNoFluxo(makeUnit("EM_NEGOCIACAO"))).toBe(true));
    it("RESERVADO pode liberar", () => expect(UnidadeService.podeLiberarNoFluxo(makeUnit("RESERVADO"))).toBe(true));
    it("DISPONIVEL NÃO pode", () => expect(UnidadeService.podeLiberarNoFluxo(makeUnit("DISPONIVEL"))).toBe(false));
    it("VENDIDO NÃO pode", () => expect(UnidadeService.podeLiberarNoFluxo(makeUnit("VENDIDO"))).toBe(false));
  });
});

describe("UnidadeService — transições", () => {
  it("entrarEmNegociacao: DISPONIVEL → EM_NEGOCIACAO", () => {
    const u = UnidadeService.entrarEmNegociacao(makeUnit("DISPONIVEL"));
    expect(u.status).toBe("EM_NEGOCIACAO");
  });

  it("entrarEmNegociacao: EM_NEGOCIACAO lança erro", () => {
    expect(() => UnidadeService.entrarEmNegociacao(makeUnit("EM_NEGOCIACAO"))).toThrow();
  });

  it("marcarComoReservadaNoFluxo: EM_NEGOCIACAO → RESERVADO", () => {
    const u = UnidadeService.marcarComoReservadaNoFluxo(makeUnit("EM_NEGOCIACAO"));
    expect(u.status).toBe("RESERVADO");
  });

  it("marcarComoReservadaNoFluxo: VENDIDO lança erro", () => {
    expect(() => UnidadeService.marcarComoReservadaNoFluxo(makeUnit("VENDIDO"))).toThrow();
  });

  it("liberarNoFluxo: RESERVADO → DISPONIVEL", () => {
    const u = UnidadeService.liberarNoFluxo(makeUnit("RESERVADO"));
    expect(u.status).toBe("DISPONIVEL");
  });

  it("liberarNoFluxo: DISPONIVEL lança erro", () => {
    expect(() => UnidadeService.liberarNoFluxo(makeUnit("DISPONIVEL"))).toThrow();
  });

  it("marcarComoVendida: RESERVADO → VENDIDO", () => {
    const u = UnidadeService.marcarComoVendida(makeUnit("RESERVADO"));
    expect(u.status).toBe("VENDIDO");
  });

  it("marcarComoVendida: DISPONIVEL lança erro", () => {
    expect(() => UnidadeService.marcarComoVendida(makeUnit("DISPONIVEL"))).toThrow();
  });

  it("não muta o objeto original", () => {
    const u = makeUnit("DISPONIVEL");
    UnidadeService.entrarEmNegociacao(u);
    expect(u.status).toBe("DISPONIVEL");
  });
});

describe("Fluxo completo da unidade: DISPONIVEL → EM_NEGOCIACAO → RESERVADO → VENDIDO", () => {
  it("ciclo de vida completo funciona", () => {
    let u = makeUnit("DISPONIVEL");
    u = UnidadeService.entrarEmNegociacao(u);
    expect(u.status).toBe("EM_NEGOCIACAO");
    u = UnidadeService.marcarComoReservadaNoFluxo(u);
    expect(u.status).toBe("RESERVADO");
    u = UnidadeService.marcarComoVendida(u);
    expect(u.status).toBe("VENDIDO");
  });

  it("cancelamento: EM_NEGOCIACAO → DISPONIVEL", () => {
    let u = makeUnit("DISPONIVEL");
    u = UnidadeService.entrarEmNegociacao(u);
    u = UnidadeService.liberarNoFluxo(u);
    expect(u.status).toBe("DISPONIVEL");
  });

  it("cancelamento de reserva: RESERVADO → DISPONIVEL", () => {
    let u = makeUnit("RESERVADO");
    u = UnidadeService.liberarNoFluxo(u);
    expect(u.status).toBe("DISPONIVEL");
  });
});

describe("getUnidadeStatusLabel", () => {
  it("DISPONIVEL → Disponível", () => expect(getUnidadeStatusLabel("DISPONIVEL")).toBe("Disponível"));
  it("EM_NEGOCIACAO → Em negociação", () => expect(getUnidadeStatusLabel("EM_NEGOCIACAO")).toBe("Em negociação"));
  it("RESERVADO → Reservado", () => expect(getUnidadeStatusLabel("RESERVADO")).toBe("Reservado"));
  it("VENDIDO → Vendido", () => expect(getUnidadeStatusLabel("VENDIDO")).toBe("Vendido"));
});
