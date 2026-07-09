// Fase A do Funil — prova do gancho recomputeNegotiationStage:
// (a) grava status + history quando o estágio muda; (b) é idempotente (não grava
// quando não muda); (c) preserva terminais; (d) no-op se a negociação some.
// Mocka o cliente Supabase (por tabela) e os escritores (negotiations/history).
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  state: { tableData: {} as Record<string, unknown> },
  writers: {
    updateNegotiationStatus: vi.fn(async () => undefined),
    createNegotiationHistoryEvent: vi.fn(async () => undefined),
  },
}));

vi.mock("../baseRepository", () => ({
  getSupabaseClientOrThrow: () => ({
    from(table: string) {
      let single = false;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => {
          single = true;
          return chain;
        },
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({
            data: single
              ? h.state.tableData[table]
              : (h.state.tableData[table] ?? []),
            error: null,
          }),
      };
      return chain;
    },
  }),
  unwrapSupabaseListResult: (d: unknown[]) => d ?? [],
}));

vi.mock("../negotiationsSupabaseRepository", () => ({
  updateNegotiationStatus: h.writers.updateNegotiationStatus,
}));
vi.mock("../negotiationHistorySupabaseRepository", () => ({
  createNegotiationHistoryEvent: h.writers.createNegotiationHistoryEvent,
}));

import { recomputeNegotiationStage } from "../recomputeNegotiationStage";
import { NegotiationStatus } from "../../../domain/status/negotiation";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";

const NEG = "neg-1";
function setup(negStatus: string | null, children: {
  proposals?: string[];
  reservations?: string[];
  sales?: string[];
}) {
  h.state.tableData = {
    negotiations: negStatus === null ? null : { status: negStatus },
    proposals: (children.proposals ?? []).map((status) => ({ status })),
    reservations: (children.reservations ?? []).map((status) => ({ status })),
    sales: (children.sales ?? []).map((status) => ({ status })),
  };
}

beforeEach(() => {
  h.writers.updateNegotiationStatus.mockClear();
  h.writers.createNegotiationHistoryEvent.mockClear();
});

describe("recomputeNegotiationStage", () => {
  it("grava status + history quando o estágio muda (IN_PROGRESS → PROPOSAL)", async () => {
    setup("IN_PROGRESS", { proposals: ["under_analysis"] });
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBe(NegotiationStatus.PROPOSAL);
    expect(h.writers.updateNegotiationStatus).toHaveBeenCalledWith(
      NEG,
      NegotiationStatus.PROPOSAL,
    );
    expect(h.writers.createNegotiationHistoryEvent).toHaveBeenCalledWith({
      negotiationId: NEG,
      fromStatus: NegotiationStatus.IN_PROGRESS,
      toStatus: NegotiationStatus.PROPOSAL,
      action: NegotiationHistoryAction.NEGOTIATION_STAGE_CHANGED,
      performedBy: null,
    });
  });

  it("reserva ativa → RESERVATION (grava)", async () => {
    setup("PROPOSAL", { proposals: ["under_analysis"], reservations: ["active"] });
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBe(NegotiationStatus.RESERVATION);
    expect(h.writers.updateNegotiationStatus).toHaveBeenCalledWith(
      NEG,
      NegotiationStatus.RESERVATION,
    );
  });

  it("IDEMPOTENTE: estágio inalterado NÃO grava status nem history", async () => {
    setup("PROPOSAL", { proposals: ["sent"] });
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBe(NegotiationStatus.PROPOSAL);
    expect(h.writers.updateNegotiationStatus).not.toHaveBeenCalled();
    expect(h.writers.createNegotiationHistoryEvent).not.toHaveBeenCalled();
  });

  it("IDEMPOTENTE: sem filhos e já IN_PROGRESS → não grava", async () => {
    setup("IN_PROGRESS", {});
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBe(NegotiationStatus.IN_PROGRESS);
    expect(h.writers.updateNegotiationStatus).not.toHaveBeenCalled();
  });

  it("terminal LOST preservado mesmo com venda ativa → não grava", async () => {
    setup("LOST", { sales: ["created"] });
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBe(NegotiationStatus.LOST);
    expect(h.writers.updateNegotiationStatus).not.toHaveBeenCalled();
    expect(h.writers.createNegotiationHistoryEvent).not.toHaveBeenCalled();
  });

  it("venda cancelada + reserva ativa → RESERVATION (regressão de WON)", async () => {
    setup("WON", { reservations: ["active"], sales: ["cancelled"] });
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBe(NegotiationStatus.RESERVATION);
    expect(h.writers.updateNegotiationStatus).toHaveBeenCalledWith(
      NEG,
      NegotiationStatus.RESERVATION,
    );
  });

  it("negociação inexistente → no-op (retorna null, não grava)", async () => {
    setup(null, {});
    const result = await recomputeNegotiationStage(NEG);
    expect(result).toBeNull();
    expect(h.writers.updateNegotiationStatus).not.toHaveBeenCalled();
  });
});
