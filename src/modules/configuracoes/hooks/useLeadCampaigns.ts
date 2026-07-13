import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import {
  getLeadCampaigns, createLeadCampaign, updateLeadCampaign, setLeadCampaignActive, deleteLeadCampaign,
  type LeadCampaign, type LeadCampaignInput,
} from "../../../infra/repositories/leadCampaignsSupabaseRepository";

// Hook de campanhas/ações (Configurações → Leads → Campanhas). Regra fora da UI.
export function useLeadCampaigns() {
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const accountId = account?.accountId ?? null;
  const profileId = authenticatedProfile?.id ?? null;
  const [campaigns, setCampaigns] = useState<LeadCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getLeadCampaigns(accountId)
      .then((list) => { if (active) { setCampaigns(list); setError(null); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, refreshKey]);

  const create = useCallback(async (input: LeadCampaignInput) => {
    if (!accountId) return;
    await createLeadCampaign(accountId, profileId, input);
    refresh();
  }, [accountId, profileId, refresh]);

  const update = useCallback(async (id: string, input: LeadCampaignInput) => {
    await updateLeadCampaign(id, input);
    refresh();
  }, [refresh]);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await setLeadCampaignActive(id, active);
    refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteLeadCampaign(id);
    refresh();
  }, [refresh]);

  return { campaigns, loading, error, refresh, actions: { create, update, toggleActive, remove } };
}
