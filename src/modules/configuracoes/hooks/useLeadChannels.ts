import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import {
  getLeadChannels, createLeadChannel, updateLeadChannel, setLeadChannelActive,
  regenerateApiKey, deleteLeadChannel, type LeadChannel, type LeadChannelInput,
} from "../../../infra/repositories/webhookChannelsSupabaseRepository";

// Hook dos Canais de Entrada (Configurações → Leads). Regra fora da UI.
export function useLeadChannels() {
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const accountId = account?.accountId ?? null;
  const profileId = authenticatedProfile?.id ?? null;
  const [channels, setChannels] = useState<LeadChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getLeadChannels(accountId)
      .then((list) => { if (active) { setChannels(list); setError(null); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, refreshKey]);

  const create = useCallback(async (input: LeadChannelInput) => {
    if (!accountId) return;
    await createLeadChannel(accountId, profileId, input);
    refresh();
  }, [accountId, profileId, refresh]);

  const update = useCallback(async (id: string, input: LeadChannelInput) => { await updateLeadChannel(id, input); refresh(); }, [refresh]);
  const toggleActive = useCallback(async (id: string, isActive: boolean) => { await setLeadChannelActive(id, isActive); refresh(); }, [refresh]);
  const regenerate = useCallback(async (id: string) => { const key = await regenerateApiKey(id); refresh(); return key; }, [refresh]);
  const remove = useCallback(async (channel: LeadChannel) => { await deleteLeadChannel(channel); refresh(); }, [refresh]);

  /** Roleta ativa sem nenhum canal em round_robin → aviso de coerência. */
  const hasRoundRobinChannel = channels.some((c) => c.distributionMode === "round_robin");

  return { channels, loading, error, refresh, hasRoundRobinChannel, actions: { create, update, toggleActive, regenerate, remove } };
}
