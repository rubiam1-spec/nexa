import { supabase } from "../../infra/supabase/supabaseClient";

const EMAIL_TYPES = new Set([
  "new_proposal",
  "counter_proposal",
  "docs_ready_for_review",
  "proposal_approved",
  "proposal_rejected",
  "doc_rejected",
  "client_ready_for_contract",
  "reservation_requested",
  "reservation_approved",
  "reservation_rejected",
  "sale_registered",
  "brokerage_manager_assigned",
]);

interface NotifData {
  account_id: string;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  title: string;
  message: string;
  action_url: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an in-app notification and optionally send email for critical types.
 * Fire-and-forget — errors are logged but don't throw.
 */
export async function createNotificationWithEmail(data: NotifData): Promise<void> {
  if (!supabase) return;
  await supabase.from("notifications").insert({ account_id: data.account_id, recipient_id: data.recipient_id, sender_id: data.sender_id, type: data.type, title: data.title, message: data.message, action_url: data.action_url, read: false });
  if (EMAIL_TYPES.has(data.type)) {
    supabase.functions.invoke("send-notification-email", {
      body: { recipient_id: data.recipient_id, type: data.type, title: data.title, message: data.message, action_url: data.action_url, metadata: data.metadata },
    }).catch((err) => console.error("Email dispatch error:", err));
  }
}

/**
 * Create multiple notifications, with email for critical types.
 */
export async function createNotificationsWithEmail(items: NotifData[]): Promise<void> {
  if (!supabase || items.length === 0) return;
  await supabase.from("notifications").insert(items.map((d) => ({ account_id: d.account_id, recipient_id: d.recipient_id, sender_id: d.sender_id, type: d.type, title: d.title, message: d.message, action_url: d.action_url, read: false })));
  for (const d of items) {
    if (EMAIL_TYPES.has(d.type)) {
      supabase.functions.invoke("send-notification-email", {
        body: { recipient_id: d.recipient_id, type: d.type, title: d.title, message: d.message, action_url: d.action_url, metadata: d.metadata },
      }).catch((err) => console.error("Email dispatch error:", err));
    }
  }
}
