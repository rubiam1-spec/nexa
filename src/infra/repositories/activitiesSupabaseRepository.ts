import { getSupabaseClientOrThrow } from "./baseRepository";

// SELECT exato usado em /atividades — preserve joins e nomes para não
// quebrar o shape consumido pela UI (Activity em AtividadesPage.tsx).
export const ACTIVITIES_SELECT =
  "*, clients(name, temperature), brokers(name), negotiations!activities_negotiation_id_fkey(temperature), profiles!activities_profile_id_fkey(name, role), activity_kinds(id, label, icon, color, base_type), activity_photos(id, photo_url), activity_participants(participant_name, participant_type, participant_id), activity_checklist_items(id, text, done, position), third_party_property:third_party_properties!third_party_property_id(id, titulo)";

export type FetchActivitiesOptions = {
  accountId: string;
  profileId: string | null;
  viewMode: "mine" | "team";
  consultantFilter: string;
  isConsultant: boolean;
  isManager: boolean;
  includeArchived?: boolean; // default: oculta arquivadas (archived_at IS NULL)
  archivedOnly?: boolean; // só arquivadas (destino "Arquivados")
};

export async function fetchActivities<T = unknown>(
  opts: FetchActivitiesOptions,
): Promise<T[]> {
  const client = getSupabaseClientOrThrow("activitiesRepository.fetchActivities");
  let query = client
    .from("activities")
    .select(ACTIVITIES_SELECT)
    .eq("account_id", opts.accountId)
    .order("activity_date", { ascending: false })
    .order("start_time", { ascending: false });

  // archived_at é só VISIBILIDADE — não toca em status. Oculto por padrão.
  if (opts.archivedOnly) query = query.not("archived_at", "is", null);
  else if (!opts.includeArchived) query = query.is("archived_at", null);

  if (opts.isConsultant && opts.profileId) {
    query = query.eq("profile_id", opts.profileId);
  }
  if (opts.isManager && opts.viewMode === "mine" && opts.profileId) {
    query = query.eq("profile_id", opts.profileId);
  }
  if (
    opts.isManager &&
    opts.viewMode === "team" &&
    opts.consultantFilter !== "all"
  ) {
    query = query.eq("profile_id", opts.consultantFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function insertActivity<T = unknown>(
  payload: Record<string, unknown>,
): Promise<{ id: string } | null> {
  const client = getSupabaseClientOrThrow("activitiesRepository.insertActivity");
  const { data, error } = await client
    .from("activities")
    .insert(payload as T)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string } | null) ?? null;
}

export async function updateActivity(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.updateActivity");
  const { error } = await client
    .from("activities")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.deleteActivity");
  const { error } = await client.from("activities").delete().eq("id", id);
  if (error) throw error;
}

export async function completeActivity(
  id: string,
  body: { outcome: string | null; duration_minutes: number; outcome_category?: string | null },
): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.completeActivity");
  const { error } = await client
    .from("activities")
    .update({
      status: "completed",
      duration_minutes: body.duration_minutes,
      outcome: body.outcome,
      outcome_category: body.outcome_category ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function skipActivity(
  id: string,
  body: { skip_reason: string },
): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.skipActivity");
  const { error } = await client
    .from("activities")
    .update({
      status: "skipped",
      skip_reason: body.skip_reason,
      column_id: null, // terminal: sai do quadro
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// Lookups auxiliares (só leitura) usados pela página /atividades para
// saneamento de listas — sem domínio próprio, mas isolados aqui para
// que a UI não toque mais em supabase.from('activities') diretamente.

export async function countActivitiesByProfile(opts: {
  accountId: string;
  profileIds: string[];
}): Promise<Map<string, number>> {
  if (opts.profileIds.length === 0) return new Map();
  const client = getSupabaseClientOrThrow("activitiesRepository.countActivitiesByProfile");
  const { data, error } = await client
    .from("activities")
    .select("profile_id")
    .eq("account_id", opts.accountId)
    .in("profile_id", opts.profileIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { profile_id: string }[]) {
    counts.set(row.profile_id, (counts.get(row.profile_id) ?? 0) + 1);
  }
  return counts;
}

export async function fetchRecentActivityClientIds(opts: {
  accountId: string;
  sinceDate: string;
}): Promise<string[]> {
  const client = getSupabaseClientOrThrow("activitiesRepository.fetchRecentActivityClientIds");
  const { data, error } = await client
    .from("activities")
    .select("client_id")
    .eq("account_id", opts.accountId)
    .gte("activity_date", opts.sinceDate);
  if (error) throw error;
  return ((data ?? []) as { client_id: string | null }[])
    .map((r) => r.client_id)
    .filter((id): id is string => Boolean(id));
}

// updateStatus: usado para drag-and-drop do Quadro. Retorna o array de
// linhas afetadas — caller usa .length p/ detectar bloqueio de RLS sem
// erro lançado (RLS de UPDATE retorna 0 linhas em vez de exception).
export async function updateStatus<T = { id: string }>(
  id: string,
  status: string,
): Promise<T[]> {
  const client = getSupabaseClientOrThrow("activitiesRepository.updateStatus");
  const { data, error } = await client
    .from("activities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw error;
  return (data ?? []) as T[];
}

// updateCardColumn: arrastar card entre colunas livres muda só column_id
// (NÃO mexe em status — a verdade comercial é independente da organização).
// Retorna linhas afetadas p/ rollback otimista quando a RLS bloqueia.
export async function updateCardColumn<T = { id: string }>(
  id: string,
  columnId: string | null,
): Promise<T[]> {
  const client = getSupabaseClientOrThrow("activitiesRepository.updateCardColumn");
  const { data, error } = await client
    .from("activities")
    .update({ column_id: columnId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw error;
  return (data ?? []) as T[];
}

// Participantes da equipe (participant_type='user') num card — add/remove.
export async function addActivityParticipant(
  activityId: string,
  p: { participant_id: string; participant_name: string; participant_type?: string },
): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.addActivityParticipant");
  const { error } = await client.from("activity_participants").insert({
    activity_id: activityId,
    participant_type: p.participant_type ?? "user",
    participant_id: p.participant_id,
    participant_name: p.participant_name,
  });
  if (error) throw error;
}

export async function removeActivityParticipant(
  activityId: string,
  participantId: string,
): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.removeActivityParticipant");
  const { error } = await client
    .from("activity_participants")
    .delete()
    .eq("activity_id", activityId)
    .eq("participant_id", participantId);
  if (error) throw error;
}

// setArchived: arquiva/desarquiva (archived_at = now()/null). É só VISIBILIDADE
// — NÃO altera status. Retorna linhas afetadas p/ rollback otimista (RLS).
export async function setArchived<T = { id: string }>(
  id: string,
  archived: boolean,
): Promise<T[]> {
  const client = getSupabaseClientOrThrow("activitiesRepository.setArchived");
  const { data, error } = await client
    .from("activities")
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw error;
  return (data ?? []) as T[];
}

// moveCardsBetweenColumns: ao excluir uma coluna com cards, reatribui em
// massa para a coluna escolhida (ou null = sai do quadro). Nunca apaga cards.
export async function moveCardsBetweenColumns(
  fromColumnId: string,
  toColumnId: string | null,
): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.moveCardsBetweenColumns");
  const { error } = await client
    .from("activities")
    .update({ column_id: toColumnId, updated_at: new Date().toISOString() })
    .eq("column_id", fromColumnId);
  if (error) throw error;
}

// logActivityEvent: trilha de eventos imutável em activity_logs (sem tabela
// nova). Observabilidade — fire-and-forget: nunca bloqueia a ação principal
// nem faz rollback; se falhar, só console.warn.
export async function logActivityEvent(opts: {
  accountId: string;
  activityId: string;
  action: string;
  actorProfileId: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const client = getSupabaseClientOrThrow("activitiesRepository.logActivityEvent");
    const { error } = await client.from("activity_logs").insert({
      account_id: opts.accountId,
      entity: "activity",
      entity_id: opts.activityId,
      action: opts.action,
      actor_profile_id: opts.actorProfileId,
      details: opts.details ?? {},
    });
    if (error) console.warn("[logActivityEvent] insert falhou (ignorado):", error.message);
  } catch (err) {
    console.warn("[logActivityEvent] erro (ignorado):", err);
  }
}

// updateSchedule: reordenação híbrida do Quadro (arrastar reescreve horário).
// Mesma semântica de updateStatus — retorna linhas afetadas p/ rollback
// otimista quando a RLS bloqueia (0 linhas, sem exception).
export async function updateSchedule<T = { id: string }>(
  id: string,
  schedule: { activity_date: string; start_time: string | null },
): Promise<T[]> {
  const client = getSupabaseClientOrThrow("activitiesRepository.updateSchedule");
  const { data, error } = await client
    .from("activities")
    .update({
      activity_date: schedule.activity_date,
      start_time: schedule.start_time,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select();
  if (error) throw error;
  return (data ?? []) as T[];
}

// ── Criação inteligente: auto-vínculo + templates + checklist ──

export type ActiveNegotiation = {
  id: string;
  unit_id: string | null;
  client_id: string | null;
  broker_id: string | null;
  quadra: string | null;
  lote: string | null;
  clientName: string | null;
};

// Negociações ATIVAS (OPEN/IN_PROGRESS) ligadas ao cliente OU corretor
// selecionado — base do auto-vínculo do card ao funil. Só dados reais.
export async function findActiveNegotiations(opts: {
  accountId: string;
  clientId?: string | null;
  brokerId?: string | null;
}): Promise<ActiveNegotiation[]> {
  if (!opts.clientId && !opts.brokerId) return [];
  const client = getSupabaseClientOrThrow("activitiesRepository.findActiveNegotiations");
  let query = client
    .from("negotiations")
    .select("id, unit_id, client_id, broker_id, status, units(quadra, lote), clients(name)")
    .eq("account_id", opts.accountId)
    .in("status", ["OPEN", "IN_PROGRESS"]);
  if (opts.clientId && opts.brokerId) {
    query = query.or(`client_id.eq.${opts.clientId},broker_id.eq.${opts.brokerId}`);
  } else if (opts.clientId) {
    query = query.eq("client_id", opts.clientId);
  } else if (opts.brokerId) {
    query = query.eq("broker_id", opts.brokerId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((n) => {
    const u = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null;
    const c = (Array.isArray(n.clients) ? n.clients[0] : n.clients) as Record<string, unknown> | null;
    return {
      id: n.id as string,
      unit_id: (n.unit_id as string) ?? null,
      client_id: (n.client_id as string) ?? null,
      broker_id: (n.broker_id as string) ?? null,
      quadra: (u?.quadra as string) ?? null,
      lote: (u?.lote as string) ?? null,
      clientName: (c?.name as string) ?? null,
    };
  });
}

export type ActivityTemplate = { suggested_duration_minutes: number | null; checklist: string[] };

// Templates por tipo (duração + checklist sugeridos). Semeados na tabela —
// não hardcode. Carregar uma vez por conta.
export async function fetchTemplates(accountId: string): Promise<Record<string, ActivityTemplate>> {
  const client = getSupabaseClientOrThrow("activitiesRepository.fetchTemplates");
  const { data, error } = await client
    .from("activity_templates")
    .select("type, suggested_duration_minutes, checklist")
    .eq("account_id", accountId);
  if (error) throw error;
  const map: Record<string, ActivityTemplate> = {};
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const rawList = row.checklist;
    const checklist = Array.isArray(rawList) ? (rawList as unknown[]).map((x) => String(x)) : [];
    map[row.type as string] = {
      suggested_duration_minutes: (row.suggested_duration_minutes as number) ?? null,
      checklist,
    };
  }
  return map;
}

export type ChecklistItem = { id: string; text: string; done: boolean; position: number };

// applyChecklist: bulk insert dos itens de checklist na criação (position
// incremental). Itens vazios são ignorados.
export async function applyChecklist(activityId: string, items: string[]): Promise<void> {
  const clean = items.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return;
  const client = getSupabaseClientOrThrow("activitiesRepository.applyChecklist");
  const rows = clean.map((text, i) => ({ activity_id: activityId, text, done: false, position: (i + 1) * 1000 }));
  const { error } = await client.from("activity_checklist_items").insert(rows);
  if (error) throw error;
}

export async function addChecklistItem(activityId: string, text: string, position: number): Promise<ChecklistItem> {
  const client = getSupabaseClientOrThrow("activitiesRepository.addChecklistItem");
  const { data, error } = await client
    .from("activity_checklist_items")
    .insert({ activity_id: activityId, text: text.trim(), done: false, position })
    .select("id, text, done, position")
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

export async function toggleChecklistItem(id: string, done: boolean): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.toggleChecklistItem");
  const { error } = await client.from("activity_checklist_items").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function removeChecklistItem(id: string): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.removeChecklistItem");
  const { error } = await client.from("activity_checklist_items").delete().eq("id", id);
  if (error) throw error;
}

export async function updateChecklistText(id: string, text: string): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.updateChecklistText");
  const { error } = await client.from("activity_checklist_items").update({ text: text.trim() }).eq("id", id);
  if (error) throw error;
}

export async function reorderChecklistItem(id: string, position: number): Promise<void> {
  const client = getSupabaseClientOrThrow("activitiesRepository.reorderChecklistItem");
  const { error } = await client.from("activity_checklist_items").update({ position }).eq("id", id);
  if (error) throw error;
}
