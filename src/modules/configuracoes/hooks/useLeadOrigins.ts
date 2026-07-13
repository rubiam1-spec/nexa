import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { getLeadOrigins, createLeadOrigin, setLeadOriginActive, type LeadOrigin } from "../../../infra/repositories/leadOriginsSupabaseRepository";

// Hook do catálogo de origens (Configurações → Leads → Origens). Regra fora da UI.
export function useLeadOrigins() {
  const { account } = useAccount();
  const accountId = account?.accountId ?? null;
  const [origins, setOrigins] = useState<LeadOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getLeadOrigins(accountId)
      .then((list) => { if (active) { setOrigins(list); setError(null); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, refreshKey]);

  const create = useCallback(async (label: string) => {
    if (!accountId) return;
    await createLeadOrigin(accountId, label);
    refresh();
  }, [accountId, refresh]);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await setLeadOriginActive(id, active);
    refresh();
  }, [refresh]);

  return { origins, loading, error, refresh, actions: { create, toggleActive } };
}
