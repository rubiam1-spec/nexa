import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

export interface IntelligenceAlert {
  id: string;
  alert_type: string;
  priority: "critical" | "warning" | "info";
  title: string;
  message: string;
  ai_suggestion: string | null;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  created_at: string;
  expires_at: string | null;
}

const EF_URL = "https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/intelligence-alerts";

export function useIntelligenceAlerts(accountId: string | null) {
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!supabase || !accountId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("intelligence_alerts")
        .select("id, alert_type, priority, title, message, ai_suggestion, metadata, resolved, created_at, expires_at")
        .eq("account_id", accountId)
        .eq("resolved", false)
        .gt("expires_at", new Date().toISOString())
        .order("priority")
        .order("created_at", { ascending: false })
        .limit(20);
      setAlerts((data ?? []) as IntelligenceAlert[]);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const resolveAlert = useCallback(async (alertId: string) => {
    if (!supabase) return;
    // Optimistic
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    await supabase
      .from("intelligence_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", alertId);
  }, []);

  const generateAlerts = useCallback(async () => {
    if (!accountId) return;
    setGenerating(true);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      await fetch(EF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ account_id: accountId }),
      });
      await loadAlerts();
    } catch (err) {
      console.error("Failed to generate alerts:", err);
    } finally {
      setGenerating(false);
    }
  }, [accountId, loadAlerts]);

  useEffect(() => { void loadAlerts(); }, [loadAlerts]);

  const criticalCount = alerts.filter((a) => a.priority === "critical").length;
  const warningCount = alerts.filter((a) => a.priority === "warning").length;

  return { alerts, loading, generating, criticalCount, warningCount, resolveAlert, generateAlerts };
}
