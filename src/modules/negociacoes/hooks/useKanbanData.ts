import { useEffect, useState } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { RESERVATION_ACTIVE_DB } from "../../../domain/status/reservation";
import { PipelineSimulationStatus } from "../../../domain/status/pipelineSimulation";

export interface KanbanCard {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  clienteNome: string | null;
  clienteId: string | null;
  quadra: string | null;
  lote: string | null;
  valor: number | null;
  unitId: string | null;
  unitStatus: string | null;
  corretorNome: string | null;
  corretorId: string | null;
  propostaId: string | null;
  propostaStatus: string | null;
  reservaExpiresAt: string | null;
  reservaStatus: string | null;
  reservaRequestId: string | null;
  reservaRequestStatus: string | null;
  isSimulacao?: boolean;
  lostReason?: string | null;
  score?: number | null;
  stageChangedAt?: string | null;
  nextActionAt?: string | null;
  lastActivityAt?: string | null;
  followUpAt?: string | null;
  thirdPartyPropertyId?: string | null;
  thirdPartyPropertyTitulo?: string | null;
  thirdPartyPropertyTipo?: string | null;
}

export function useKanbanData(accountId: string | null, developmentId: string | null, refreshKey = 0, filters?: { brokerId?: string | null; ownerProfileId?: string | null }) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId || !developmentId || !supabase) { setLoading(false); return; }
    let mounted = true;
    setLoading(true); setError(null);
    // Recalcular scores on-demand, depois carregar dados
    supabase.rpc("recalculate_scores", { p_development_id: developmentId }).then(() => {}, () => {}).then(async () => {
    if (!mounted) return;

    let query = supabase!
      .from("negotiations")
      .select("id, status, created_at, updated_at, unit_id, client_id, broker_id, lost_reason, score, stage_changed_at, next_action_at, last_activity_at, follow_up_at, third_party_property_id, clients ( name ), units ( quadra, lote, valor, status ), brokers ( name ), proposals ( id, status, created_at ), reservations ( id, status, expires_at ), reservation_requests ( id, status ), third_party_property:third_party_properties ( id, titulo, tipo )")
      .eq("account_id", accountId).or(`development_id.eq.${developmentId},development_id.is.null`);
    if (filters?.brokerId) query = query.eq("broker_id", filters.brokerId);
    if (filters?.ownerProfileId) query = query.eq("owner_profile_id", filters.ownerProfileId);
    query
      .order("updated_at", { ascending: false })
      .then(async ({ data, error: qErr }) => {
        if (!mounted) return;
        if (qErr) { setError(qErr.message); setLoading(false); return; }
        const mapped: KanbanCard[] = (data ?? []).map((n: Record<string, unknown>) => {
          const client = Array.isArray(n.clients) ? n.clients[0] : n.clients;
          const unit = Array.isArray(n.units) ? n.units[0] : n.units;
          const broker = Array.isArray(n.brokers) ? n.brokers[0] : n.brokers;
          const propostas = Array.isArray(n.proposals) ? n.proposals as Record<string, unknown>[] : [];
          const ultimaProposta = propostas.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())[0] ?? null;
          const reservas = Array.isArray(n.reservations) ? n.reservations as Record<string, unknown>[] : [];
          const reservaAtiva = reservas.find((r) => r.status === RESERVATION_ACTIVE_DB) ?? reservas[0] ?? null;
          return {
            id: n.id as string,
            status: (n.status as string) ?? "",
            createdAt: n.created_at as string,
            updatedAt: n.updated_at as string,
            clienteNome: (client as Record<string, unknown>)?.name as string | null ?? null,
            clienteId: n.client_id as string | null,
            quadra: (unit as Record<string, unknown>)?.quadra as string | null ?? null,
            lote: (unit as Record<string, unknown>)?.lote as string | null ?? null,
            valor: (unit as Record<string, unknown>)?.valor as number | null ?? null,
            unitId: n.unit_id as string | null,
            unitStatus: (unit as Record<string, unknown>)?.status as string | null ?? null,
            corretorNome: (broker as Record<string, unknown>)?.name as string | null ?? null,
            corretorId: n.broker_id as string | null,
            propostaId: ultimaProposta?.id as string | null ?? null,
            propostaStatus: ultimaProposta?.status as string | null ?? null,
            reservaExpiresAt: reservaAtiva?.expires_at as string | null ?? null,
            reservaStatus: reservaAtiva?.status as string | null ?? null,
            reservaRequestId: ((Array.isArray(n.reservation_requests) ? (n.reservation_requests as Record<string, unknown>[])[0] : null) as Record<string, unknown> | null)?.id as string | null ?? null,
            reservaRequestStatus: ((Array.isArray(n.reservation_requests) ? (n.reservation_requests as Record<string, unknown>[])[0] : null) as Record<string, unknown> | null)?.status as string | null ?? null,
            lostReason: n.lost_reason as string | null ?? null,
            score: n.score as number | null ?? null,
            stageChangedAt: n.stage_changed_at as string | null ?? null,
            nextActionAt: n.next_action_at as string | null ?? null,
            lastActivityAt: n.last_activity_at as string | null ?? null,
            followUpAt: n.follow_up_at as string | null ?? null,
            thirdPartyPropertyId: n.third_party_property_id as string | null ?? null,
            thirdPartyPropertyTitulo: ((Array.isArray(n.third_party_property) ? n.third_party_property[0] : n.third_party_property) as Record<string, unknown> | null)?.titulo as string | null ?? null,
            thirdPartyPropertyTipo: ((Array.isArray(n.third_party_property) ? n.third_party_property[0] : n.third_party_property) as Record<string, unknown> | null)?.tipo as string | null ?? null,
          };
        });
        // Also fetch pipeline_simulations (filtered by profile)
        let simCards: KanbanCard[] = [];
        try {
          let simQuery = supabase!.from("pipeline_simulations").select("id, created_at, updated_at, unit_id, client_id, broker_id, created_by, valor_total, third_party_property_id, property_name, clients ( name ), units ( quadra, lote, valor, status ), brokers ( name )").eq("account_id", accountId).eq("status", PipelineSimulationStatus.ATIVA);
          if (developmentId) simQuery = simQuery.or(`development_id.eq.${developmentId},development_id.is.null`);
          if (filters?.brokerId) simQuery = simQuery.eq("broker_id", filters.brokerId);
          if (filters?.ownerProfileId) simQuery = simQuery.eq("created_by", filters.ownerProfileId);
          const { data: sims, error: simErr } = await simQuery;
          if (simErr) console.error("[KANBAN] Simulation query error:", simErr.message);
          simCards = (sims ?? []).map((s: Record<string, unknown>) => {
            const cl = Array.isArray(s.clients) ? s.clients[0] : s.clients;
            const un = Array.isArray(s.units) ? s.units[0] : s.units;
            const br = Array.isArray(s.brokers) ? s.brokers[0] : s.brokers;
            return { id: s.id as string, status: "SIMULATION", createdAt: s.created_at as string, updatedAt: (s.updated_at ?? s.created_at) as string, clienteNome: (cl as Record<string, unknown>)?.name as string | null ?? null, clienteId: s.client_id as string | null, quadra: (un as Record<string, unknown>)?.quadra as string | null ?? null, lote: (un as Record<string, unknown>)?.lote as string | null ?? null, valor: (s.valor_total as number) ?? (un as Record<string, unknown>)?.valor as number | null ?? null, unitId: s.unit_id as string | null, unitStatus: null, corretorNome: (br as Record<string, unknown>)?.name as string | null ?? null, corretorId: s.broker_id as string | null, propostaId: null, propostaStatus: null, reservaExpiresAt: null, reservaStatus: null, reservaRequestId: null, reservaRequestStatus: null, isSimulacao: true, thirdPartyPropertyId: s.third_party_property_id as string | null ?? null, thirdPartyPropertyTitulo: s.property_name as string | null ?? null };
          });
        } catch { /* simulation table might not exist yet */ }
        setCards([...mapped, ...simCards]); setLoading(false);
      });
    }); // end recalculate_scores .then()
    return () => { mounted = false; };
  }, [accountId, developmentId, refreshKey, filters?.brokerId, filters?.ownerProfileId]);

  return { cards, loading, error };
}
