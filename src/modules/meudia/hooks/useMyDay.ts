import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

// ── Types ──

export interface OperationalAlert {
  entity_id: string;
  entity_type: "negotiation" | "proposal";
  account_id: string;
  development_id: string;
  broker_id: string | null;
  client_id: string | null;
  unit_id: string | null;
  entity_status: string;
  last_activity_at: string;
  next_action_at: string | null;
  follow_up_at: string | null;
  hours_idle: number;
  threshold_hours: number;
  severity: "upcoming" | "warning" | "yellow" | "red" | "abandoned";
  alert_type: string;
  alert_message: string;
  // Enriched
  client_name?: string;
  unit_label?: string;
  broker_name?: string;
}

export interface BrokerSummary {
  id: string;
  name: string;
  activeNegotiations: number;
  alerts: OperationalAlert[];
  lastActivityAt: string | null;
  daysSinceActivity: number;
}

export interface ScheduledActivity {
  id: string; type: string; title: string; status: string;
  activity_date: string; start_time: string | null;
  contact_name: string | null; profile_id: string;
}

export interface MyDayData {
  // Broker view
  urgent: OperationalAlert[];      // PARA AGORA (red + abandoned)
  today: OperationalAlert[];       // PARA HOJE (upcoming + warning followups)
  overdue: OperationalAlert[];     // ATRASADOS (yellow warnings)

  // Scheduled activities
  activitiesForToday: ScheduledActivity[];
  activitiesOverdue: ScheduledActivity[];
  activitiesUpcoming: ScheduledActivity[];

  // Consultant view
  brokerSummaries: BrokerSummary[];
  myFollowUps: { today: number; overdue: number };

  // Director view
  healthPct: number;
  totalActiveNegotiations: number;
  alertsByType: { red: number; yellow: number; warning: number };
  inactiveBrokers: BrokerSummary[];

  // Metrics (all roles)
  activitiesToday: number;
  activitiesWeek: number;
  conversionsMonth: number;
}

const EMPTY: MyDayData = {
  urgent: [], today: [], overdue: [],
  activitiesForToday: [], activitiesOverdue: [], activitiesUpcoming: [],
  brokerSummaries: [], myFollowUps: { today: 0, overdue: 0 },
  healthPct: 100, totalActiveNegotiations: 0,
  alertsByType: { red: 0, yellow: 0, warning: 0 },
  inactiveBrokers: [],
  activitiesToday: 0, activitiesWeek: 0, conversionsMonth: 0,
};

