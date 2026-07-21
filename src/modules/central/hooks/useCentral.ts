import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

// ── Types ──

export interface FocusItem {
  id: string; type: string; title: string; sub: string; priority: 1 | 2 | 3 | 4; color: string; link: string;
}
export interface PulseKPI { key: string; label: string; value: number | string; sub?: string; color?: string; }
export interface StockData { available: number; reserved: number; sold: number; inNegotiation: number; total: number; }
export interface NegotiationItem { id: string; clientName: string; unitLabel: string; status: string; valor: number; brokerName: string | null; isThirdParty: boolean; propertyName: string | null; }
export interface ContactItem { id: string; name: string; phone: string | null; temperature: string | null; status: string; origin: string | null; assignedToName: string | null; nextFollowUpAt: string | null; isOverdue: boolean; }
export interface TeamMemberData { id: string; name: string; role: string; avatarUrl: string | null; negotiations: number; activitiesWeek: number; followupsOverdue: number; }
export interface AgendaItem { id: string; type: string; title: string; startTime: string | null; clientName: string | null; responsavelName: string | null; status: string; link: string | null; }

export interface CentralData {
  focus: FocusItem[]; pulse: PulseKPI[]; stock: StockData;
  negotiations: NegotiationItem[]; negotiationsTotal: number; negotiationsPreview: string; lostCount: number; wonCount: number;
  agenda: AgendaItem[]; agendaPreview: string;
  contacts: ContactItem[]; contactsPreview: string;
  internalTeam: TeamMemberData[]; externalTeam: TeamMemberData[];
}

/**
 * Roles que acessam KPIs agregados da conta inteira (sem filtro de ownership).
 * "administrative" está incluso porque tem can_view_all_negotiations=true no preset
 * e nunca é dono/broker de negociação no modelo operacional — filtrar por
 * owner_profile_id deixava admin vendo 0 negociações indevidamente.
 *
 * Renomeado de MANAGER_ROLES para deixar claro que admin não é gestor literalmente;
 * o agrupamento aqui é sobre "visão plena da conta".
 */
export const LEADERSHIP_ROLES = ["owner", "director", "manager", "administrative"];
const INTERNAL_ROLES = ["manager", "commercial_consultant"];
const EXTERNAL_ROLES = ["broker"];
import { NegotiationStatus, isNegotiationActive } from "../../../domain/status/negotiation";
import { getTodayDateStringBRT, toDateStringBRT } from "../../../shared/utils/dateUtils";

