// Fase B do Funil — FONTE ÚNICA de dados do módulo Negociações. As 3 visões
// (Funil, Kanban, Lista) consomem SÓ este hook. Nenhuma visão deriva estágio nem
// soma por conta própria — tudo vem de buildBoard sobre a mesma query
// (useKanbanData), garantindo números idênticos por construção.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useKanbanData, type KanbanCard } from "./useKanbanData";
import { buildBoard, type BoardModel } from "../board/buildBoard";
import { countActiveLeads } from "../../../infra/repositories/clientsSupabaseRepository";

export type BoardFilters = { brokerId?: string | null; ownerProfileId?: string | null } | undefined;

function matchesSearch(c: KanbanCard, q: string): boolean {
  if (!q) return true;
  const t = q.toLowerCase();
  return (
    (c.clienteNome?.toLowerCase().includes(t) ?? false) ||
    (c.quadra?.toLowerCase().includes(t) ?? false) ||
    (c.lote?.toLowerCase().includes(t) ?? false) ||
    (c.corretorNome?.toLowerCase().includes(t) ?? false) ||
    (c.thirdPartyPropertyTitulo?.toLowerCase().includes(t) ?? false) ||
    c.id.includes(t)
  );
}

export function useNegotiationsBoard(opts: {
  accountId: string | null;
  developmentId: string | null;
  refreshKey?: number;
  filters?: BoardFilters;
  search?: string;
  /** Restringe a estes corretores (modo "equipe" do broker manager). */
  teamBrokerIds?: string[] | null;
}): { board: BoardModel; loading: boolean; error: string | null; thresholdDays: number } {
  const { accountId, developmentId, refreshKey = 0, filters, search = "", teamBrokerIds } = opts;
  const { cards, loading, error } = useKanbanData(accountId, developmentId, refreshKey, filters);

  // Limite de "parada" (dias sem atividade) — mesma fonte do Kanban atual.
  const [thresholdDays, setThresholdDays] = useState(7);
  useEffect(() => {
    if (!supabase || !accountId) return;
    supabase
      .from("cadence_settings")
      .select("negotiation_idle_hours")
      .eq("account_id", accountId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.negotiation_idle_hours) {
          setThresholdDays(Math.max(1, Math.round(Number(data.negotiation_idle_hours) / 24)));
        }
      });
  }, [accountId]);

  // Pré-funil: contagem de leads ativos da conta (fonte compartilhada — mesmo número
  // no Kanban e no Funil). Escopo de conta (a tela Leads aplica o escopo por papel).
  const [leadsActive, setLeadsActive] = useState(0);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    countActiveLeads(accountId).then((n) => { if (active) setLeadsActive(n); }).catch(() => { if (active) setLeadsActive(0); });
    return () => { active = false; };
  }, [accountId, refreshKey]);

  const filtered = useMemo(() => {
    let cs = cards;
    if (teamBrokerIds && teamBrokerIds.length > 0) {
      cs = cs.filter((c) => c.corretorId && teamBrokerIds.includes(c.corretorId));
    }
    if (search) cs = cs.filter((c) => matchesSearch(c, search));
    return cs;
  }, [cards, search, teamBrokerIds]);

  const board = useMemo(() => buildBoard(filtered, Date.now(), leadsActive), [filtered, leadsActive]);

  return { board, loading, error, thresholdDays };
}
