// Hook de aplicação: orquestra o RPC register_historical_sale (via repositório),
// loading, resultado ({saleId, unitStatus}) e invalidação dos consumidores.
// Tradução de erro vive no serviço (historicalSaleReason); aqui só estado.
import { useCallback, useState } from "react";
import {
  registerHistoricalSale,
  type RegisterSaleResult,
} from "../../../infra/repositories/unitsSupabaseRepository";
import { historicalSaleErrorLabel } from "../../../domain/unidade/historicalSaleReason";

export function useRegisterSale(onDone?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (
      unitId: string,
      clientId: string,
      amount: number,
      saleDate: string | null,
    ): Promise<RegisterSaleResult | null> => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const r = await registerHistoricalSale(unitId, clientId, amount, saleDate);
        onDone?.();
        return r;
      } catch (e) {
        setErrorMessage(historicalSaleErrorLabel(e instanceof Error ? e.message : ""));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onDone],
  );

  const reset = useCallback(() => setErrorMessage(null), []);

  return { submit, isSubmitting, errorMessage, reset };
}