export function useCentral(role: string | null, userId: string | null, accountId: string | null, developmentId: string | null) {
  const [data, setData] = useState<CentralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isManager = LEADERSHIP_ROLES.includes(role ?? "");

  useEffect(() => {
    if (!supabase || !accountId || !userId || !role) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const today = getTodayDateStringBRT();
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const [unitsRes, negsRes, reservRes, clientsRes, activitiesRes, docsRes, teamRes] = await Promise.all([
          developmentId ? supabase.from("units").select("id, quadra, lote, valor, status, area").eq("development_id", developmentId) : Promise.resolve({ data: [], error: null }),
          supabase.from("negotiations").select("id, status, client_id, unit_id, broker_id, owner_profile_id, third_party_property_id, created_at, updated_at, clients(name), units(quadra, lote, valor), brokers(name)").eq("account_id", accountId),
          supabase.from("reservations").select("id, negotiation_id, unit_id, status, expires_at").eq("account_id", accountId),
          supabase.from("clients").select("id, name, full_name, phone, temperature, status, origin, assigned_to, next_follow_up_at, last_interaction_at, created_at").eq("account_id", accountId).is("deleted_at", null),
          supabase.from("activities").select("id, type, title, start_time, client_id, status, activity_date, profile_id").eq("account_id", accountId).gte("activity_date", toDateStringBRT(weekStart)),
          supabase.from("client_documents").select("id, client_id, document_type, status, label").eq("account_id", accountId).in("status", ["pending", "sent"]),
          supabase.from("user_account_access").select("user_id, role, profiles!inner(id, name, role, avatar_url)").eq("account_id", accountId),
        ]);

        if (!mounted) return;

        // Log Supabase errors for debugging
        if (unitsRes.error) console.error("[Central] units query error:", unitsRes.error);
        if (negsRes.error) console.error("[Central] negotiations query error:", negsRes.error);
        if (reservRes.error) console.error("[Central] reservations query error:", reservRes.error);
        if (clientsRes.error) console.error("[Central] clients query error:", clientsRes.error);
        if (activitiesRes.error) console.error("[Central] activities query error:", activitiesRes.error);
        if (docsRes.error) console.error("[Central] docs query error:", docsRes.error);
        if (teamRes.error) console.error("[Central] team query error:", teamRes.error);

        const units = (unitsRes.data ?? []) as Record<string, unknown>[];
        const negs = (negsRes.data ?? []) as Record<string, unknown>[];
        const allReservations = (reservRes.data ?? []) as Record<string, unknown>[];
        const clients = (clientsRes.data ?? []) as Record<string, unknown>[];
        const activities = (activitiesRes.data ?? []) as Record<string, unknown>[];
        const docs = (docsRes.data ?? []) as Record<string, unknown>[];
        const teamRaw = (teamRes.data ?? []) as Record<string, unknown>[];

        const clientMap = new Map(clients.map((c) => [c.id as string, c]));
        const unitMap = new Map(units.map((u) => [u.id as string, u]));
        const profileMap = new Map(teamRaw.map((t) => {
          const p = (Array.isArray(t.profiles) ? t.profiles[0] : t.profiles) as Record<string, unknown>;
          return [t.user_id as string, { name: (p?.name as string) ?? "—", role: (t.role as string) ?? "", avatarUrl: (p?.avatar_url as string) ?? null }];
        }));

        const now = Date.now();

        // ── FOCUS ──
        const focus: FocusItem[] = [];

        // Reservations (active OR recently expired)
        allReservations.forEach((r) => {
          const exp = new Date(r.expires_at as string).getTime();
          const hoursLeft = (exp - now) / 36e5;
          if (hoursLeft < 48 || r.status === "active") {
            const neg = negs.find((n) => n.id === r.negotiation_id);
            const cl = neg ? clientMap.get(neg.client_id as string) : null;
            const un = unitMap.get(r.unit_id as string);
            const clientName = (cl?.full_name as string) || (cl?.name as string) || "Cliente não vinculado";
            const unitLabel = un ? `Q${un.quadra}·L${un.lote}` : "Unidade";
            focus.push({
              id: r.id as string, type: "reservation_expiring",
              title: hoursLeft < 0 ? `Reserva expirada ${unitLabel}` : hoursLeft < 12 ? `Reserva ${unitLabel} expira em horas` : `Reserva ${unitLabel}`,
              sub: clientName + (profileMap.get(neg?.broker_id as string)?.name ? ` · ${profileMap.get(neg?.broker_id as string)?.name}` : ""),
              priority: hoursLeft < 0 ? 1 : hoursLeft < 12 ? 1 : hoursLeft < 24 ? 2 : 3,
              color: hoursLeft < 24 ? "#F87171" : "#FBBF24",
              link: neg ? `/negociacoes/${neg.id}` : "/pipeline",
            });
          }
        });

        // Follow-ups overdue
        clients.forEach((c) => {
          const fu = c.next_follow_up_at as string | null;
          if (!fu || ["lost", "inactive"].includes(c.status as string)) return;
          if (!isManager && c.assigned_to !== userId) return;
          const daysOverdue = Math.floor((now - new Date(fu).getTime()) / 864e5);
          if (daysOverdue > 0) {
            focus.push({ id: c.id as string, type: "followup_overdue", title: `Follow-up atrasado ${daysOverdue}d`, sub: `${(c.full_name as string) || (c.name as string)} · ${profileMap.get(c.assigned_to as string)?.name ?? "sem resp."}`, priority: daysOverdue > 2 ? 1 : 3, color: daysOverdue > 2 ? "#F87171" : "#FBBF24", link: `/contatos/${c.id}` });
          }
        });

        // Unassigned contacts
        if (isManager) {
          const unassigned = clients.filter((c) => !c.assigned_to && !["lost", "inactive", "converted"].includes(c.status as string));
          if (unassigned.length > 0) focus.push({ id: "unassigned", type: "contact_unassigned", title: `${unassigned.length} contato${unassigned.length > 1 ? "s" : ""} sem responsável`, sub: "Atribua para iniciar o atendimento", priority: 4, color: "#60A5FA", link: "/contatos" });
        }

        // Pending docs
        if (docs.length > 0 && (role === "administrative" || isManager)) {
          focus.push({ id: "docs", type: "doc_pending", title: `${docs.length} documento${docs.length > 1 ? "s" : ""} pendente${docs.length > 1 ? "s" : ""}`, sub: "Revisar e aprovar", priority: 4, color: "#60A5FA", link: "/contatos" });
        }
        focus.sort((a, b) => a.priority - b.priority);

        // ── PULSE ──
        const pulse: PulseKPI[] = [];
        const activeNegs = negs.filter((n) => isNegotiationActive(n.status as string));
        const allMyNegs = isManager ? negs : negs.filter((n) => n.owner_profile_id === userId || n.broker_id === userId);
        const lostCount = allMyNegs.filter((n) => n.status === NegotiationStatus.LOST).length;
        const wonFromNegotiations = allMyNegs.filter((n) => n.status === NegotiationStatus.WON).length;
        const soldFromUnits = units.filter((u) => u.status === "sold").length;
        // Managers see the greater of WON negotiations vs sold units (covers pre-NEXA sales)
        const wonCount = isManager ? Math.max(wonFromNegotiations, soldFromUnits) : wonFromNegotiations;
        if (import.meta.env.DEV) console.log("[Central] negs:", negs.length, "active:", activeNegs.length, negs.map((n) => ({ s: n.status, d: (n.development_id as string)?.slice(0, 8) })));
        const myNegs = isManager ? activeNegs : activeNegs.filter((n) => n.owner_profile_id === userId || n.broker_id === userId);
        const soldUnits = units.filter((u) => u.status === "sold");
        const vgv = soldUnits.reduce((s, u) => { const v = Number(u.valor ?? 0); return s + (isNaN(v) ? 0 : v); }, 0);
        const reservedUnits = units.filter((u) => u.status === "reserved").length;

        // If sold units have no valor, try estimating from reserved units' average
        const effectiveVgv = vgv > 0 ? vgv : (() => {
          const reservedWithValue = units.filter((u) => u.status === "reserved" && Number(u.valor ?? 0) > 0);
          const avgPrice = reservedWithValue.length > 0 ? reservedWithValue.reduce((s, u) => s + Number(u.valor ?? 0), 0) / reservedWithValue.length : 0;
          if (soldUnits.length > 0 && avgPrice > 0) console.info("[Central] VGV estimado: units vendidas sem valor — usando ticket médio das reservadas");
          return soldUnits.length * avgPrice;
        })();
        const ticketMedio = soldUnits.length > 0 && effectiveVgv > 0 ? Math.round(effectiveVgv / soldUnits.length) : 0;
        const fmtV = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${v.toLocaleString("pt-BR")}`;

        if (isManager) {
          pulse.push({ key: "negs", label: "Negociações ativas", value: activeNegs.length });
          pulse.push({ key: "reservas", label: "Reservas", value: reservedUnits });
          pulse.push({ key: "vendas", label: "Vendas", value: soldUnits.length });
          const isVgvEstimated = vgv === 0 && effectiveVgv > 0;
          pulse.push({ key: "vgv", label: "VGV vendido (unidades)", value: effectiveVgv > 0 ? fmtV(effectiveVgv) : "—", color: "#4ADE80", sub: isVgvEstimated ? "estimado*" : undefined });
          pulse.push({ key: "ticket", label: "Ticket médio", value: ticketMedio > 0 ? fmtV(ticketMedio) : "—", sub: isVgvEstimated ? "estimado*" : undefined });
        } else {
          pulse.push({ key: "negs", label: "Minhas negociações", value: myNegs.length });
          const myClients = clients.filter((c) => c.assigned_to === userId && !["lost", "inactive"].includes(c.status as string));
          pulse.push({ key: "contatos", label: "Meus contatos", value: myClients.length });
          pulse.push({ key: "atividades", label: "Atividades semana", value: activities.filter((a) => a.profile_id === userId).length });
          const myFU = clients.filter((c) => c.assigned_to === userId && c.next_follow_up_at && toDateStringBRT(new Date(c.next_follow_up_at as string)) <= today);
          pulse.push({ key: "followups", label: "Follow-ups hoje", value: myFU.length, color: myFU.length > 0 ? "#FBBF24" : undefined });
        }

        // ── STOCK ── (fonte única: units.status)
        const stock: StockData = {
          available: units.filter((u) => u.status === "available").length,
          inNegotiation: units.filter((u) => u.status === "in_negotiation").length,
          reserved: units.filter((u) => u.status === "reserved").length,
          sold: units.filter((u) => u.status === "sold").length,
          total: units.length,
        };

        // ── NEGOTIATIONS ──
        const negotiationItems: NegotiationItem[] = myNegs.slice(0, 15).map((n) => {
          const cl = (Array.isArray(n.clients) ? n.clients[0] : n.clients) as Record<string, unknown> | null;
          const un = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null;
          const br = (Array.isArray(n.brokers) ? n.brokers[0] : n.brokers) as Record<string, unknown> | null;
          return { id: n.id as string, clientName: (cl?.name as string) ?? "—", unitLabel: un ? `Q${un.quadra}·L${un.lote}` : n.third_party_property_id ? "Imóvel terceiro" : "—", status: n.status as string, valor: Number(un?.valor ?? 0), brokerName: (br?.name as string) ?? null, isThirdParty: !!n.third_party_property_id, propertyName: n.third_party_property_id ? "Imóvel terceiro" : null };
        });
        const negotiationsTotal = myNegs.reduce((s, n) => { const un = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null; return s + Number(un?.valor ?? 0); }, 0);
        const negotiationsPreview = myNegs.length > 0 ? `${myNegs.length} em andamento${negotiationsTotal > 0 ? ` · ${negotiationsTotal >= 1e6 ? `R$ ${(negotiationsTotal / 1e6).toFixed(1)}M` : `R$ ${(negotiationsTotal / 1e3).toFixed(0)}k`} em pipeline` : ""}` : "Nenhuma negociação ativa";

        // ── AGENDA ──
        const todayActs = activities.filter((a) => (a.activity_date as string) === today);
        const myAgenda = isManager ? todayActs : todayActs.filter((a) => a.profile_id === userId);
        const agendaItems: AgendaItem[] = myAgenda.slice(0, 10).map((a) => {
          const cl = a.client_id ? clientMap.get(a.client_id as string) : null;
          const actor = a.profile_id ? profileMap.get(a.profile_id as string) : null;
          return { id: a.id as string, type: a.type as string, title: a.title as string, startTime: a.start_time as string | null, status: a.status as string, clientName: cl ? ((cl.full_name as string) || (cl.name as string) || null) : null, responsavelName: actor?.name?.split(" ")[0] ?? null, link: cl ? `/contatos/${cl.id}` : null };
        });
        const ACT_LABELS: Record<string, string> = { phone_call: "Ligação", follow_up: "Follow-up", visit_client: "Visita", visit_broker: "Visita", meeting_external: "Reunião", meeting_internal: "Reunião", training: "Treinamento", other: "Atividade" };
        const agendaPreview = myAgenda.length > 0 ? myAgenda.slice(0, 3).map((a) => {
          const time = (a.start_time as string)?.substring(0, 5) ?? "";
          const typeLabel = ACT_LABELS[a.type as string] ?? "";
          const cl = a.client_id ? clientMap.get(a.client_id as string) : null;
          const firstName = cl ? ((cl.full_name as string) || (cl.name as string) || "").split(" ")[0] : "";
          // Use title but strip type prefix to avoid "Visita Visita Imobiliária"
          let titleClean = (a.title as string) ?? "";
          const stripPrefixes = ["visita", "follow-up", "follow up", "reunião", "reuniao", "ligação", "ligacao", "treinamento", "email", "whatsapp"];
          for (const p of stripPrefixes) { if (titleClean.toLowerCase().startsWith(p)) { titleClean = titleClean.slice(p.length).trim(); break; } }
          const context = firstName || titleClean.split(" ").slice(0, 3).join(" ") || "";
          // If we have a title that IS the type (e.g. "Treinamento"), just show type + time
          return [time, typeLabel, context].filter(Boolean).join(" ");
        }).join(" · ") : "Sem compromissos hoje";

        // ── CONTACTS ──
        const sortedClients = [...clients].sort((a, b) => { const fa = a.next_follow_up_at as string | null; const fb = b.next_follow_up_at as string | null; if (fa && !fb) return -1; if (!fa && fb) return 1; if (fa && fb) return new Date(fa).getTime() - new Date(fb).getTime(); return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(); });
        const myContacts = isManager ? sortedClients : sortedClients.filter((c) => c.assigned_to === userId);
        const contactItems: ContactItem[] = myContacts.slice(0, 10).map((c) => ({ id: c.id as string, name: (c.full_name as string) || (c.name as string) || "—", phone: c.phone as string | null, temperature: c.temperature as string | null, status: c.status as string, origin: c.origin as string | null, assignedToName: c.assigned_to ? (profileMap.get(c.assigned_to as string)?.name ?? null) : null, nextFollowUpAt: c.next_follow_up_at as string | null, isOverdue: !!(c.next_follow_up_at && new Date(c.next_follow_up_at as string) < new Date()) }));
        const overdueFU = myContacts.filter((c) => c.next_follow_up_at && new Date(c.next_follow_up_at as string) < new Date()).length;
        const noResp = isManager ? clients.filter((c) => !c.assigned_to && !["lost", "inactive", "converted"].includes(c.status as string)).length : 0;
        const contactsPreview = [overdueFU > 0 ? `${overdueFU} follow-up atrasado${overdueFU > 1 ? "s" : ""}` : null, noResp > 0 ? `${noResp} sem responsável` : null].filter(Boolean).join(" · ") || "Todos em dia";

        // ── TEAM (manager+ only, split internal vs external, exclude self) ──
        const buildMemberStats = (t: Record<string, unknown>): TeamMemberData => {
          const p = (Array.isArray(t.profiles) ? t.profiles[0] : t.profiles) as Record<string, unknown>;
          const mid = t.user_id as string;
          const ROLE_LABELS: Record<string, string> = { owner: "Diretor", director: "Diretor", manager: "Gestor", commercial_consultant: "Consultora", broker: "Corretor" };
          return {
            id: mid, name: (p?.name as string) ?? "—", role: ROLE_LABELS[t.role as string] ?? (t.role as string), avatarUrl: (p?.avatar_url as string) ?? null,
            negotiations: negs.filter((n) => (n.owner_profile_id === mid || n.broker_id === mid) && isNegotiationActive(n.status as string)).length,
            activitiesWeek: activities.filter((a) => a.profile_id === mid).length,
            followupsOverdue: clients.filter((c) => c.assigned_to === mid && c.next_follow_up_at && new Date(c.next_follow_up_at as string) < new Date()).length,
          };
        };
        const sortByActivity = (a: TeamMemberData, b: TeamMemberData) => (b.activitiesWeek + b.negotiations * 5) - (a.activitiesWeek + a.negotiations * 5);
        const internalTeam: TeamMemberData[] = isManager ? teamRaw.filter((t) => INTERNAL_ROLES.includes(t.role as string) && t.user_id !== userId).map(buildMemberStats).sort(sortByActivity) : [];
        const externalTeam: TeamMemberData[] = isManager ? teamRaw.filter((t) => EXTERNAL_ROLES.includes(t.role as string)).map(buildMemberStats).sort(sortByActivity) : [];

        if (mounted) {
          setData({ focus, pulse, stock, negotiations: negotiationItems, negotiationsTotal, negotiationsPreview, lostCount, wonCount, agenda: agendaItems, agendaPreview, contacts: contactItems, contactsPreview, internalTeam, externalTeam });
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Erro ao carregar Central");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [accountId, developmentId, userId, role, refreshKey, isManager]);

  return { data, loading, error, refetch: useCallback(() => setRefreshKey((k) => k + 1), []), isManager };
}
