import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

// ── Types ──

export interface ScheduledActivity {
  id: string; type: string; title: string; status: string;
  activity_date: string; start_time: string | null;
  contact_name: string | null; profile_id: string;
}

export interface TeamMember {
  id: string; name: string; role: string; initials: string;
  avatarUrl: string | null;
  activitiesToday: number; activeNegotiations: number;
  lastActivityDaysAgo: number; status: "active" | "warning" | "inactive";
  brokerageName?: string;
}

export interface PendingAction {
  type: "reservation_request" | "expiring_reservation" | "proposal";
  id: string; label: string; detail: string; entityId: string;
}

export interface LeadItem { id: string; name: string; phone: string | null; origin: string | null; origin_detail: string | null; created_at: string }

export interface MeuDiaData {
  agenda: { overdue: ScheduledActivity[]; today: ScheduledActivity[]; upcoming: ScheduledActivity[] };
  team: { members: TeamMember[]; inactiveCount: number };
  pendingActions: PendingAction[];
  newLeads: LeadItem[];
  stats: { activeNegotiations: number; activeReservations: number; salesThisMonth: number; availableUnits: number; totalUnits: number; expiringReservationsCount: number };
  funnel: { negotiation: number; proposal: number; reservation: number; sale: number };
  myNegotiations: { active: number; pendingProposals: number; reservations: number; simulations: number };
  loading: boolean;
}

const EMPTY: MeuDiaData = {
  agenda: { overdue: [], today: [], upcoming: [] },
  team: { members: [], inactiveCount: 0 },
  pendingActions: [],
  newLeads: [],
  stats: { activeNegotiations: 0, activeReservations: 0, salesThisMonth: 0, availableUnits: 0, totalUnits: 0, expiringReservationsCount: 0 },
  funnel: { negotiation: 0, proposal: 0, reservation: 0, sale: 0 },
  myNegotiations: { active: 0, pendingProposals: 0, reservations: 0, simulations: 0 },
  loading: true,
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }

