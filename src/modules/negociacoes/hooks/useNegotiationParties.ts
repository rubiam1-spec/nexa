// NEXA — Engrenagem de Partes v1 — Fase 2
// Lista as partes vinculadas a uma negociação. Padrão useState + useEffect
// + isMounted, alinhado com useNegotiationSimulations.

import { useCallback, useEffect, useState } from "react";
import type { NegotiationPartyWithClient } from "../../../shared/types/negotiationParty";
import { listPartiesByNegotiation } from "../../../infra/repositories/negotiationPartiesSupabaseRepository";

export interface UseNegotiationPartiesResult {
  parties: NegotiationPartyWithClient[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

export function useNegotiationParties(
  negotiationId: string | null,
): UseNegotiationPartiesResult {
  const [parties, setParties] = useState<NegotiationPartyWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!negotiationId) {
      setParties([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listPartiesByNegotiation(negotiationId);
      setParties(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar partes da negociação.",
      );
      setParties([]);
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

  return { parties, isLoading, errorMessage, refresh: load };
}
