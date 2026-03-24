import { useEffect, useState } from "react";
import type { UnitHistoryEvent } from "../../../shared/types/unitHistory";
import { getUnitHistoryByUnitIds as getMockUnitHistoryByUnitIds } from "../repositories/unitHistoryRepository";
import { getUnitHistoryByUnitIds as getSupabaseUnitHistoryByUnitIds } from "../../../infra/repositories/unitHistorySupabaseRepository";

type UnitHistoryStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useUnitHistory(
  unitIds: string[],
  useMockFallback: boolean,
) {
  const unitIdsKey = unitIds.join("|");
  const [historyEvents, setHistoryEvents] = useState<UnitHistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<UnitHistoryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (unitIds.length === 0) {
          if (!isMounted) {
            return;
          }

          setHistoryEvents([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockHistory = getMockUnitHistoryByUnitIds(unitIds);

          if (!isMounted) {
            return;
          }

          setHistoryEvents(mockHistory);
          setStatus(mockHistory.length > 0 ? "mock" : "empty");
          return;
        }

        const realHistory = await getSupabaseUnitHistoryByUnitIds(unitIds);

        if (!isMounted) {
          return;
        }

        setHistoryEvents(realHistory);
        setStatus(realHistory.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setHistoryEvents([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar historico das unidades.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [unitIdsKey, useMockFallback]);

  return {
    historyEvents,
    isLoading,
    isUsingMock: status === "mock",
    status,
    errorMessage,
  };
}
