import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { LeadQualificationStatus as S } from "../../../domain/status/leadQualification";

// Store mutável: o "banco" do teste. getLeads reflete o estado; as ações o mutam —
// assim o refetch SILENCIOSO reconcilia com o mesmo valor do patch otimista.
const store: { rows: Record<string, unknown>[] } = { rows: [] };

vi.mock("../../../app/contexts/AccountContext", () => ({ useAccount: () => ({ account: { accountId: "a1", role: "manager" } }) }));
vi.mock("../../../app/contexts/DevelopmentContext", () => ({ useDevelopment: () => ({ development: { developmentId: "d1" } }) }));
vi.mock("../../../app/contexts/AuthContext", () => ({ useAuth: () => ({ authenticatedProfile: { id: "p1" } }) }));
vi.mock("../../../infra/repositories/negotiationsSupabaseRepository", () => ({ createNegotiationFromClient: vi.fn(async () => "neg1") }));
vi.mock("../../../infra/repositories/clientsSupabaseRepository", () => {
  const patch = (clientId: string, qs: string) => { const r = store.rows.find((x) => x.id === clientId); if (r) r.qualificationStatus = qs; };
  return {
    getLeads: vi.fn(async () => store.rows.map((r) => ({ ...r }))),
    getAssignableMembers: vi.fn(async () => []),
    assignLead: vi.fn(async () => {}),
    startLeadService: vi.fn(async (clientId: string) => patch(clientId, "in_service")),
    qualifyLead: vi.fn(async (clientId: string) => patch(clientId, "qualified")),
    discardLead: vi.fn(async (clientId: string) => patch(clientId, "discarded")),
    markLeadConverted: vi.fn(async () => {}),
  };
});

import { useLeads } from "../useLeads";

function client(): Record<string, unknown> {
  return { id: "c1", accountId: "a1", name: "Lead X", qualificationStatus: "unqualified", assignedTo: null, assignedToName: null, brokerId: null, origin: null, createdAt: new Date().toISOString() };
}

beforeEach(() => { store.rows = [client()]; });

describe("useLeads — ações sem reload e patch otimista (L1.7 regra 8)", () => {
  it("o módulo Leads não recarrega a página (sem location.reload em lugar nenhum)", () => {
    // Regra 8: nenhuma ação pode recarregar a página. Invariante de fonte.
    for (const f of ["src/modules/leads/useLeads.ts", "src/modules/leads/LeadsPage.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/location\s*\.\s*reload/);
    }
  });

  it("Iniciar atende no lugar (NEW→IN_SERVICE) e NÃO reativa o loading full-screen", async () => {
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.leads[0].qualification).toBe(S.NEW);

    await act(async () => { await result.current.actions.startService(result.current.leads[0]); });

    // Estado novo aplicado no lugar; loading nunca voltou a true (sem "reload").
    await waitFor(() => expect(result.current.leads[0].qualification).toBe(S.IN_SERVICE));
    expect(result.current.loading).toBe(false);
    // Semáforo "parado" após atendimento (não mais aguardando 1ª resposta).
    expect(result.current.leads[0].semaphore.level).toBe("attended");
  });

  it("Qualificar e Descartar também refletem no lugar", async () => {
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.actions.startService(result.current.leads[0]); });
    await waitFor(() => expect(result.current.leads[0].qualification).toBe(S.IN_SERVICE));
    await act(async () => { await result.current.actions.qualify(result.current.leads[0]); });
    await waitFor(() => expect(result.current.leads[0].qualification).toBe(S.QUALIFIED));

    await act(async () => { await result.current.actions.discard(result.current.leads[0], "sem perfil"); });
    await waitFor(() => expect(result.current.leads[0].qualification).toBe(S.DISCARDED));
    // Descartado sai dos ativos.
    expect(result.current.counts.all_active).toBe(0);
  });
});
