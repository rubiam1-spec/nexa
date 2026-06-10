import { useEffect, useMemo, useState } from "react";
import {
  type ActivityKind,
  fetchActivityKinds,
} from "../../../infra/repositories/activityKindsRepository";

export function useActivityKinds(opts: {
  accountId: string | null;
  developmentId?: string | null;
  enabled?: boolean;
}) {
  const { accountId, developmentId = null, enabled = true } = opts;
  const [all, setAll] = useState<ActivityKind[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !accountId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchActivityKinds(accountId, developmentId)
      .then((data) => { if (!cancelled) setAll(data); })
      .catch((err) => { console.error("[useActivityKinds]", err); if (!cancelled) setAll([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, accountId, developmentId]);

  return useMemo(() => {
    const byKey: Record<string, ActivityKind> = {};
    const byId: Record<string, ActivityKind> = {};
    for (const k of all) { byKey[k.key] = k; byId[k.id] = k; }
    return {
      all,
      loading,
      comercial: all.filter((k) => k.category === "comercial"),
      interno: all.filter((k) => k.category === "interno"),
      operacional: all.filter((k) => k.category === "operacional"),
      byKey,
      byId,
    };
  }, [all, loading]);
}
