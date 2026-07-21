// Hook da timeline da Ficha. Carrega quando há unitId; expõe estados de
// loading/vazio/erro (consumidos pela UI no padrão VizFrame) + refetch.
import { useCallback, useEffect, useState } from "react";
import { getUnitTimeline, type UnitTimelineEvent } from "../../../infra/repositories/unitTimelineSupabaseRepository";

export function useUnitTimeline(unitId: string | null) {
  const [events, setEvents] = useState<UnitTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!unitId) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setEvents(await getUnitTimeline(unitId));
    } catch (e) {
      setEvents([]);
      setErrorMessage(e instanceof Error ? e.message : "Falha ao carregar histórico.");
    } finally {
      setIsLoading(false);
    }
  }, [unitId]);

  useEffect(() => { void load(); }, [load]);

  return { events, isLoading, errorMessage, refetch: load };
}
