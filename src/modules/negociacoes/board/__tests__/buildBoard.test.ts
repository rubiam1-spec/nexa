import { describe, it, expect } from "vitest";
import { buildBoard } from "../buildBoard";
import type { KanbanCard } from "../../hooks/useKanbanData";
import { STAGE_ORDER } from "../stageColumn";

const NOW = new Date("2026-07-09T12:00:00Z").getTime();

function card(p: Partial<KanbanCard> & { id: string }): KanbanCard {
  return {
    status: "IN_PROGRESS", createdAt: "2026-06-01", updatedAt: "2026-06-01",
    clienteNome: null, clienteId: null, quadra: null, lote: null, valor: null, unitId: null,
    unitStatus: null, corretorNome: null, corretorId: null, propostaId: null, propostaStatus: null,
    reservaExpiresAt: null, reservaStatus: null, reservaRequestId: null, reservaRequestStatus: null,
    ...p,
  } as KanbanCard;
}

describe("buildBoard — agregação da fonte única (Fase B)", () => {
  const cards: KanbanCard[] = [
    card({ id: "a", status: "IN_PROGRESS", valor: 100 }),
    card({ id: "b", status: "OPEN", valor: 50 }),
    card({ id: "c", status: "PROPOSAL", valor: 200 }),
    card({ id: "d", status: "RESERVATION", valor: 300 }),
    card({ id: "e", status: "WON", valor: 400 }),
    card({ id: "f", status: "LOST", valor: 999 }),
    card({ id: "s1", isSimulacao: true, valor: 70 }),
    card({ id: "s2", isSimulacao: true, valor: 30 }),
  ];
  const b = buildBoard(cards, NOW);

  it("agrupa por coluna canônica", () => {
    expect(b.countByStage.em_negociacao).toBe(2); // IN_PROGRESS + OPEN
    expect(b.countByStage.proposta).toBe(1);
    expect(b.countByStage.reserva).toBe(1);
    expect(b.countByStage.venda).toBe(1);
    expect(b.countByStage.perdido).toBe(1);
  });

  it("separa simulações (pré-funil) das negociações", () => {
    expect(b.totalCount).toBe(6); // exclui as 2 simulações
    expect(b.prefunnel.count).toBe(2);
    expect(b.prefunnel.vgv).toBe(100);
  });

  it("abertas = em_negociacao + proposta + reserva (exclui venda/perdido)", () => {
    expect(b.openCount).toBe(4);
    expect(b.openVGV).toBe(100 + 50 + 200 + 300);
    expect(b.wonCount).toBe(1);
    expect(b.lostCount).toBe(1);
  });

  it("COERÊNCIA: contadores batem com o agrupamento por construção", () => {
    for (const s of STAGE_ORDER) {
      expect(b.countByStage[s]).toBe(b.byStage[s].length);
      expect(b.vgvByStage[s]).toBe(b.byStage[s].reduce((acc, c) => acc + (c.valor ?? 0), 0));
    }
    const sumAll = STAGE_ORDER.reduce((acc, s) => acc + b.countByStage[s], 0);
    expect(sumAll).toBe(b.totalCount);
  });

  it("decisões pendentes: solicitação de reserva + reserva expirada", () => {
    const withPending = buildBoard([
      card({ id: "p1", status: "PROPOSAL", reservaRequestId: "r1", reservaRequestStatus: "requested", clienteNome: "Ana", quadra: "3", lote: "5" }),
      card({ id: "p2", status: "RESERVATION", reservaStatus: "active", reservaExpiresAt: "2026-07-01T00:00:00Z" }),
      card({ id: "p3", status: "RESERVATION", reservaStatus: "active", reservaExpiresAt: "2026-12-01T00:00:00Z" }),
    ], NOW);
    const kinds = withPending.pending.map((p) => p.kind).sort();
    expect(kinds).toEqual(["reservation_expired", "reservation_request"]);
    const req = withPending.pending.find((p) => p.kind === "reservation_request");
    expect(req?.clienteNome).toBe("Ana");
    expect(req?.unitLabel).toBe("Q3·L5");
  });
});
