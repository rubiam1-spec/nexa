import { useEffect, useState } from "react";
import { getBrokers as getMockBrokers } from "../repositories/brokersRepository";
import { getBrokers as getSupabaseBrokers } from "../../../infra/repositories/brokersSupabaseRepository";
import type { Broker } from "../../../shared/types/broker";

type BrokersStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useBrokers(accountId: string | null, useMockFallback: boolean) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<BrokersStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBrokers() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId) {
          if (!isMounted) {
            return;
          }

          setBrokers([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockBrokers = getMockBrokers();

          if (!isMounted) {
            return;
          }

          setBrokers(mockBrokers);
          setStatus(mockBrokers.length > 0 ? "mock" : "empty");
          return;
        }

        const realBrokers = await getSupabaseBrokers(accountId);

        if (!isMounted) {
          return;
        }

        setBrokers(realBrokers);
        setStatus(realBrokers.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBrokers([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar corretores da conta ativa.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadBrokers();

    return () => {
      isMounted = false;
    };
  }, [accountId, useMockFallback]);

  return {
    brokers,
    isLoading,
    isUsingMock: status === "mock",
    status,
    errorMessage,
  };
}
