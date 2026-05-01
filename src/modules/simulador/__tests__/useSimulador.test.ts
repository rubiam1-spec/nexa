import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSimulador } from "../hooks/useSimulador";

const UNIT_VALUE = 1035000;

const DEFAULT_SETTINGS = {
  entradaMinimaPct: 10, entradaMaximaPct: 80,
  entradaParceladaPermitida: true, entradaParceladaMaxVezes: 12,
  parcelasMinimas: 12, parcelasMaximas: 120,
  indicePreEntrega: "INCC" as const, indicePosEntrega: "IPCA" as const,
  dataEntregaEmpreendimento: null,
  carenciaMaximaMeses: 6,
  aceitaBalao: true, balaoMaxQuantidade: 12,
  aceitaPermuta: true, permutaTipos: ["veiculo", "terreno", "imovel"] as string[],
  permutaValorMaximoPct: 30,
  descontoMaximoPct: 5, comissaoCorretorPct: 4,
};

describe("useSimulador — Engine de Cálculo", () => {
  describe("Estado inicial", () => {
    it("calcula valores padrão: 20% entrada, 36 parcelas", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      const c = result.current.calculos;

      expect(c.valorOriginal).toBe(UNIT_VALUE);
      expect(c.valorNegociado).toBe(UNIT_VALUE);
      expect(c.desconto).toBe(0);
      expect(c.entradaValor).toBe(207000);
      expect(c.entradaPctEfetivo).toBeCloseTo(20, 0);
      expect(c.parcelaValor).toBe(23000);
      expect(c.saldoFinanciar).toBe(828000);
      expect(c.validacoes.somaConsistente).toBe(true);
      expect(c.validacoes.temErro).toBe(false);
    });

    it("sem settings usa defaults internos", () => {
      const { result } = renderHook(() => useSimulador(null, UNIT_VALUE));
      expect(result.current.calculos.valorOriginal).toBe(UNIT_VALUE);
      expect(result.current.calculos.entradaValor).toBe(207000);
    });
  });

  describe("Entrada", () => {
    it("30% de entrada = R$ 310.500", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setEntradaPct(30));
      expect(result.current.calculos.entradaValor).toBe(310500);
    });

    it("5% de entrada abaixo do mínimo (10%): flag de validação", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setEntradaPct(5));
      expect(result.current.calculos.validacoes.entradaAbaixoMinimo).toBe(true);
      expect(result.current.calculos.validacoes.temErro).toBe(true);
    });

    it("90% de entrada acima do máximo (80%): flag de validação", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setEntradaPct(90));
      expect(result.current.calculos.validacoes.entradaAcimaMaximo).toBe(true);
    });

    it("entrada por valor fixo: R$ 200.000", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.fixarEntradaValor(200000, UNIT_VALUE));
      const c = result.current.calculos;
      expect(c.entradaValor).toBe(200000);
      expect(c.entradaPctEfetivo).toBeCloseTo(19.32, 1);
    });

    it("entrada parcelada: 207.000 em 3x = 69.000/mês", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setEntradaParcelada(true);
        result.current.setEntradaParceladaVezes(3);
      });
      expect(result.current.calculos.entradaParceladaValor).toBe(69000);
    });
  });

  describe("Parcelas", () => {
    it("48x sem juros: parcela = 17.250", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setNumeroParcelas(48));
      expect(result.current.calculos.parcelaValor).toBeCloseTo(17250, 0);
    });

    it("12x sem juros: parcela = 69.000", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setNumeroParcelas(12));
      expect(result.current.calculos.parcelaValor).toBe(69000);
    });

    it("total das parcelas = saldo financiar (consistência)", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      const c = result.current.calculos;
      const total = c.parcelaValor * 36;
      expect(total).toBe(c.saldoFinanciar);
    });

    it("parcelas fora do range: flag de validação", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setNumeroParcelas(200));
      expect(result.current.calculos.validacoes.parcelasForaRange).toBe(true);
    });
  });

  describe("Parcela fixa (equilíbrio)", () => {
    it("fixar parcela em R$ 15.000 redistribui saldo", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.fixarParcelaValor(15000));
      const c = result.current.calculos;
      expect(c.parcelaValor).toBe(15000);
      expect(c.validacoes.somaConsistente).toBe(true);
    });

    it("limpar fixação retorna ao fluxo padrão", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.fixarParcelaValor(15000));
      expect(result.current.calculos.parcelaValor).toBe(15000);
      act(() => result.current.limparFixacao());
      expect(result.current.calculos.parcelaValor).toBe(23000);
    });
  });

  describe("Balão", () => {
    it("balão reduz saldo a parcelar", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setBalaoAtivo(true);
        result.current.setBalaoQuantidade(1);
        result.current.setBalaoValor(200000);
      });
      const c = result.current.calculos;
      expect(c.totalBalaos).toBe(200000);
      expect(c.saldoFinanciar).toBe(628000);
      expect(c.parcelaValor).toBeCloseTo(17444.44, 0);
    });

    it("múltiplos balões somam", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setBalaoAtivo(true);
        result.current.setBalaoQuantidade(6);
        result.current.setBalaoValor(50000);
      });
      expect(result.current.calculos.totalBalaos).toBe(300000);
    });

    it("entrada + parcelas + balão = valor negociado (consistência)", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setBalaoAtivo(true);
        result.current.setBalaoQuantidade(2);
        result.current.setBalaoValor(100000);
      });
      expect(result.current.calculos.validacoes.somaConsistente).toBe(true);
    });

    it("desativar balão recalcula parcela", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setBalaoAtivo(true);
        result.current.setBalaoQuantidade(1);
        result.current.setBalaoValor(200000);
      });
      const parcelaComBalao = result.current.calculos.parcelaValor;
      act(() => result.current.setBalaoAtivo(false));
      expect(result.current.calculos.parcelaValor).toBeGreaterThan(parcelaComBalao);
    });
  });

  describe("Permuta", () => {
    it("permuta reduz valor negociado no cálculo", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setPermutaAtiva(true);
        result.current.addPermutaItem();
      });
      act(() => {
        const item = result.current.permutaItens[0];
        result.current.updatePermutaItem(item.id, "valor", 100000);
      });
      const c = result.current.calculos;
      expect(c.totalPermuta).toBe(100000);
      expect(c.validacoes.somaConsistente).toBe(true);
    });

    it("permuta acima do limite: flag de validação", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setPermutaAtiva(true);
        result.current.addPermutaItem();
      });
      act(() => {
        const item = result.current.permutaItens[0];
        result.current.updatePermutaItem(item.id, "valor", 500000);
      });
      expect(result.current.calculos.validacoes.permutaAcimaLimite).toBe(true);
    });

    it("remover item de permuta recalcula", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setPermutaAtiva(true);
        result.current.addPermutaItem();
      });
      act(() => {
        const item = result.current.permutaItens[0];
        result.current.updatePermutaItem(item.id, "valor", 100000);
      });
      expect(result.current.calculos.totalPermuta).toBe(100000);
      act(() => {
        result.current.removePermutaItem(result.current.permutaItens[0].id);
      });
      expect(result.current.calculos.totalPermuta).toBe(0);
    });
  });

  describe("Desconto", () => {
    it("5% de desconto sobre R$ 1.035.000 = R$ 51.750", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setDescontoAtivo(true);
        result.current.setDescontoPct(5);
      });
      const c = result.current.calculos;
      expect(c.desconto).toBe(51750);
      expect(c.valorNegociado).toBe(983250);
    });

    it("desconto acima do limite: flag de validação", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setDescontoAtivo(true);
        result.current.setDescontoPct(10);
      });
      expect(result.current.calculos.validacoes.descontoAcimaLimite).toBe(true);
    });

    it("desconto desativado: valor negociado = original", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setDescontoAtivo(true);
        result.current.setDescontoPct(5);
      });
      act(() => result.current.setDescontoAtivo(false));
      expect(result.current.calculos.valorNegociado).toBe(UNIT_VALUE);
    });
  });

  describe("Comissão", () => {
    it("4% de comissão sobre R$ 1.035.000 = R$ 41.400", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      expect(result.current.calculos.comissaoValor).toBe(41400);
    });

    it("comissão recalcula com desconto", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setDescontoAtivo(true);
        result.current.setDescontoPct(5);
      });
      expect(result.current.calculos.comissaoValor).toBeCloseTo(983250 * 0.04, 0);
    });
  });

  describe("À vista", () => {
    it("0 parcelas: modo à vista", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => result.current.setNumeroParcelas(0));
      const c = result.current.calculos;
      expect(c.aVista).toBe(true);
      expect(c.saldoAVista).toBeGreaterThan(0);
    });
  });

  describe("Consistência global", () => {
    it("entrada + parcelas + balão + permuta = valor negociado", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setBalaoAtivo(true);
        result.current.setBalaoQuantidade(2);
        result.current.setBalaoValor(50000);
        result.current.setPermutaAtiva(true);
        result.current.addPermutaItem();
      });
      act(() => {
        const item = result.current.permutaItens[0];
        result.current.updatePermutaItem(item.id, "valor", 80000);
      });
      expect(result.current.calculos.validacoes.somaConsistente).toBe(true);
    });

    it("desconto + permuta + balão: tudo junto é consistente", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, UNIT_VALUE));
      act(() => {
        result.current.setDescontoAtivo(true);
        result.current.setDescontoPct(3);
        result.current.setBalaoAtivo(true);
        result.current.setBalaoQuantidade(1);
        result.current.setBalaoValor(100000);
        result.current.setPermutaAtiva(true);
        result.current.addPermutaItem();
      });
      act(() => {
        const item = result.current.permutaItens[0];
        result.current.updatePermutaItem(item.id, "valor", 50000);
      });
      expect(result.current.calculos.validacoes.somaConsistente).toBe(true);
    });
  });

  describe("Valor zero / edge cases", () => {
    it("valor do lote zero: sem divisão por zero", () => {
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, 0));
      expect(result.current.calculos.parcelaValor).toBe(0);
      expect(result.current.calculos.entradaValor).toBe(0);
    });

    it("valor Supabase como Number(string)", () => {
      const val = Number("1035000");
      const { result } = renderHook(() => useSimulador(DEFAULT_SETTINGS, val));
      expect(result.current.calculos.valorOriginal).toBe(1035000);
    });
  });
});
