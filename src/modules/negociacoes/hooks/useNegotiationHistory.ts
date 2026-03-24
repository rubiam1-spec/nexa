import { useEffect, useState } from "react";
import {
  getNegotiationHistory as getSupabaseNegotiationHistory,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import { getNegotiationHistory as getMockNegotiationHistory } from "../repositories/negotiationHistoryRepository";

type NegotiationHistoryStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

export function useNegotiationHistory(
  negotiationId: string | undefined,
  useMockFallback: boolean,
) {
  const [events, setEvents] = useState<NegotiationHistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<NegotiationHistoryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!negotiationId) {
          if (!isMounted) {
            return;
          }

          setEvents([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockEvents = getMockNegotiationHistory(negotiationId);

          if (!isMounted) {
            return;
          }

          setEvents(mockEvents);
          setStatus(mockEvents.length > 0 ? "mock" : "empty");
          return;
        }

        const realEvents = await getSupabaseNegotiationHistory(negotiationId);

        if (!isMounted) {
          return;
        }

        setEvents(realEvents);
        setStatus(realEvents.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setEvents([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar historico da negociacao.",
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
  }, [negotiationId, useMockFallback]);

  return {
    events,
    isLoading,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    prependEvent: (event: NegotiationHistoryEvent) =>
      setEvents((current) => [
        event,
        ...current.filter((currentEvent) => currentEvent.id !== event.id),
      ]),
  };
}
