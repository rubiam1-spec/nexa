// N4 · hook do sino unificado. Compõe as DUAS fontes vivas — notifications
// (useNotifications) + intelligence_alerts (lido direto aqui) — no notificationFeed.
// operational_alerts NÃO entra (ver notificationFeed.ts). Badge = só acionáveis.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";
import { useNotifications } from "./useNotifications";
import { buildNotificationFeed, feedBadgeCount, type FeedAlert } from "../notifications/notificationFeed";

export function useNotificationFeed(userId: string | null, accountId: string | null) {
  const { notifications, markAsRead, markAllAsRead, refetch: refetchNotifs } = useNotifications(userId, accountId);
  const [alerts, setAlerts] = useState<FeedAlert[]>([]);

  const loadAlerts = useCallback(async () => {
    if (!supabase || !accountId) { setAlerts([]); return; }
    const { data } = await supabase
      .from("intelligence_alerts")
      .select("id, alert_type, priority, title, message, metadata, created_at")
      .eq("account_id", accountId)
      .eq("resolved", false)
      .gt("expires_at", new Date().toISOString())
      .order("priority")
      .order("created_at", { ascending: false })
      .limit(30);
    setAlerts((data ?? []) as FeedAlert[]);
  }, [accountId]);

  useEffect(() => {
    void loadAlerts();
    const i = setInterval(() => void loadAlerts(), 60000);
    return () => clearInterval(i);
  }, [loadAlerts]);

  // Resolver alerta do motor: grava resolved/resolved_at/resolved_by (policy OK).
  const resolveAlert = useCallback(async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId)); // otimista → some do sino
    if (!supabase) return;
    const { error } = await supabase
      .from("intelligence_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", alertId);
    if (error) { console.error("resolveAlert error:", error.message); void loadAlerts(); }
  }, [userId, loadAlerts]);

  const feed = useMemo(() => buildNotificationFeed(notifications, alerts, Date.now()), [notifications, alerts]);
  const badge = useMemo(() => feedBadgeCount(feed, Date.now()), [feed]);

  return { feed, badge, markAsRead, markAllAsRead, resolveAlert, refetch: () => { void refetchNotifs(); void loadAlerts(); } };
}
