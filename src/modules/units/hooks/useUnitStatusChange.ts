// Hook de aplicação: orquestra a chamada ao RPC (via repositório), loading,
// resultado ({updated, blocked}) e invalidação dos consumidores. Regra/tradução
// vivem no serviço (bulkStatusReason); aqui só orquestração de estado.
import { useCallback, useState } from "react";
import {
  updateStatusBulk,
  type BulkStatusResult,
} from "../../../infra/repositories/unitsSupabaseRepository";
import { bulkStatusErrorLabel } from "../../../domain/unidade/bulkStatusReason";
import type { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";

export function useUnitStatusChange(onChanged?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkStatusResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (unitIds: string[], status: UnidadeStatus, reason: string): Promise<BulkStatusResult | null> => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setResult(null);
      try {
        const r = await updateStatusBulk(unitIds, status, reason);
        setResult(r);
        // Invalida os consumidores quando algo mudou (sucesso total OU parcial).
        if (r.updated > 0) onChanged?.();
        return r;
      } catch (e) {
        setErrorMessage(bulkStatusErrorLabel(e instanceof Error ? e.message : ""));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onChanged],
  );

  const reset = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
  }, []);

  return { submit, isSubmitting, result, errorMessage, reset };
}
