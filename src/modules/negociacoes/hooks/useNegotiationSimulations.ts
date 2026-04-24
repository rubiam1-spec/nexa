// NEXA — Engrenagem Comercial v1 — Fase 2
// Hook: dado um negotiationId, carrega as simulações de pipeline vinculadas.
// Padrão alinhado com useNegotiations (useState + useEffect + isMounted).

import { useCallback, useEffect, useState } from "react";
import type { PipelineSimulation } from "../../../shared/types/simulation";
import { listSimulationsByNegotiation } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";

export interface UseNegotiationSimulationsResult {
  simulations: PipelineSimulation[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

export function useNegotiationSimulations(
  negotiationId: string | null,
): UseNegotiationSimulationsResult {
  const [simulations, setSimulations] = useState<PipelineSimulation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!negotiationId) {
      setSimulations([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listSimulationsByNegotiation(negotiationId);
      setSimulations(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar simulações vinculadas à negociação.",
      );
      setSimulations([]);
    } finally {
      setIsLoading(false);
    }
  }, [negotiationId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (!isMounted) return;
      await load();
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

  return { simulations, isLoading, errorMessage, refresh: load };
}
