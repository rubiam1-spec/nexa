import { describe, it, expect } from "vitest";
import { UnitQueueService } from "../fila/UnitQueueService";
import { UnitQueueStatus } from "../fila/UnitQueueStatus";

import type { UnitQueueEntry } from "../../shared/types/unitQueueEntry";
import type { Unidade } from "../unidade/Unidade";

function makeEntry(overrides: Partial<UnitQueueEntry> = {}): UnitQueueEntry {
  return {
    id: "q-1", unitId: "unit-1", negotiationId: "neg-1",
    accountId: "acc-1", developmentId: "dev-1", requestedBy: null,
    status: UnitQueueStatus.ACTIVE, position: 1,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeUnit(status: Unidade["status"]): Unidade {
  return {
    id: "unit-1", accountId: "acc-1", empreendimentoId: "dev-1",
    quadra: "Q1", lote: "L4", valor: 1035000,
    status, createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("UnitQueueService", () => {
  describe("getNextPosition", () => {
    it("fila vazia: posição 1", () => {
      expect(UnitQueueService.getNextPosition([])).toBe(1);
    });
    it("1 ativo: posição 2", () => {
      expect(UnitQueueService.getNextPosition([makeEntry()])).toBe(2);
    });
    it("ignora entradas com status diferente de ACTIVE", () => {
      const entries = [
        makeEntry({ status: UnitQueueStatus.ACTIVE }),
        makeEntry({ id: "q-2", status: UnitQueueStatus.CANCELLED }),
        makeEntry({ id: "q-3", status: UnitQueueStatus.PROMOTED }),
      ];
      expect(UnitQueueService.getNextPosition(entries)).toBe(2);
    });
  });

  describe("hasOpenEntryForNegotiation", () => {
    it("retorna true se negociação tem entrada ativa", () => {
      const entries = [makeEntry({ negotiationId: "neg-1", status: UnitQueueStatus.ACTIVE })];
      expect(UnitQueueService.hasOpenEntryForNegotiation(entries, "neg-1")).toBe(true);
    });
    it("retorna true se negociação tem entrada promovida", () => {
      const entries = [makeEntry({ negotiationId: "neg-1", status: UnitQueueStatus.PROMOTED })];
      expect(UnitQueueService.hasOpenEntryForNegotiation(entries, "neg-1")).toBe(true);
    });
    it("retorna false se negociação cancelada", () => {
      const entries = [makeEntry({ negotiationId: "neg-1", status: UnitQueueStatus.CANCELLED })];
      expect(UnitQueueService.hasOpenEntryForNegotiation(entries, "neg-1")).toBe(false);
    });
    it("retorna false para negociação diferente", () => {
      const entries = [makeEntry({ negotiationId: "neg-2", status: UnitQueueStatus.ACTIVE })];
      expect(UnitQueueService.hasOpenEntryForNegotiation(entries, "neg-1")).toBe(false);
    });
  });

  describe("hasPromotedPriority", () => {
    it("true se há entrada promovida", () => {
      const entries = [makeEntry({ status: UnitQueueStatus.PROMOTED })];
      expect(UnitQueueService.hasPromotedPriority(entries)).toBe(true);
    });
    it("false se nenhuma promovida", () => {
      const entries = [makeEntry({ status: UnitQueueStatus.ACTIVE })];
      expect(UnitQueueService.hasPromotedPriority(entries)).toBe(false);
    });
  });

  describe("getPromotedEntry", () => {
    it("retorna entrada promovida", () => {
      const promoted = makeEntry({ id: "q-p", status: UnitQueueStatus.PROMOTED });
      const entries = [makeEntry(), promoted];
      expect(UnitQueueService.getPromotedEntry(entries)?.id).toBe("q-p");
    });
    it("retorna null se nenhuma promovida", () => {
      expect(UnitQueueService.getPromotedEntry([makeEntry()])).toBeNull();
    });
  });

  describe("requiresQueueForNegotiation", () => {
    it("unidade RESERVADO: sempre requer fila", () => {
      expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("RESERVADO"), [], "neg-1")).toBe(true);
    });
    it("unidade DISPONIVEL: NÃO requer fila", () => {
      expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("DISPONIVEL"), [], "neg-1")).toBe(false);
    });
    it("unidade EM_NEGOCIACAO com promovida de OUTRA negociação: requer fila", () => {
      const entries = [makeEntry({ negotiationId: "neg-2", status: UnitQueueStatus.PROMOTED })];
      expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("EM_NEGOCIACAO"), entries, "neg-1")).toBe(true);
    });
    it("unidade EM_NEGOCIACAO com promovida da MESMA negociação: NÃO requer", () => {
      const entries = [makeEntry({ negotiationId: "neg-1", status: UnitQueueStatus.PROMOTED })];
      expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("EM_NEGOCIACAO"), entries, "neg-1")).toBe(false);
    });
    it("unidade EM_NEGOCIACAO sem promovida: NÃO requer", () => {
      const entries = [makeEntry({ status: UnitQueueStatus.ACTIVE })];
      expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("EM_NEGOCIACAO"), entries, "neg-1")).toBe(false);
    });
  });

  describe("getNextPromotableEntry", () => {
    it("retorna entrada ativa com menor posição", () => {
      const entries = [
        makeEntry({ id: "q-3", position: 3 }),
        makeEntry({ id: "q-1", position: 1 }),
        makeEntry({ id: "q-2", position: 2 }),
      ];
      expect(UnitQueueService.getNextPromotableEntry(entries)?.id).toBe("q-1");
    });
    it("ignora entradas não ativas", () => {
      const entries = [
        makeEntry({ id: "q-1", position: 1, status: UnitQueueStatus.CANCELLED }),
        makeEntry({ id: "q-2", position: 2, status: UnitQueueStatus.ACTIVE }),
      ];
      expect(UnitQueueService.getNextPromotableEntry(entries)?.id).toBe("q-2");
    });
    it("mesma posição: desempata por createdAt", () => {
      const early = new Date("2026-01-01");
      const late = new Date("2026-04-15");
      const entries = [
        makeEntry({ id: "q-late", position: 1, createdAt: late }),
        makeEntry({ id: "q-early", position: 1, createdAt: early }),
      ];
      expect(UnitQueueService.getNextPromotableEntry(entries)?.id).toBe("q-early");
    });
    it("fila vazia retorna null", () => {
      expect(UnitQueueService.getNextPromotableEntry([])).toBeNull();
    });
  });
});