export function useMyDay(
  accountId: string | null,
  developmentId: string | null,
  userId: string | null,
  role: string | null,
) {
  const [data, setData] = useState<MyDayData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !accountId || !developmentId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch operational alerts
      const { data: rawAlerts } = await supabase
        .from("operational_alerts")
        .select("*")
        .eq("account_id", accountId)
        .eq("development_id", developmentId);

      const alerts = (rawAlerts ?? []) as OperationalAlert[];

      // 2. Enrich with client names, unit labels, broker names
      const clientIds = [...new Set(alerts.map(a => a.client_id).filter(Boolean))];
      const unitIds = [...new Set(alerts.map(a => a.unit_id).filter(Boolean))];
      const brokerIds = [...new Set(alerts.map(a => a.broker_id).filter(Boolean))];

      const [clientsRes, unitsRes, brokersRes] = await Promise.all([
        clientIds.length > 0
          ? supabase.from("clients").select("id, name").in("id", clientIds)
          : { data: [] },
        unitIds.length > 0
          ? supabase.from("units").select("id, quadra, lote").in("id", unitIds)
          : { data: [] },
        brokerIds.length > 0
          ? supabase.from("brokers").select("id, name").in("id", brokerIds)
          : { data: [] },
      ]);

      const clientMap = new Map((clientsRes.data ?? []).map((c: Record<string, unknown>) => [c.id as string, c.name as string]));
      const unitMap = new Map((unitsRes.data ?? []).map((u: Record<string, unknown>) => [u.id as string, `Q${u.quadra} · Lote ${u.lote}`]));
      const brokerMap = new Map((brokersRes.data ?? []).map((b: Record<string, unknown>) => [b.id as string, b.name as string]));

      for (const a of alerts) {
        a.client_name = a.client_id ? clientMap.get(a.client_id) ?? undefined : undefined;
        a.unit_label = a.unit_id ? unitMap.get(a.unit_id) ?? undefined : undefined;
        a.broker_name = a.broker_id ? brokerMap.get(a.broker_id) ?? undefined : undefined;
      }

      // 3. Filter by role
      const isBroker = role === "broker";
      const myAlerts = isBroker && userId
        ? alerts.filter(a => a.broker_id === userId)
        : alerts;

      // 4. Categorize
      const urgent = myAlerts.filter(a => a.severity === "red" || a.severity === "abandoned");
      const today = myAlerts.filter(a =>
        a.alert_type === "followup_upcoming" ||
        (a.severity === "warning" && a.alert_type === "followup_overdue")
      );
      const overdue = myAlerts.filter(a =>
        a.severity === "yellow" ||
        (a.severity === "warning" && a.alert_type !== "followup_upcoming" && a.alert_type !== "followup_overdue")
      );

      // 5. Broker summaries (for consultant/director)
      const brokerAlertMap = new Map<string, OperationalAlert[]>();
      for (const a of alerts) {
        if (!a.broker_id) continue;
        const existing = brokerAlertMap.get(a.broker_id) ?? [];
        existing.push(a);
        brokerAlertMap.set(a.broker_id, existing);
      }

      // Fetch all active negotiations for broker summaries
      const { data: activeNegs } = await supabase
        .from("negotiations")
        .select("id, broker_id, last_activity_at")
        .eq("account_id", accountId)
        .eq("development_id", developmentId)
        .in("status", ["open", "in_progress", "OPEN", "IN_PROGRESS"]);

      const negsByBroker = new Map<string, { count: number; lastActivity: string | null }>();
      for (const n of (activeNegs ?? []) as Record<string, unknown>[]) {
        const bid = n.broker_id as string;
        if (!bid) continue;
        const existing = negsByBroker.get(bid) ?? { count: 0, lastActivity: null };
        existing.count++;
        const la = n.last_activity_at as string | null;
        if (la && (!existing.lastActivity || la > existing.lastActivity)) {
          existing.lastActivity = la;
        }
        negsByBroker.set(bid, existing);
      }

      const brokerSummaries: BrokerSummary[] = [];
      const allBrokerIds = new Set([...brokerAlertMap.keys(), ...negsByBroker.keys()]);
      for (const bid of allBrokerIds) {
        const bAlerts = brokerAlertMap.get(bid) ?? [];
        const bNegs = negsByBroker.get(bid) ?? { count: 0, lastActivity: null };
        const daysSince = bNegs.lastActivity
          ? Math.floor((Date.now() - new Date(bNegs.lastActivity).getTime()) / 86400000)
          : 999;
        brokerSummaries.push({
          id: bid,
          name: brokerMap.get(bid) ?? "Corretor",
          activeNegotiations: bNegs.count,
          alerts: bAlerts,
          lastActivityAt: bNegs.lastActivity,
          daysSinceActivity: daysSince,
        });
      }
      brokerSummaries.sort((a, b) => b.alerts.length - a.alerts.length || b.daysSinceActivity - a.daysSinceActivity);

      // 6. Health percentage
      const totalActive = (activeNegs ?? []).length;
      const problemCount = alerts.filter(a => a.severity === "red" || a.severity === "abandoned").length;
      const healthPct = totalActive > 0 ? Math.round(((totalActive - problemCount) / totalActive) * 100) : 100;

      // 7. Alert counts
      const alertsByType = {
        red: alerts.filter(a => a.severity === "red" || a.severity === "abandoned").length,
        yellow: alerts.filter(a => a.severity === "yellow").length,
        warning: alerts.filter(a => a.severity === "warning").length,
      };

      // 8. Inactive brokers (3+ days)
      const inactiveBrokers = brokerSummaries.filter(b => b.daysSinceActivity >= 3);

      // 9. Follow-ups for consultant
      const todayFollowUps = alerts.filter(a => a.alert_type === "followup_upcoming").length;
      const overdueFollowUps = alerts.filter(a => a.alert_type === "followup_overdue").length;

      // 10. Conversions this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count: salesCount } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("development_id", developmentId)
        .gte("created_at", startOfMonth.toISOString());

      // 11. Expire overdue activities + fetch scheduled activities
      await supabase.rpc("expire_overdue_activities", { p_account_id: accountId }).then(() => {}, () => {});
      const todayDate = new Date().toISOString().slice(0, 10);
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);
      const in7Date = in7.toISOString().slice(0, 10);
      let actQuery = supabase.from("activities").select("id, type, title, status, activity_date, start_time, contact_name, profile_id").eq("account_id", accountId).in("status", ["scheduled", "expired"]).lte("activity_date", in7Date).order("activity_date", { ascending: true });
      if (isBroker && userId) actQuery = actQuery.eq("profile_id", userId);
      const { data: scheduledActs } = await actQuery;
      const allSched = (scheduledActs ?? []) as ScheduledActivity[];
      const activitiesForToday = allSched.filter(a => a.activity_date === todayDate && a.status === "scheduled");
      const activitiesOverdue = allSched.filter(a => a.activity_date < todayDate && a.status === "scheduled");
      const activitiesExpired = allSched.filter(a => a.status === "expired");
      const activitiesUpcoming = allSched.filter(a => a.activity_date > todayDate && a.status === "scheduled");

      setData({
        urgent,
        today,
        overdue,
        activitiesForToday,
        activitiesOverdue: [...activitiesOverdue, ...activitiesExpired],
        activitiesUpcoming,
        brokerSummaries,
        myFollowUps: { today: todayFollowUps, overdue: overdueFollowUps },
        healthPct,
        totalActiveNegotiations: totalActive,
        alertsByType,
        inactiveBrokers,
        activitiesToday: 0,
        activitiesWeek: 0,
        conversionsMonth: salesCount ?? 0,
      });
    } catch (err) {
      console.error("useMyDay error:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId, developmentId, userId, role]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, refetch: load };
}
