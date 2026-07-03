// Fase 3 — Etapa 5 (Bloco 1). Prova que os métodos de escrita EM LOTE da cascata
// de cancelamento varrem EXATAMENTE o agrupamento canônico da fonte única
// (src/domain/status), sem literais soltos. Mocka o cliente Supabase e captura os
// argumentos passados a .update()/.eq()/.in().
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {
    // Torna o builder "thenable": qualquer `await <cadeia>` resolve para { error: null }.
    then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
  };
  for (const m of ["from", "update", "eq", "in", "insert", "select"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("../baseRepository", () => ({
  getSupabaseClientOrThrow: () => makeBuilder(),
  unwrapSupabaseListResult: (data: unknown[]) => data ?? [],
}));

import { rejectActiveProposals } from "../proposalsSupabaseRepository";
import { cancelPendingRequests } from "../reservationRequestsSupabaseRepository";
import { PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES } from "../../../domain/status/proposal";
import { RESERVATION_REQUEST_PENDING_DB } from "../../../domain/status/reservation";

beforeEach(() => {
  calls.length = 0;
});

describe("rejectActiveProposals — varredura em lote (cascata de cancelamento)", () => {
  it("filtra .in('status', <agrupamento canônico>) e grava 'rejected'", async () => {
    await rejectActiveProposals("neg-1");

    const inCall = calls.find((c) => c.method === "in");
    expect(inCall).toBeDefined();
    expect(inCall!.args[0]).toBe("status");
    // Conjunto exatamente igual ao canônico (draft/sent/under_analysis).
    expect(inCall!.args[1]).toEqual(PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES);
    expect(inCall!.args[1]).toEqual(["draft", "sent", "under_analysis"]);
    // Preservação de comportamento: counter_proposal fica FORA do lote (decisão de produto).
    expect(inCall!.args[1]).not.toContain("counter_proposal");

    const updateCall = calls.find((c) => c.method === "update");
    expect((updateCall!.args[0] as { status: string }).status).toBe("rejected");
    // Filtra pela negociação alvo.
    const eqNeg = calls.find((c) => c.method === "eq" && c.args[0] === "negotiation_id");
    expect(eqNeg!.args[1]).toBe("neg-1");
  });
});

describe("cancelPendingRequests — varredura em lote (cascata de cancelamento)", () => {
  it("filtra .eq('status', 'requested') canônico e grava 'cancelled'", async () => {
    await cancelPendingRequests("neg-1");

    const eqStatus = calls.find((c) => c.method === "eq" && c.args[0] === "status");
    expect(eqStatus).toBeDefined();
    expect(eqStatus!.args[1]).toBe(RESERVATION_REQUEST_PENDING_DB);
    expect(eqStatus!.args[1]).toBe("requested");

    const updateCall = calls.find((c) => c.method === "update");
    expect((updateCall!.args[0] as { status: string }).status).toBe("cancelled");
    const eqNeg = calls.find((c) => c.method === "eq" && c.args[0] === "negotiation_id");
    expect(eqNeg!.args[1]).toBe("neg-1");
  });
});
