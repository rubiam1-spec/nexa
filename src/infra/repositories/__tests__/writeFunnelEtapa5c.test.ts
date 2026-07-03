// Fase 3 — Etapa 5c. Prova que os métodos novos de repositório (migração das
// escritas cruas de 6 superfícies) gravam o payload correto e derivam o status da
// fonte única (src/domain/status), sem literais. Mocka o cliente Supabase e captura
// os argumentos passados a .insert()/.update()/.delete()/.eq()/.in().
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];
let nextData: unknown = null;

function makeBuilder() {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: nextData, error: null }),
  };
  for (const m of ["from", "insert", "update", "delete", "eq", "in", "select", "single", "maybeSingle", "order", "limit"]) {
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

import { createSimulation, updateSimulation, deleteSimulation } from "../pipelineSimulationsSupabaseRepository";
import { createSimulationGroup, createSimulationGroupItems } from "../simulationGroupsSupabaseRepository";
import { createNegotiationFromClient, markClientActiveNegotiationsLost } from "../negotiationsSupabaseRepository";
import { createUnitQueueEntry, promoteUnitQueueEntry, removeUnitQueueEntry, updateUnitQueuePosition } from "../unitQueueSupabaseRepository";
import { PipelineSimulationStatus } from "../../../domain/status/pipelineSimulation";
import { SimulationGroupStatus } from "../../../domain/status/simulationGroup";
import { NegotiationStatus } from "../../../domain/status/negotiation";
import { UnitQueueDbStatus } from "../../../domain/status/unitQueue";
import { UnitQueueStatus } from "../../../domain/fila/UnitQueueStatus";

const insertPayload = () => (calls.find((c) => c.method === "insert")!.args[0]) as Record<string, unknown>;
const updatePayload = () => (calls.find((c) => c.method === "update")!.args[0]) as Record<string, unknown>;

const baseSim = {
  accountId: "a", developmentId: "d", unitId: "u", clientId: "c", brokerId: "b",
  valorTotal: 100, entradaPercentual: 10, entradaValor: 10, parcelasQuantidade: 12, parcelasValor: 7.5,
};

beforeEach(() => { calls.length = 0; nextData = null; });

describe("pipeline_simulations — CRUD (Etapa 5c)", () => {
  it("createSimulation grava status 'ativa' (fonte única) e omite created_by quando null", async () => {
    nextData = { id: "sim-1" };
    const id = await createSimulation({ ...baseSim, createdBy: null });
    expect(id).toBe("sim-1");
    const p = insertPayload();
    expect(p.status).toBe(PipelineSimulationStatus.ATIVA);
    expect(p.status).toBe("ativa");
    expect(p.valor_total).toBe(100);
    expect("created_by" in p).toBe(false); // omitido quando ausente (preserva default)
    expect("follow_up_at" in p).toBe(false);
  });

  it("createSimulation inclui created_by e follow_up_at quando fornecidos", async () => {
    nextData = { id: "sim-2" };
    await createSimulation({ ...baseSim, createdBy: "user-1", followUpAt: new Date("2026-07-10T00:00:00Z") });
    const p = insertPayload();
    expect(p.created_by).toBe("user-1");
    expect(typeof p.follow_up_at).toBe("string");
  });

  it("updateSimulation grava status 'ativa'; deleteSimulation filtra por id", async () => {
    await updateSimulation("sim-3", baseSim);
    expect(updatePayload().status).toBe("ativa");
    calls.length = 0;
    await deleteSimulation("sim-9");
    expect(calls.some((c) => c.method === "delete")).toBe(true);
    expect(calls.find((c) => c.method === "eq")!.args).toEqual(["id", "sim-9"]);
  });
});

describe("simulation_groups (Etapa 5c)", () => {
  it("createSimulationGroup grava status 'active' (fonte única)", async () => {
    nextData = { id: "grp-1" };
    const id = await createSimulationGroup({ accountId: "a", developmentId: "d", clientId: null, brokerId: null, createdBy: null, title: "T", valorTotalGrupo: 500 });
    expect(id).toBe("grp-1");
    expect(insertPayload().status).toBe(SimulationGroupStatus.ACTIVE);
    expect(insertPayload().status).toBe("active");
  });

  it("createSimulationGroupItems grava group_id e ordem por item", async () => {
    await createSimulationGroupItems("grp-1", [
      { unitId: "u1", valorUnidade: 1, entradaPercentual: 1, entradaValor: 1, parcelasQuantidade: 1, parcelasValor: 1, ordem: 0 },
      { unitId: "u2", valorUnidade: 2, entradaPercentual: 2, entradaValor: 2, parcelasQuantidade: 2, parcelasValor: 2, ordem: 1 },
    ]);
    const rows = insertPayload() as unknown as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0].group_id).toBe("grp-1");
    expect(rows[1].ordem).toBe(1);
  });
});

