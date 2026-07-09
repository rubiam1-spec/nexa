import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "../../app/contexts/AccountContext";
import { useDevelopment } from "../../app/contexts/DevelopmentContext";
import { useAuth } from "../../app/contexts/AuthContext";
import { supabase } from "../../infra/supabase/supabaseClient";
import type { Client } from "../../shared/types/client";
import {
  fromLeadQualificationDb,
  isLeadActive,
  LeadQualificationStatus,
  type LeadQualificationStatus as LeadQualificationStatusType,
} from "../../domain/status/leadQualification";
import { firstResponseSemaphore, type LeadSemaphore } from "../../domain/status/leadSemaphore";
import {
  getLeads,
  assignLead as repoAssignLead,
  startLeadService,
  qualifyLead as repoQualifyLead,
  discardLead as repoDiscardLead,
  markLeadConverted,
} from "../../infra/repositories/clientsSupabaseRepository";
import { createNegotiationFromClient } from "../../infra/repositories/negotiationsSupabaseRepository";
import { canViewAllLeads, canWorkLead, canAssignLeads, resolveConvertOwner } from "./leadRules";

export type LeadView = {
  client: Client;
  qualification: LeadQualificationStatusType;
  semaphore: LeadSemaphore;
  isAssignee: boolean;
  canWork: boolean;
};

export type AccountMember = { id: string; name: string; role: string };

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getLeads(accountId, { assignedTo: seeAll ? null : profileId })
      .then((data) => { if (active) { setRows(data); setError(null); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, seeAll, profileId, refreshKey]);

  // Membros da conta (picker de atribuição) — só carrega para quem pode atribuir.
  useEffect(() => {
    if (!accountId || !canAssign || !supabase) return;
    supabase.from("user_account_access").select("user_id, role, profiles(id, name)").eq("account_id", accountId)
      .then(({ data }) => {
        const list: AccountMember[] = (data ?? []).map((r: Record<string, unknown>) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return { id: (p as Record<string, unknown>)?.id as string, name: ((p as Record<string, unknown>)?.name as string) ?? "—", role: r.role as string };
        }).filter((m) => m.id);
        setMembers(list);
      });
  }, [accountId, canAssign]);

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

  // ── Ações (escrita só via repositório) ──
  async function assign(lead: LeadView, toProfileId: string, toName: string) {
    if (!accountId) return;
    await repoAssignLead({ clientId: lead.client.id, accountId, toProfileId, toName, byProfileId: profileId });
    refresh();
  }
  async function startService(lead: LeadView) {
    if (!accountId) return;
    await startLeadService(lead.client.id, accountId, lead.qualification, profileId);
    refresh();
  }
  async function qualify(lead: LeadView) {
    if (!accountId) return;
    await repoQualifyLead(lead.client.id, accountId, lead.qualification, profileId);
    refresh();
  }
  async function discard(lead: LeadView, reason: string) {
    if (!accountId) return;
    await repoDiscardLead(lead.client.id, accountId, lead.qualification, profileId, reason);
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
    if (negId) await markLeadConverted(lead.client.id, accountId, lead.qualification, profileId, negId);
    refresh();
    return negId;
  }

  return {
    leads, counts, members, loading, error, refresh,
    role, profileId, accountId, developmentId, canAssign,
    actions: { assign, startService, qualify, discard, convert },
  };
}
