import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";

export interface Notification {
  id: string; type: string; title: string; message: string | null;
  action_url: string | null; read: boolean; created_at: string;
  sender_id: string | null;
}

export function useNotifications(userId: string | null, accountId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetch_ = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Wait for auth session before querying
    const { data, error } = await supabase.from("notifications").select("*").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(50);
    if (error) { console.error("Notifications fetch error:", error.message); return; }
    const n = (data ?? []) as Notification[];
    setNotifications(n);
    setUnreadCount(n.filter((x) => !x.read).length);
  }, [userId]);

  useEffect(() => {
    void fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => clearInterval(interval);
  }, [fetch_]);

  const markAsRead = useCallback(async (id: string) => {
    if (!supabase || !userId) return;
    // Optimistic update first for instant UI feedback
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    // Then persist — include recipient_id for RLS compatibility
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("recipient_id", userId);
    if (error) { console.error("markAsRead error:", error.message); void fetch_(); }
  }, [userId, fetch_]);

  const markAllAsRead = useCallback(async () => {
    if (!supabase || !userId) return;
    // Optimistic update first
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    const { error } = await supabase.from("notifications").update({ read: true }).eq("recipient_id", userId).eq("read", false);
    if (error) { console.error("markAllAsRead error:", error.message); void fetch_(); }
  }, [userId, fetch_]);

  const sendUpdateRequest = useCallback(async (recipientId: string, _recipientName: string, senderName: string) => {
    if (!supabase || !userId || !accountId) return false;
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase.from("notifications").select("id").eq("sender_id", userId).eq("recipient_id", recipientId).eq("type", "update_request").gte("created_at", today + "T00:00:00").limit(1);
    if (existing && existing.length > 0) return false;
    const { error } = await supabase.from("notifications").insert({
      account_id: accountId, recipient_id: recipientId, sender_id: userId,
      type: "update_request", title: "Solicitação de atualização",
      message: `${senderName} solicitou que você atualize suas atividades de hoje.`,
      action_url: "/atividades",
    });
    return !error;
  }, [userId, accountId]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, sendUpdateRequest, refetch: fetch_ };
}
