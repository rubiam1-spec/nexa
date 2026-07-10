import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "../../app/contexts/AccountContext";
import { useDevelopment } from "../../app/contexts/DevelopmentContext";
import { useAuth } from "../../app/contexts/AuthContext";
import type { Client } from "../../shared/types/client";
import {
  fromLeadQualificationDb,
  isLeadActive,
  toLeadQualificationDb,
  LeadQualificationStatus,
  type LeadQualificationStatus as LeadQualificationStatusType,
} from "../../domain/status/leadQualification";
import { firstResponseSemaphore, type LeadSemaphore } from "../../domain/status/leadSemaphore";
import {
  getLeads,
  getAssignableMembers,
  getBrokerageAssignmentContext,
  assignLead as repoAssignLead,
  startLeadService,
  qualifyLead as repoQualifyLead,
  discardLead as repoDiscardLead,
  markLeadConverted,
  type AssignableMember,
  type BrokerageDirectoryEntry,
} from "../../infra/repositories/clientsSupabaseRepository";
import { createNegotiationFromClient } from "../../infra/repositories/negotiationsSupabaseRepository";
import { summarizePendingBrokers, type PendingBrokersSummary } from "./assignmentGrouping";
import { canViewAllLeads, canWorkLead, canAssignLeads, resolveConvertOwner } from "./leadRules";

export type LeadView = {
  client: Client;
  qualification: LeadQualificationStatusType;
  semaphore: LeadSemaphore;
  isAssignee: boolean;
  canWork: boolean;
};

export type AccountMember = AssignableMember;

export function useLeads() {
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();
  const role = account?.role ?? null;
  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const profileId = authenticatedProfile?.id ?? null;
  const seeAll = canViewAllLeads(role);
  const canAssign = canAssignLeads(role);

  const [rows, setRows] = useState<Client[]>([]);
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [brokerageDirectory, setBrokerageDirectory] = useState<BrokerageDirectoryEntry[]>([]);
  const [pendingBrokers, setPendingBrokers] = useState<PendingBrokersSummary>({ brokeragesWithPending: 0, brokersWithoutAccess: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Regra 8 (nunca "recarregar"): o loading full-screen só vale para a PRIMEIRA
  // carga de cada conta. Refetch pós-ação é SILENCIOSO — a lista nunca desmonta,
  // o scroll não se perde e o toast não some. Reset ao trocar de conta.
  const initialLoadedRef = useRef(false);
  useEffect(() => { initialLoadedRef.current = false; }, [accountId]);

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    let active = true;
    if (!initialLoadedRef.current) setLoading(true);
    getLeads(accountId, { assignedTo: seeAll ? null : profileId })
      .then((data) => { if (active) { setRows(data); setError(null); initialLoadedRef.current = true; } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, seeAll, profileId, refreshKey]);

  // Membros atribuíveis (equipe + corretores com imobiliária + carga) — só para
  // quem pode atribuir. Contexto de carga em batch, sem N+1 (ver repositório).
  useEffect(() => {
    if (!accountId || !canAssign) return;
    let active = true;
    getAssignableMembers(accountId).then((list) => { if (active) setMembers(list); }).catch(() => { if (active) setMembers([]); });
    // L1.9 — diretório completo de imobiliárias + contagem de corretores sem acesso,
    // para o modal explicar por que o dropdown parece "vazio". Contagem em função pura.
    getBrokerageAssignmentContext(accountId)
      .then((ctx) => {
        if (!active) return;
        setBrokerageDirectory(ctx.directory);
        setPendingBrokers(summarizePendingBrokers(ctx.brokerRows));
      })
      .catch(() => {
        if (!active) return;
        setBrokerageDirectory([]);
        setPendingBrokers({ brokeragesWithPending: 0, brokersWithoutAccess: 0 });
      });
    return () => { active = false; };
  }, [accountId, canAssign, refreshKey]);

  // Patch OTIMISTA local: aplica o novo estado no lugar (sem esperar refetch),
  // para o lead nunca "sumir sem explicação". O refresh() silencioso reconcilia.
  const patchRow = useCallback((clientId: string, patch: Partial<Client>) => {
    setRows((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...patch } : c)));
  }, []);

  const leads: LeadView[] = useMemo(() => {
    return rows.map((client) => {
      const qualification = fromLeadQualificationDb(client.qualificationStatus);
      const attended = qualification !== LeadQualificationStatus.NEW;
      const isAssignee = !!profileId && client.assignedTo === profileId;
      return {
        client,
        qualification,
        semaphore: firstResponseSemaphore(client.createdAt, attended),
        isAssignee,
        canWork: canWorkLead(role, isAssignee),
      };
    });
  }, [rows, profileId, role]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all_active: 0 };
    for (const l of leads) {
      c[l.qualification] = (c[l.qualification] ?? 0) + 1;
      if (isLeadActive(l.qualification)) c.all_active += 1;
    }
    return c;
  }, [leads]);

  // ── Ações (escrita só via repositório; patch OTIMISTA no lugar; refresh silencioso) ──
  async function assign(lead: LeadView, toProfileId: string, toName: string) {
    if (!accountId) return;
    await repoAssignLead({ clientId: lead.client.id, accountId, toProfileId, toName, byProfileId: profileId });
    patchRow(lead.client.id, { assignedTo: toProfileId, assignedToName: toName });
    refresh();
  }
  async function startService(lead: LeadView) {
    if (!accountId) return;
    await startLeadService(lead.client.id, accountId, lead.qualification, profileId);
    patchRow(lead.client.id, { qualificationStatus: toLeadQualificationDb(LeadQualificationStatus.IN_SERVICE) });
    refresh();
  }
  async function qualify(lead: LeadView) {
    if (!accountId) return;
    await repoQualifyLead(lead.client.id, accountId, lead.qualification, profileId);
    patchRow(lead.client.id, { qualificationStatus: toLeadQualificationDb(LeadQualificationStatus.QUALIFIED) });
    refresh();
  }
  async function discard(lead: LeadView, reason: string) {
    if (!accountId) return;
    await repoDiscardLead(lead.client.id, accountId, lead.qualification, profileId, reason);
    patchRow(lead.client.id, { qualificationStatus: toLeadQualificationDb(LeadQualificationStatus.DISCARDED) });
    refresh();
  }
  /** Converte em negociação (1 toque). Retorna o id da negociação criada. */
  async function convert(lead: LeadView): Promise<string | null> {
    if (!accountId || !developmentId) throw new Error("Conta/empreendimento ativos são necessários para converter.");
    const ownerProfileId = resolveConvertOwner(lead.client, profileId);
    const negId = await createNegotiationFromClient({
      accountId, developmentId, clientId: lead.client.id,
      brokerId: lead.client.brokerId, ownerProfileId,
      origem: lead.client.origin, notes: null,
    });
    if (negId) {
      await markLeadConverted(lead.client.id, accountId, lead.qualification, profileId, negId);
      patchRow(lead.client.id, { qualificationStatus: toLeadQualificationDb(LeadQualificationStatus.CONVERTED) });
    }
    refresh();
    return negId;
  }

  return {
    leads, counts, members, brokerageDirectory, pendingBrokers, loading, error, refresh,
    role, profileId, accountId, developmentId, canAssign,
    actions: { assign, startService, qualify, discard, convert },
  };
}
