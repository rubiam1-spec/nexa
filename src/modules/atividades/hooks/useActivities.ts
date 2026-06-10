import { useCallback, useEffect, useRef, useState } from "react";
import {
  type FetchActivitiesOptions,
  completeActivity as repoComplete,
  deleteActivity as repoDelete,
  fetchActivities as repoFetch,
  insertActivity as repoInsert,
  skipActivity as repoSkip,
  updateActivity as repoUpdate,
  updateStatus as repoUpdateStatus,
  updateSchedule as repoUpdateSchedule,
  updateCardColumn as repoUpdateCardColumn,
  setArchived as repoSetArchived,
} from "../../../infra/repositories/activitiesSupabaseRepository";

type UseActivitiesOptions = FetchActivitiesOptions & {
  enabled?: boolean;
};

export function useActivities<TActivity>(opts: UseActivitiesOptions) {
  const { enabled = true, ...fetchOpts } = opts;
  const [activities, setActivities] = useState<TActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Snapshot estável das deps usadas pelo refetch — evita re-render em loop.
  const optsRef = useRef(fetchOpts);
  optsRef.current = fetchOpts;

  const refetch = useCallback(async () => {
    if (!enabled || !optsRef.current.accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await repoFetch<TActivity>(optsRef.current);
      setActivities(data);
    } catch (err) {
      console.error("[useActivities] fetch error", err);
      setActivities([]);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [
    refetch,
    fetchOpts.accountId,
    fetchOpts.profileId,
    fetchOpts.viewMode,
    fetchOpts.consultantFilter,
    fetchOpts.isConsultant,
    fetchOpts.isManager,
    fetchOpts.includeArchived,
  ]);

  const create = useCallback(
    async (payload: Record<string, unknown>) => {
      const inserted = await repoInsert(payload);
      await refetch();
      return inserted;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await repoUpdate(id, patch);
      await refetch();
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      await repoDelete(id);
      await refetch();
    },
    [refetch],
  );

  const complete = useCallback(
    async (id: string, body: { outcome: string | null; duration_minutes: number; outcome_category?: string | null }) => {
      await repoComplete(id, body);
      await refetch();
    },
    [refetch],
  );

  const skip = useCallback(
    async (id: string, body: { skip_reason: string }) => {
      await repoSkip(id, body);
      await refetch();
    },
    [refetch],
  );

  // Otimista: NÃO faz refetch. Retorna true se RLS permitiu (linhas>0).
  // Caller deve atualizar UI antes e reverter se retorno=false.
  const setStatus = useCallback(
    async (id: string, status: string): Promise<boolean> => {
      try {
        const rows = await repoUpdateStatus(id, status);
        return rows.length > 0;
      } catch (err) {
        console.error("[useActivities] setStatus error", err);
        return false;
      }
    },
    [],
  );

  // Otimista (reordenação híbrida): reescreve activity_date/start_time sem
  // refetch. Retorna true se RLS permitiu (linhas>0). Caller reverte se false.
  const updateSchedule = useCallback(
    async (
      id: string,
      schedule: { activity_date: string; start_time: string | null },
    ): Promise<boolean> => {
      try {
        const rows = await repoUpdateSchedule(id, schedule);
        return rows.length > 0;
      } catch (err) {
        console.error("[useActivities] updateSchedule error", err);
        return false;
      }
    },
    [],
  );

  // Arquivar/desarquivar (só archived_at). Retorna true se RLS permitiu.
  const setArchived = useCallback(
    async (id: string, archived: boolean): Promise<boolean> => {
      try {
        const rows = await repoSetArchived(id, archived);
        return rows.length > 0;
      } catch (err) {
        console.error("[useActivities] setArchived error", err);
        return false;
      }
    },
    [],
  );

  // Otimista (colunas livres): muda apenas column_id, sem tocar em status.
  // Retorna true se RLS permitiu (linhas>0). Caller reverte se false.
  const updateCardColumn = useCallback(
    async (id: string, columnId: string | null): Promise<boolean> => {
      try {
        const rows = await repoUpdateCardColumn(id, columnId);
        return rows.length > 0;
      } catch (err) {
        console.error("[useActivities] updateCardColumn error", err);
        return false;
      }
    },
    [],
  );

  // Acesso direto para mutações otimistas (ex.: drag-and-drop) sem refetch.
  const patchLocal = useCallback(
    (id: string, patch: Partial<TActivity>) => {
      setActivities((prev) =>
        prev.map((a) => {
          const anyA = a as unknown as { id: string };
          return anyA.id === id ? { ...a, ...patch } : a;
        }),
      );
    },
    [],
  );

  return {
    activities,
    loading,
    error,
    refetch,
    create,
    update,
    remove,
    complete,
    skip,
    setStatus,
    updateSchedule,
    updateCardColumn,
    setArchived,
    patchLocal,
    setActivities,
  };
}
