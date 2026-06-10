import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BoardColumnRow,
  type UpdateColumnPatch,
  fetchColumns as repoFetchColumns,
  createColumn as repoCreateColumn,
  updateColumn as repoUpdateColumn,
  deleteColumn as repoDeleteColumn,
} from "../../../infra/repositories/boardColumnsSupabaseRepository";
import { moveCardsBetweenColumns as repoMoveCards } from "../../../infra/repositories/activitiesSupabaseRepository";

// Colunas padrão criadas só quando a conta ainda não tem nenhuma (bootstrap
// idempotente). Cores neutras/acento conforme design system NEXA.
const DEFAULT_COLUMNS = [
  { name: "A fazer", color: "#9A958B", position: 1000, completesActivity: false },
  { name: "Em andamento", color: "#E0A23C", position: 2000, completesActivity: false },
  { name: "Concluída", color: "#4ADE80", position: 3000, completesActivity: true },
];

export function useBoardColumns(opts: {
  accountId: string | null;
  developmentId?: string | null;
  canManage: boolean;
  enabled?: boolean;
}) {
  const { accountId, developmentId = null, canManage, enabled = true } = opts;
  const [columns, setColumns] = useState<BoardColumnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const bootstrappedFor = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled || !accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let cols = await repoFetchColumns(accountId);
      // Bootstrap idempotente: conta sem colunas → cria as 3 padrão (só se
      // o usuário tem permissão de escrita; senão fica vazio sem erro).
      if (cols.length === 0 && canManage && bootstrappedFor.current !== accountId) {
        bootstrappedFor.current = accountId;
        for (const def of DEFAULT_COLUMNS) {
          try {
            await repoCreateColumn({ accountId, developmentId, ...def });
          } catch (err) {
            console.warn("[useBoardColumns] bootstrap falhou:", err);
          }
        }
        cols = await repoFetchColumns(accountId);
      }
      setColumns(cols);
    } catch (err) {
      console.error("[useBoardColumns] fetch error", err);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, accountId, developmentId, canManage]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(
    async (name: string, color: string) => {
      if (!accountId) return;
      const maxPos = columns.reduce((m, c) => Math.max(m, c.position), 0);
      // Nova coluna entra antes da "conclui" (se houver) ou ao final.
      const completesPos = columns.find((c) => c.completes_activity)?.position;
      const position =
        completesPos !== undefined ? completesPos - 1 : maxPos + 1000;
      const row = await repoCreateColumn({
        accountId,
        developmentId,
        name,
        color,
        position,
        completesActivity: false,
      });
      setColumns((prev) => [...prev, row].sort((a, b) => a.position - b.position));
      return row;
    },
    [accountId, developmentId, columns],
  );

  // Otimista: aplica patch local, persiste, reverte se RLS bloquear (0 linhas).
  const update = useCallback(
    async (id: string, patch: UpdateColumnPatch): Promise<boolean> => {
      const prev = columns.find((c) => c.id === id);
      if (!prev) return false;
      setColumns((cs) =>
        cs
          .map((c) => (c.id === id ? { ...c, ...patch } : c))
          .sort((a, b) => a.position - b.position),
      );
      try {
        const rows = await repoUpdateColumn(id, patch);
        if (rows.length === 0) {
          setColumns((cs) =>
            cs.map((c) => (c.id === id ? prev : c)).sort((a, b) => a.position - b.position),
          );
          return false;
        }
        return true;
      } catch (err) {
        console.error("[useBoardColumns] update error", err);
        setColumns((cs) =>
          cs.map((c) => (c.id === id ? prev : c)).sort((a, b) => a.position - b.position),
        );
        return false;
      }
    },
    [columns],
  );

  // Exclui coluna; opcionalmente reatribui cards p/ outra coluna antes
  // (ou deixa cair em column_id NULL via ON DELETE SET NULL). Nunca apaga cards.
  const remove = useCallback(
    async (id: string, moveCardsTo: string | null) => {
      if (moveCardsTo) {
        try {
          await repoMoveCards(id, moveCardsTo);
        } catch (err) {
          console.error("[useBoardColumns] move cards error", err);
        }
      }
      await repoDeleteColumn(id);
      setColumns((prev) => prev.filter((c) => c.id !== id));
    },
    [],
  );

  return { columns, loading, refetch, create, update, remove, setColumns };
}
