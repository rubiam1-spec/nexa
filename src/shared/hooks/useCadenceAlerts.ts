import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";
import { NegotiationStatus } from "../../domain/status/negotiation";
import { RESERVATION_ACTIVE_DB } from "../../domain/status/reservation";
import { notificationSubject } from "../notifications/notificationSubject";
import {
  buildStaleDigest,
  shouldSuppressStale,
  STALE_TYPE,
  STALE_DIGEST_ACTION_URL,
  type StaleNegotiation,
} from "../notifications/staleDigest";

const TYPE_LABELS: Record<string, string> = {
  visit_client: "Visita", visit_broker: "Visita corretor", visit_development: "Visita empreendimento",
  phone_call: "Ligação", meeting_external: "Reunião", meeting_internal: "Reunião interna",
  follow_up: "Follow-up", training: "Treinamento", other: "Atividade",
};

export function useCadenceAlerts(
  accountId: string | null,
  userId: string | null,
  role: string | null,
) {
  const managerRan = useRef(false);

  const checkReminders = useCallback(async () => {
    if (!supabase || !accountId || !userId) return;

    // ── Activity reminders (30 min before) — runs for ALL roles ──
    const now = new Date();
    const in30min = new Date(now.getTime() + 30 * 60000);
    const today = now.toISOString().slice(0, 10);

    try {
      const { data: upcoming } = await supabase
        .from("activities")
        .select("id, title, type, start_time, activity_date, clients(name), contact_name")
        .eq("account_id", accountId)
        .eq("profile_id", userId)
        .eq("activity_date", today)
        .eq("status", "scheduled")
        .not("start_time", "is", null);

      for (const act of (upcoming || []) as Record<string, unknown>[]) {
        const st = act.start_time as string;
        if (!st) continue;
        const actTime = new Date(`${act.activity_date}T${st}`);
        if (actTime <= now || actTime > in30min) continue;

        // Anti-duplicate: check if reminder already exists for this activity
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", userId)
          .eq("type", "activity_reminder")
          .like("message", `%${(act.title as string).slice(0, 30)}%`)
          .gte("created_at", today + "T00:00:00Z")
          .limit(1);

        if (!existing || existing.length === 0) {
          const cl = act.clients as Record<string, unknown> | null;
          const cn = (cl?.name as string) || (act.contact_name as string) || "";
          const timeStr = st.slice(0, 5);
          const typeLabel = TYPE_LABELS[act.type as string] || "Atividade";

          await supabase.from("notifications").insert({
            account_id: accountId, recipient_id: userId, sender_id: null,
            type: "activity_reminder", title: `${typeLabel} em 30 min`,
            message: `${timeStr} — ${act.title}${cn ? ` · ${cn}` : ""}`,
            read: false, action_url: "/atividades",
          });
        }
      }
    } catch (err) {
      console.error("Activity reminder check error:", err);
    }
  }, [accountId, userId]);

  const checkManagerAlerts = useCallback(async () => {
    if (!supabase || !accountId || !userId) return;
    const today = new Date().toISOString().slice(0, 10);

    try {
      // ── Follow-ups overdue ──
      const { data: overdue } = await supabase
        .from("activities")
        .select("id, title, next_action_date, profile_id, clients(name)")
        .eq("account_id", accountId)
        .lt("next_action_date", today)
        .in("status", ["scheduled", "expired"])
        .not("next_action_date", "is", null);

      if (overdue && overdue.length > 0) {
        const { data: existingFU } = await supabase.from("notifications").select("id").eq("type", "followup_overdue").eq("account_id", accountId).gte("created_at", today + "T00:00:00Z").limit(1);
        if (!existingFU || existingFU.length === 0) {
          const seen = new Set<string>();
          const notifs = overdue.slice(0, 5).map((fu: Record<string, unknown>) => {
            const pid = fu.profile_id as string;
            if (seen.has(pid)) return null;
            seen.add(pid);
            const cl = fu.clients as Record<string, unknown> | null;
            return { account_id: accountId, recipient_id: pid, sender_id: null, type: "followup_overdue", title: "Follow-up pendente", message: `Follow-up com ${(cl?.name as string) || (fu.title as string)} venceu em ${fu.next_action_date}.`, read: false, action_url: "/atividades" };
          }).filter(Boolean);
          if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
        }
      }

      // ── Stale negotiations (use cadence_settings if available) ──
      let idleHours = 72;
      try {
        const { data: cadCfg } = await supabase.from("cadence_settings").select("negotiation_idle_hours").eq("account_id", accountId).limit(1).maybeSingle();
        if (cadCfg?.negotiation_idle_hours) idleHours = Number(cadCfg.negotiation_idle_hours);
      } catch { /* use default */ }
      const idleSince = new Date(Date.now() - idleHours * 3600000).toISOString();
      const { data: stale } = await supabase.from("negotiations").select("id, updated_at, broker_id, clients(name), units(quadra, lote)").eq("account_id", accountId).in("status", [NegotiationStatus.IN_PROGRESS, NegotiationStatus.OPEN]).lt("updated_at", idleSince).limit(50);
      if (stale && stale.length > 0) {
        // Fim da metralhadora: UMA notificação-digest por destinatário, suprimida
        // enquanto houver uma NÃO LIDA e por cooldown após a última (ver staleDigest).
        const { data: last } = await supabase.from("notifications").select("read, created_at").eq("type", STALE_TYPE).eq("recipient_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!shouldSuppressStale(last, Date.now())) {
          const negs: StaleNegotiation[] = stale.map((n: Record<string, unknown>) => {
            const cl = n.clients as Record<string, unknown> | null; const un = n.units as Record<string, unknown> | null;
            return { id: n.id as string, updatedAt: n.updated_at as string, clientName: cl?.name as string | null, quadra: un?.quadra as string | number | null, lote: un?.lote as string | number | null };
          });
          const digest = buildStaleDigest(negs, Date.now());
          if (digest) {
            await supabase.from("notifications").insert({ account_id: accountId, recipient_id: userId, sender_id: null, type: STALE_TYPE, title: digest.title, message: digest.message, read: false, action_url: STALE_DIGEST_ACTION_URL });
          }
        }
      }

      // ── Reservations expiring in 24h ──
      const in24h = new Date(Date.now() + 24 * 3600000).toISOString();
      const now = new Date().toISOString();
      const { data: expiring } = await supabase.from("reservations").select("id, expires_at, negotiation_id, negotiations(broker_id, clients(name), units(quadra, lote))").eq("account_id", accountId).eq("status", RESERVATION_ACTIVE_DB).lt("expires_at", in24h).gt("expires_at", now);
      if (expiring && expiring.length > 0) {
        const { data: existingExp } = await supabase.from("notifications").select("id").eq("type", "reservation_expiring").eq("account_id", accountId).gte("created_at", today + "T00:00:00Z").limit(1);
        if (!existingExp || existingExp.length === 0) {
          const notifs = expiring.map((r: Record<string, unknown>) => {
            const neg = r.negotiations as Record<string, unknown> | null; const cl = neg?.clients as Record<string, unknown> | null; const un = neg?.units as Record<string, unknown> | null;
            const subject = notificationSubject({ clientName: cl?.name as string | null, quadra: un?.quadra as string | number | null, lote: un?.lote as string | number | null, negotiationId: r.negotiation_id as string | null });
            return { account_id: accountId, recipient_id: userId, sender_id: null, type: "reservation_expiring", title: "Reserva expirando", message: `Reserva de ${subject} expira em menos de 24h.`, read: false, action_url: "/negociacoes" };
          });
          if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
        }
      }
    } catch (err) {
      console.error("Cadence alerts check error:", err);
    }
  }, [accountId, userId]);

  useEffect(() => {
    if (!accountId || !userId) return;

    // Activity reminders: run immediately + every 15 min (all roles)
    checkReminders();
    const reminderInterval = setInterval(checkReminders, 15 * 60000);

    // Manager alerts: run once per session (managers/directors/owners only)
    if (!managerRan.current && ["owner", "director", "manager"].includes(role ?? "")) {
      managerRan.current = true;
      checkManagerAlerts();
    }

    return () => clearInterval(reminderInterval);
  }, [accountId, userId, role, checkReminders, checkManagerAlerts]);
}
