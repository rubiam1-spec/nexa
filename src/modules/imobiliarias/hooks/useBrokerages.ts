import { useEffect, useState } from "react";
import { getBrokerages as getMockBrokerages } from "../repositories/brokeragesRepository";
import { getBrokerages as getSupabaseBrokerages } from "../../../infra/repositories/brokeragesSupabaseRepository";
import type { Brokerage } from "../../../shared/types/brokerage";

type BrokeragesStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

export function useBrokerages(
  accountId: string | null,
  useMockFallback: boolean,
) {
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<BrokeragesStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBrokerages() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId) {
          if (!isMounted) {
            return;
          }

          setBrokerages([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockBrokerages = getMockBrokerages();

          if (!isMounted) {
            return;
          }

          setBrokerages(mockBrokerages);
          setStatus(mockBrokerages.length > 0 ? "mock" : "empty");
          return;
        }

        const realBrokerages = await getSupabaseBrokerages(accountId);

        if (!isMounted) {
          return;
        }

        setBrokerages(realBrokerages);
        setStatus(realBrokerages.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBrokerages([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar imobiliarias da conta ativa.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadBrokerages();

    return () => {
      isMounted = false;
    };
  }, [accountId, useMockFallback]);

  return {
    brokerages,
    isLoading,
    isUsingMock: status === "mock",
    status,
    errorMessage,
  };
}