describe("negotiations — fluxo de cliente (Etapa 5c)", () => {
  it("createNegotiationFromClient grava status 'OPEN', origem/notes e SEM unit_id", async () => {
    nextData = { id: "neg-1" };
    const id = await createNegotiationFromClient({ accountId: "a", developmentId: "d", clientId: "c", brokerId: null, ownerProfileId: "o", origem: "manual", notes: "n" });
    expect(id).toBe("neg-1");
    const p = insertPayload();
    expect(p.status).toBe(NegotiationStatus.OPEN);
    expect(p.status).toBe("OPEN");
    expect(p.origem).toBe("manual");
    expect(p.notes).toBe("n");
    expect("unit_id" in p).toBe(false);
  });

  it("markClientActiveNegotiationsLost varre {OPEN,IN_PROGRESS} e grava LOST + lost_at_stage", async () => {
    nextData = [{ id: "n1", status: "IN_PROGRESS" }];
    const affected = await markClientActiveNegotiationsLost("c", "a", "motivo");
    expect(affected).toBe(1);
    const inCall = calls.find((c) => c.method === "in")!;
    expect(inCall.args[0]).toBe("status");
    expect(inCall.args[1]).toEqual([NegotiationStatus.OPEN, NegotiationStatus.IN_PROGRESS]);
    expect(inCall.args[1]).toEqual(["OPEN", "IN_PROGRESS"]);
    const p = updatePayload();
    expect(p.status).toBe(NegotiationStatus.LOST);
    expect(p.lost_reason).toBe("motivo");
    expect(p.lost_at_stage).toBe("IN_PROGRESS"); // status anterior, por linha
  });
});

describe("unit_queue_entries — escritas migradas (Etapa 5c)", () => {
  it("createUnitQueueEntry grava client_id/broker_id/reason + status 'waiting'", async () => {
    nextData = { id: "q1", unit_id: "u", negotiation_id: null, account_id: "a", development_id: "d", requested_by: "r", status: "waiting", position: 1, created_at: "2026-01-01", updated_at: "2026-01-01" };
    await createUnitQueueEntry({ unitId: "u", negotiationId: null, accountId: "a", developmentId: "d", requestedBy: "r", position: 1, clientId: "c", brokerId: "b", reason: "quero" });
    const p = insertPayload();
    expect(p.client_id).toBe("c");
    expect(p.broker_id).toBe("b");
    expect(p.reason).toBe("quero");
    expect(p.status).toBe(UnitQueueDbStatus[UnitQueueStatus.WAITING]);
    expect(p.status).toBe("waiting");
  });

  it("promoteUnitQueueEntry grava 'promoted' + promoted_at", async () => {
    await promoteUnitQueueEntry("q1");
    const p = updatePayload();
    expect(p.status).toBe("promoted");
    expect(typeof p.promoted_at).toBe("string");
  });

  it("removeUnitQueueEntry grava 'removed' + removed_reason", async () => {
    await removeUnitQueueEntry("q1", "desistiu");
    const p = updatePayload();
    expect(p.status).toBe("removed");
    expect(p.removed_reason).toBe("desistiu");
    expect(typeof p.removed_at).toBe("string");
  });

  it("updateUnitQueuePosition grava só position", async () => {
    await updateUnitQueuePosition("q1", 3);
    expect(updatePayload()).toEqual({ position: 3 });
  });
});