export function useMyDay(userId: string | null, accountId: string | null, developmentId: string | null, role: string | null) {
  const [data, setData] = useState<MeuDiaData>(EMPTY);

  const load = useCallback(async () => {
    if (!supabase || !accountId || !developmentId || !userId) { setData({ ...EMPTY, loading: false }); return; }
    setData((d) => ({ ...d, loading: true }));

    try {
      // Expire overdue activities
      await supabase.rpc("expire_overdue_activities", { p_account_id: accountId }).then(() => {}, () => {});

      const today = todayStr();
      const in7d = new Date(); in7d.setDate(in7d.getDate() + 7);
      const in7dStr = in7d.toISOString().slice(0, 10);
      const isBroker = role === "broker";
      const isConsultant = role === "commercial_consultant";

      // ── AGENDA: My scheduled activities ──
      let actQuery = supabase.from("activities").select("id, type, title, status, activity_date, start_time, contact_name, profile_id").eq("account_id", accountId).in("status", ["scheduled", "expired"]).lte("activity_date", in7dStr).order("activity_date", { ascending: true });
      if (isBroker || isConsultant) actQuery = actQuery.eq("profile_id", userId);
      const { data: myActs } = await actQuery;
      const allActs = (myActs ?? []) as ScheduledActivity[];
      const agendaOverdue = allActs.filter((a) => a.activity_date < today);
      const agendaToday = allActs.filter((a) => a.activity_date === today && a.status === "scheduled");
      const agendaUpcoming = allActs.filter((a) => a.activity_date > today && a.status === "scheduled");

      // ── TEAM: Members with stats ──
      const { data: teamRaw } = await supabase.from("user_account_access").select("user_id, role, profiles!inner(id, name, avatar_url)").eq("account_id", accountId);
      const members: TeamMember[] = [];

      if (teamRaw && teamRaw.length > 0) {
        const memberIds = (teamRaw as Record<string, unknown>[]).map((t) => t.user_id as string);

        // Batch: activities today per member (all statuses count)
        const { data: todayActs } = await supabase.from("activities").select("profile_id").eq("account_id", accountId).eq("activity_date", today);
        const todayByUser: Record<string, number> = {};
        (todayActs ?? []).forEach((a: Record<string, unknown>) => { const pid = a.profile_id as string; todayByUser[pid] = (todayByUser[pid] || 0) + 1; });

        // Batch: last activity per member
        const { data: lastActs } = await supabase.from("activities").select("profile_id, activity_date").eq("account_id", accountId).in("profile_id", memberIds).order("activity_date", { ascending: false });
        const lastByUser: Record<string, string> = {};
        (lastActs ?? []).forEach((a: Record<string, unknown>) => { const pid = a.profile_id as string; if (!lastByUser[pid]) lastByUser[pid] = a.activity_date as string; });

        // Batch: active negotiations per member
        const { data: negsByMember } = await supabase.from("negotiations").select("broker_id, owner_profile_id").eq("account_id", accountId).eq("development_id", developmentId).in("status", ["open", "in_progress", "OPEN", "IN_PROGRESS"]);
        const negCountByUser: Record<string, number> = {};
        (negsByMember ?? []).forEach((n: Record<string, unknown>) => {
          const bid = n.broker_id as string; const oid = n.owner_profile_id as string;
          if (bid) negCountByUser[bid] = (negCountByUser[bid] || 0) + 1;
          if (oid) negCountByUser[oid] = (negCountByUser[oid] || 0) + 1;
        });

        const excludeRoles = new Set(["owner", "director", "broker"]);
        const seenNames = new Set<string>();
        for (const row of teamRaw as Record<string, unknown>[]) {
          const p = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Record<string, unknown> | null;
          if (!p || (p.id as string) === userId) continue;
          if (excludeRoles.has(row.role as string)) continue;
          const memberName = (p.name as string) || "";
          if (seenNames.has(memberName)) continue;
          seenNames.add(memberName);
          const pid = p.id as string;
          const lastDate = lastByUser[pid];
          const daysAgo = lastDate ? Math.floor((Date.now() - new Date(lastDate + "T12:00:00").getTime()) / 864e5) : 999;
          members.push({
            id: pid, name: (p.name as string) || "—", role: row.role as string,
            initials: initials((p.name as string) || "?"),
            avatarUrl: (p.avatar_url as string) || null,
            activitiesToday: todayByUser[pid] || 0,
            activeNegotiations: negCountByUser[pid] || 0,
            lastActivityDaysAgo: daysAgo,
            status: daysAgo === 0 ? "active" : daysAgo <= 3 ? "warning" : "inactive",
          });
        }
        members.sort((a, b) => a.lastActivityDaysAgo - b.lastActivityDaysAgo);
      }

      // ── PENDING ACTIONS (director/manager) ──
      const pendingActions: PendingAction[] = [];
      const { data: pendingReqs } = await supabase.from("reservation_requests").select("id, negotiation_id, unit_id, status").eq("account_id", accountId).eq("development_id", developmentId).eq("status", "pending");
      (pendingReqs ?? []).forEach((r: Record<string, unknown>) => {
        pendingActions.push({ type: "reservation_request", id: r.id as string, label: "Solicitação de reserva", detail: "Aguardando aprovação", entityId: r.negotiation_id as string });
      });

      const in48h = new Date(); in48h.setHours(in48h.getHours() + 48);
      const { data: expiringRes } = await supabase.from("reservations").select("id, negotiation_id, expires_at").eq("account_id", accountId).eq("development_id", developmentId).eq("status", "ativa").lt("expires_at", in48h.toISOString());
      (expiringRes ?? []).forEach((r: Record<string, unknown>) => {
        pendingActions.push({ type: "expiring_reservation", id: r.id as string, label: "Reserva vencendo", detail: `Expira em ${new Date(r.expires_at as string).toLocaleDateString("pt-BR")}`, entityId: r.negotiation_id as string });
      });

      // ── STATS (include both lowercase and uppercase status values) ──
      const { count: activeNeg } = await supabase.from("negotiations").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["open", "in_progress", "OPEN", "IN_PROGRESS"]);
      const { count: activeRes } = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["ativa", "active", "ACTIVE"]);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { count: salesMonth } = await supabase.from("sales").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).gte("created_at", monthStart.toISOString());
      const { count: availableUnits } = await supabase.from("units").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).eq("status", "available");
      const { count: totalUnits } = await supabase.from("units").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId);

      // ── FUNNEL ──
      const { count: fNegCount } = await supabase.from("negotiations").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["open", "in_progress", "OPEN", "IN_PROGRESS"]);
      const fNeg = fNegCount ?? 0;
      const { count: fProp } = await supabase.from("proposals").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["sent", "under_analysis", "SENT", "UNDER_ANALYSIS"]);
      const fRes = activeRes ?? 0;
      const fSale = salesMonth ?? 0;

      // ── MY NEGOTIATIONS (consultant/broker) ──
      let myActive = 0, myPending = 0, myRes = 0, mySims = 0;
      if (isBroker || isConsultant) {
        const filter = isBroker ? { broker_id: userId } : { owner_profile_id: userId };
        const { count: ma } = await supabase.from("negotiations").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["open", "in_progress", "OPEN", "IN_PROGRESS"]).match(filter);
        myActive = ma ?? 0;
        const { count: mp } = await supabase.from("proposals").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["sent", "under_analysis"]).match(isBroker ? { broker_id: userId } : {});
        myPending = mp ?? 0;
        const { count: ms } = await supabase.from("pipeline_simulations").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("development_id", developmentId).in("status", ["ativa", "draft"]).match(isBroker ? { broker_id: userId } : { created_by: userId });
        mySims = ms ?? 0;
      }

      // ── NEW LEADS ──
      let leadsQuery = supabase.from("clients").select("id, name, phone, origin, origin_detail, created_at").eq("account_id", accountId).eq("status", "lead").order("created_at", { ascending: false }).limit(10);
      if (isConsultant && userId) leadsQuery = leadsQuery.eq("assigned_to", userId);
      const { data: leadsRaw } = await leadsQuery;
      const newLeads = (leadsRaw ?? []) as LeadItem[];

      setData({
        agenda: { overdue: agendaOverdue, today: agendaToday, upcoming: agendaUpcoming },
        team: { members, inactiveCount: members.filter((m) => m.status === "inactive").length },
        pendingActions,
        newLeads,
        stats: { activeNegotiations: activeNeg ?? 0, activeReservations: activeRes ?? 0, salesThisMonth: salesMonth ?? 0, availableUnits: availableUnits ?? 0, totalUnits: totalUnits ?? 0, expiringReservationsCount: (expiringRes ?? []).length },
        funnel: { negotiation: fNeg, proposal: fProp ?? 0, reservation: fRes, sale: fSale },
        myNegotiations: { active: myActive, pendingProposals: myPending, reservations: myRes, simulations: mySims },
        loading: false,
      });
    } catch (err) {
      console.error("useMyDay error:", err);
      setData({ ...EMPTY, loading: false });
    }
  }, [userId, accountId, developmentId, role]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading: data.loading, refetch: load };
}
