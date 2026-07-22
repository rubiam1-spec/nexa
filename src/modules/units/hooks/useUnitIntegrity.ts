// Hook de aplicação: saúde do dado do empreendimento ativo. Busca os contadores
// (check_unit_integrity), deriva os cards (domínio puro) e expõe refetch — a
// página invalida após alteração de status/venda (mesma convenção do refetchUnits).
import { useCallback, useEffect, useMemo, useState } from "react";
import { getUnitIntegrity, type UnitIntegrityCounters } from "../../../infra/repositories/unitIntegritySupabaseRepository";
import { buildIntegrityCards, isDataConsistent } from "../../../domain/unidade/unitIntegrityIssues";

export function useUnitIntegrity(developmentId: string | null, useMock: boolean) {
  const [counters, setCounters] = useState<UnitIntegrityCounters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!developmentId || useMock) { setCounters(null); return; }
    let alive = true;
    setIsLoading(true);
    setErrorMessage(null);
    getUnitIntegrity(developmentId)
      .then((c) => { if (alive) setCounters(c); })
      .catch((e) => { if (alive) setErrorMessage(e instanceof Error ? e.message : "Falha ao carregar saúde do dado."); })
      .finally(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [developmentId, useMock, nonce]);

  const cards = useMemo(() => buildIntegrityCards(counters), [counters]);
  const consistent = useMemo(() => isDataConsistent(counters), [counters]);

  return { counters, cards, consistent, isLoading, errorMessage, refetch };
}
