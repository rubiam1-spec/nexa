// Leads L1 — prova dos métodos de qualificação no repositório de clients:
// guard de transição, payloads canônicos e trilha em contact_interactions.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: null, error: null }),
  };
  for (const m of ["from", "insert", "update", "eq", "select", "single", "maybeSingle", "is", "in", "order", "limit"]) {
    builder[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return builder; };
  }
  return builder;
}

vi.mock("../baseRepository", () => ({
  getSupabaseClientOrThrow: () => makeBuilder(),
  unwrapSupabaseListResult: (data: unknown[]) => data ?? [],
}));

import {
  assignLead, startLeadService, qualifyLead, discardLead, markLeadConverted,
} from "../clientsSupabaseRepository";
import { LeadQualificationStatus as S } from "../../../domain/status/leadQualification";

const updates = () => calls.filter((c) => c.method === "update").map((c) => c.args[0] as Record<string, unknown>);
const inserts = () => calls.filter((c) => c.method === "insert").map((c) => c.args[0] as Record<string, unknown>);
const findUpdate = (key: string) => updates().find((p) => key in p);
const findInsert = (type: string) => inserts().find((p) => p.type === type);

beforeEach(() => { calls.length = 0; });

describe("clientsRepository — Leads L1", () => {
  it("markLeadConverted grava 'converted' + converted_negotiation_id e interação com metadata", async () => {
    await markLeadConverted("cli-1", "acc-1", S.QUALIFIED, "prof-1", "neg-9");
    const up = findUpdate("qualification_status")!;
    expect(up.qualification_status).toBe("converted");
    expect(up.converted_negotiation_id).toBe("neg-9");
    expect(typeof up.converted_at).toBe("string");
    const it = findInsert("qualification_change")!;
    expect(it.title).toBe("Convertido em negociação");
    expect((it.metadata as Record<string, unknown>)).toMatchObject({ from: S.QUALIFIED, to: S.CONVERTED, negotiation_id: "neg-9" });
    expect(it.performed_by).toBe("prof-1");
  });

  it("startLeadService NEW→IN_SERVICE grava 'in_service'", async () => {
    await startLeadService("cli-1", "acc-1", S.NEW, "prof-1");
    expect(findUpdate("qualification_status")!.qualification_status).toBe("in_service");
    expect(findInsert("qualification_change")!.title).toBe("Atendimento iniciado");
  });

  it("qualifyLead IN_SERVICE→QUALIFIED grava 'qualified'", async () => {
    await qualifyLead("cli-1", "acc-1", S.IN_SERVICE, "prof-1");
    expect(findUpdate("qualification_status")!.qualification_status).toBe("qualified");
  });

  it("discardLead grava 'discarded' e leva o motivo na interação", async () => {
    await discardLead("cli-1", "acc-1", S.NEW, "prof-1", "  fora do perfil  ");
    expect(findUpdate("qualification_status")!.qualification_status).toBe("discarded");
    const it = findInsert("qualification_change")!;
    expect(it.description).toBe("fora do perfil");
    expect((it.metadata as Record<string, unknown>).reason).toBe("fora do perfil");
  });

  it("discardLead SEM motivo lança (motivo obrigatório) — nada é gravado", async () => {
    await expect(discardLead("cli-1", "acc-1", S.NEW, "prof-1", "   ")).rejects.toThrow(/motivo/i);
    expect(findUpdate("qualification_status")).toBeUndefined();
  });

  it("transição inválida lança (guard): QUALIFIED não volta a IN_SERVICE", async () => {
    await expect(startLeadService("cli-1", "acc-1", S.QUALIFIED, "prof-1")).rejects.toThrow(/inválida/);
    expect(findUpdate("qualification_status")).toBeUndefined();
  });

  it("assignLead grava assigned_to/at/by + interação assignment_change", async () => {
    await assignLead({ clientId: "cli-1", accountId: "acc-1", toProfileId: "prof-2", toName: "Ana", byProfileId: "prof-1" });
    const up = findUpdate("assigned_to")!;
    expect(up.assigned_to).toBe("prof-2");
    expect(up.assigned_by).toBe("prof-1");
    expect(up.assignment_type).toBe("manual");
    const it = findInsert("assignment_change")!;
    expect(it.title).toBe("Atribuído para Ana");
    expect((it.metadata as Record<string, unknown>).to_user).toBe("prof-2");
  });
});
