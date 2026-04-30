import { useEffect, useState } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";

export interface BrokerProfile {
  brokerId: string | null;
  isBroker: boolean;
  isBrokerManager: boolean;
  brokerageId: string | null;
  loading: boolean;
}

export function useBrokerProfile(
  userId: string | undefined,
  role: string | null | undefined,
): BrokerProfile {
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [isBrokerManager, setIsBrokerManager] = useState(false);
  const [brokerageId, setBrokerageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || role !== "broker") {
      setBrokerId(null);
      setIsBrokerManager(false);
      setBrokerageId(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    async function fetchBrokerId() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("brokers")
        .select("id, is_manager, brokerage_id")
        .eq("profile_id", userId)
        .maybeSingle();

      if (mounted) {
        setBrokerId(data?.id ?? null);
        setIsBrokerManager(!!data?.is_manager);
        setBrokerageId(data?.brokerage_id ?? null);
        setLoading(false);
      }
    }

    void fetchBrokerId();

    return () => {
      mounted = false;
    };
  }, [userId, role]);

  return { brokerId, isBroker: role === "broker", isBrokerManager, brokerageId, loading };
}
