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
    const { data } = await supabase.from("notifications").select("*").eq("recipient_id", userId).eq("read", false).order("created_at", { ascending: false }).limit(10);
    const n = (data ?? []) as Notification[];
    setNotifications(n);
    setUnreadCount(n.length);
  }, [userId]);

  useEffect(() => {
    void fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => clearInterval(interval);
  }, [fetch_]);

  const markAsRead = useCallback(async (id: string) => {
    if (!supabase) return;
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

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

  return { notifications, unreadCount, markAsRead, sendUpdateRequest, refetch: fetch_ };
}
