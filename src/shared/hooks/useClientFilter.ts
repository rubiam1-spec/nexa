import { useEffect, useState } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";
import { useAccount } from "../../app/contexts/AccountContext";
import { useAuth } from "../../app/contexts/AuthContext";

export function useClientFilter() {
  const { account, isBroker, brokerId, isConsultant } = useAccount();
  const { authenticatedProfile } = useAuth();
  const userId = authenticatedProfile?.id ?? null;
  const accountId = account?.accountId ?? null;
  const needsFilter = isBroker || isConsultant;

  const [filter, setFilter] = useState<{ userId: string; clientIdsFromNegs: string[] } | undefined>(undefined);

  useEffect(() => {
    if (!needsFilter || !userId || !supabase || !accountId) {
      setFilter(undefined);
      return;
    }

    async function load() {
      let query = supabase!.from("negotiations").select("client_id").eq("account_id", accountId!);
      if (isBroker && brokerId) query = query.eq("broker_id", brokerId);
      else if (isConsultant) query = query.eq("owner_profile_id", userId);

      const { data } = await query;
      const ids = [...new Set((data ?? []).map((n: Record<string, unknown>) => n.client_id as string).filter(Boolean))];
      setFilter({ userId: userId!, clientIdsFromNegs: ids });
    }

    void load();
  }, [needsFilter, userId, accountId, isBroker, brokerId, isConsultant]);

  return filter;
}
