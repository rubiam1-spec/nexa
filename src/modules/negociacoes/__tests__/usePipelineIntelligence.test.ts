import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePipelineIntelligence } from "../hooks/usePipelineIntelligence";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { Unidade } from "../../../domain/unidade/Unidade";

function makeNeg(overrides: Partial<Negotiation> = {}): Negotiation {
  return {
    id: "neg-1", accountId: "acc-1", developmentId: "dev-1",
    unitId: "unit-1", clientId: null, brokerId: null, thirdPartyPropertyId: null,
    status: "IN_PROGRESS", score: 50, temperature: "warm",
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unidade> = {}): Unidade {
  return {
    id: "unit-1", accountId: "acc-1", empreendimentoId: "dev-1",
    quadra: "1", lote: "4", valor: 1035000,
    status: "EM_NEGOCIACAO", createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe("usePipelineIntelligence", () => {
  describe("acoesHoje", () => {
    it("retorna array vazio sem negociações", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam"));
      expect(result.current.acoesHoje).toEqual([]);
    });

    it("detecta negociação parada > 7 dias", () => {
      const neg = makeNeg({ updatedAt: daysAgo(10) });
      const unit = makeUnit();
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      expect(result.current.acoesHoje.length).toBeGreaterThan(0);
      expect(result.current.acoesHoje[0].tipo).toBe("atencao");
      expect(result.current.acoesHoje[0].texto).toContain("10 dias");
    });

    it("NÃO detecta negociação recente (< 7 dias)", () => {
      const neg = makeNeg({ updatedAt: daysAgo(3) });
      const unit = makeUnit();
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      const paradas = result.current.acoesHoje.filter((a) => a.tipo === "atencao");
      expect(paradas).toHaveLength(0);
    });

    it("detecta unidade reservada com urgência", () => {
      const neg = makeNeg({ status: "IN_PROGRESS", updatedAt: daysAgo(2) });
      const unit = makeUnit({ status: "RESERVADO" });
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      const urgentes = result.current.acoesHoje.filter((a) => a.tipo === "urgente");
      expect(urgentes.length).toBeGreaterThan(0);
      expect(urgentes[0].texto).toContain("reservada");
    });

    it("ignora negociações WON", () => {
      const neg = makeNeg({ status: "WON", updatedAt: daysAgo(20) });
      const unit = makeUnit();
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      expect(result.current.acoesHoje).toHaveLength(0);
    });

    it("ignora negociações CANCELLED", () => {
      const neg = makeNeg({ status: "CANCELLED", updatedAt: daysAgo(20) });
      const unit = makeUnit();
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      expect(result.current.acoesHoje).toHaveLength(0);
    });

    it("urgentes aparecem antes de atenção (ordenação)", () => {
      const negs = [
        makeNeg({ id: "n1", status: "IN_PROGRESS", updatedAt: daysAgo(10) }),
        makeNeg({ id: "n2", unitId: "unit-2", status: "IN_PROGRESS", updatedAt: daysAgo(2) }),
      ];
      const units = [
        makeUnit(),
        makeUnit({ id: "unit-2", quadra: "2", lote: "5", status: "RESERVADO" }),
      ];
      const { result } = renderHook(() => usePipelineIntelligence(negs, units, "Rubiam"));
      const tipos = result.current.acoesHoje.map((a) => a.tipo);
      const urgIdx = tipos.indexOf("urgente");
      const atencaoIdx = tipos.indexOf("atencao");
      if (urgIdx >= 0 && atencaoIdx >= 0) {
        expect(urgIdx).toBeLessThan(atencaoIdx);
      }
    });

    it("limita a 5 ações", () => {
      const negs = Array.from({ length: 10 }, (_, i) =>
        makeNeg({ id: `n-${i}`, unitId: `u-${i}`, updatedAt: daysAgo(10 + i) }),
      );
      const units = negs.map((n) => makeUnit({ id: n.unitId, lote: String(n.unitId) }));
      const { result } = renderHook(() => usePipelineIntelligence(negs, units, "Rubiam"));
      expect(result.current.acoesHoje.length).toBeLessThanOrEqual(5);
    });

    it("inclui identificação Q·L da unidade no texto", () => {
      const neg = makeNeg({ updatedAt: daysAgo(10) });
      const unit = makeUnit({ quadra: "3", lote: "12" });
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      expect(result.current.acoesHoje[0].texto).toContain("Q3·L12");
    });
  });

  describe("velocidade", () => {
    it("retorna 5 estágios", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam"));
      expect(result.current.velocidade).toHaveLength(5);
    });

    it("estágios na ordem: simulação, negociação, proposta, reserva, venda", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam"));
      expect(result.current.velocidade.map((v) => v.estagio)).toEqual([
        "simulacao", "negociacao", "proposta", "reserva", "venda",
      ]);
    });

    it("todos com diasMedio 0 quando sem negociações", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam"));
      result.current.velocidade.forEach((v) => expect(v.diasMedio).toBe(0));
    });

    it("calcula média de dias por estágio", () => {
      const negs = [
        makeNeg({ id: "n1", status: "IN_PROGRESS", updatedAt: daysAgo(5) }),
        makeNeg({ id: "n2", unitId: "unit-2", status: "IN_PROGRESS", updatedAt: daysAgo(15) }),
      ];
      const units = [makeUnit(), makeUnit({ id: "unit-2" })];
      const { result } = renderHook(() => usePipelineIntelligence(negs, units, "Rubiam"));
      const negStage = result.current.velocidade.find((v) => v.estagio === "negociacao");
      expect(negStage!.diasMedio).toBe(10);
    });

    it("identifica gargalo (estágio com maior média)", () => {
      const negs = [
        makeNeg({ id: "n1", status: "IN_PROGRESS", updatedAt: daysAgo(20) }),
        makeNeg({ id: "n2", unitId: "unit-2", status: "OPEN", updatedAt: daysAgo(5) }),
      ];
      const units = [makeUnit(), makeUnit({ id: "unit-2" })];
      const { result } = renderHook(() => usePipelineIntelligence(negs, units, "Rubiam"));
      const gargalo = result.current.velocidade.find((v) => v.isGargalo);
      expect(gargalo).toBeTruthy();
      expect(gargalo!.estagio).toBe("negociacao");
    });

    it("ignora negociações com > 90 dias (outliers)", () => {
      const neg = makeNeg({ status: "IN_PROGRESS", updatedAt: daysAgo(100) });
      const unit = makeUnit();
      const { result } = renderHook(() => usePipelineIntelligence([neg], [unit], "Rubiam"));
      const negStage = result.current.velocidade.find((v) => v.estagio === "negociacao");
      expect(negStage!.diasMedio).toBe(0);
    });

    it("cada estágio tem cor definida", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam"));
      result.current.velocidade.forEach((v) => {
        expect(v.cor).toBeTruthy();
        expect(v.cor.startsWith("#")).toBe(true);
      });
    });
  });

  describe("saudacao", () => {
    it("contém primeiro nome", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam Neto"));
      expect(result.current.saudacao).toContain("Rubiam");
      expect(result.current.saudacao).not.toContain("Neto");
    });

    it("contém saudação temporal", () => {
      const { result } = renderHook(() => usePipelineIntelligence([], [], "Rubiam"));
      expect(result.current.saudacao).toMatch(/Bom dia|Boa tarde|Boa noite/);
    });
  });
});
