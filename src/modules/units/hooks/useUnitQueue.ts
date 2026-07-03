import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { createUnitQueueEntry, removeUnitQueueEntry, promoteUnitQueueEntry, updateUnitQueuePosition } from "../../../infra/repositories/unitQueueSupabaseRepository";

export interface QueueEntry {
  id: string;
  unit_id: string;
  position: number;
  status: string;
  requested_by: string;
  client_id: string | null;
  broker_id: string | null;
  negotiation_id: string | null;
  reason: string | null;
  created_at: string;
  profiles?: { name: string; role: string } | null;
  clients?: { name: string } | null;
  brokers?: { name: string } | null;
}

export function useUnitQueue(unitId: string | null, accountId: string | null, developmentId: string | null) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [myPosition, setMyPosition] = useState<number | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!unitId || !accountId || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("unit_queue_entries")
        .select("*, profiles:requested_by(name, role), clients(name), brokers(name)")
        .eq("unit_id", unitId)
        .eq("account_id", accountId)
        .eq("status", "waiting")
        .order("position", { ascending: true });
      if (error) { console.error("[QUEUE] Fetch error:", error); return; }
      setQueue((data ?? []) as QueueEntry[]);
    } finally { setLoading(false); }
  }, [unitId, accountId]);

  // Reset queue state immediately when unitId changes, before fetch completes
  useEffect(() => { setQueue([]); setMyPosition(null); fetchQueue(); }, [fetchQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkMyPosition = useCallback((userId: string) => {
    const entry = queue.find((q) => q.requested_by === userId);
    setMyPosition(entry ? entry.position : null);
  }, [queue]);

  const enterQueue = useCallback(async (params: { userId: string; clientId: string; brokerId?: string; negotiationId?: string; reason?: string }): Promise<{ position: number }> => {
    if (!unitId || !accountId || !developmentId || !supabase) throw new Error("Contexto inválido");
    // Check duplicate by client_id + unit_id
    const { data: existingByClient } = await supabase.from("unit_queue_entries").select("id").eq("unit_id", unitId).eq("client_id", params.clientId).eq("status", "waiting").limit(1);
    if (existingByClient && existingByClient.length > 0) throw new Error("Este cliente já está na fila desta unidade");
    // Check duplicate by requested_by
    const existingByUser = queue.find((q) => q.requested_by === params.userId);
    if (existingByUser) throw new Error("Você já está na fila desta unidade");
    const nextPosition = queue.length > 0 ? Math.max(...queue.map((q) => q.position)) + 1 : 1;
    // Escrita via repositório (Etapa 5c). O repo grava status "waiting" canônico.
    await createUnitQueueEntry({
      unitId, accountId, developmentId,
      requestedBy: params.userId, clientId: params.clientId,
      brokerId: params.brokerId || null, negotiationId: params.negotiationId || null,
      reason: params.reason || null, position: nextPosition,
    });
    await fetchQueue();
    return { position: nextPosition };
  }, [unitId, accountId, developmentId, queue, fetchQueue]);

  const getEstimatedPosition = useCallback(() => queue.length + 1, [queue]);

  const leaveQueue = useCallback(async (userId: string) => {
    if (!supabase) throw new Error("Supabase não configurado");
    const entry = queue.find((q) => q.requested_by === userId);
    if (!entry) throw new Error("Você não está na fila");
    await removeUnitQueueEntry(entry.id, "desistiu");
    const remaining = queue.filter((q) => q.id !== entry.id && q.position > entry.position);
    for (const q of remaining) {
      await updateUnitQueuePosition(q.id, q.position - 1);
    }
    await fetchQueue();
  }, [queue, fetchQueue]);

  const promoteFirst = useCallback(async () => {
    if (!supabase || queue.length === 0) return null;
    const first = queue[0];
    await promoteUnitQueueEntry(first.id);
    const remaining = queue.filter((q) => q.id !== first.id);
    for (let i = 0; i < remaining.length; i++) {
      await updateUnitQueuePosition(remaining[i].id, i + 1);
    }
    await fetchQueue();
    return first;
  }, [queue, fetchQueue]);

  const removeFromQueue = useCallback(async (entryId: string, reason: string) => {
    if (!supabase) throw new Error("Supabase não configurado");
    await removeUnitQueueEntry(entryId, reason);
    await fetchQueue();
  }, [fetchQueue]);

  return { queue, loading, myPosition, queueCount: queue.length, fetchQueue, checkMyPosition, enterQueue, leaveQueue, promoteFirst, removeFromQueue, getEstimatedPosition };
}

/** Fetch queue counts for all units in a development (for listing badges) */
export async function fetchQueueCounts(accountId: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data } = await supabase.from("unit_queue_entries").select("unit_id").eq("account_id", accountId).eq("status", "waiting");
  const counts: Record<string, number> = {};
  (data ?? []).forEach((q: { unit_id: string }) => { counts[q.unit_id] = (counts[q.unit_id] || 0) + 1; });
  return counts;
}

/** Fetch queue positions for a specific user across all units */
export async function fetchMyQueuePositions(userId: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data } = await supabase.from("unit_queue_entries").select("unit_id, position").eq("requested_by", userId).eq("status", "waiting");
  const map: Record<string, number> = {};
  (data ?? []).forEach((q: { unit_id: string; position: number }) => { map[q.unit_id] = q.position; });
  return map;
}

/** Single query for badge data: counts + user positions */
export interface QueueSummary { totalWaiting: number; myPosition: number | null }
export async function fetchQueueSummary(accountId: string, userId: string | null): Promise<Record<string, QueueSummary>> {
  if (!supabase) return {};
  const { data } = await supabase.from("unit_queue_entries").select("unit_id, position, requested_by").eq("account_id", accountId).eq("status", "waiting");
  const map: Record<string, QueueSummary> = {};
  (data ?? []).forEach((q: { unit_id: string; position: number; requested_by: string }) => {
    if (!map[q.unit_id]) map[q.unit_id] = { totalWaiting: 0, myPosition: null };
    map[q.unit_id].totalWaiting++;
    if (userId && q.requested_by === userId) map[q.unit_id].myPosition = q.position;
  });
  return map;
}
