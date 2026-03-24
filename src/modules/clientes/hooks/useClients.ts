import { useEffect, useState } from "react";
import { getClients as getMockClients } from "../repositories/clientsRepository";
import { getClients as getSupabaseClients } from "../../../infra/repositories/clientsSupabaseRepository";
import type { Client } from "../../../shared/types/client";

type ClientsStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useClients(accountId: string | null, useMockFallback: boolean) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<ClientsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadClients() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId) {
          if (!isMounted) {
            return;
          }

          setClients([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockClients = getMockClients();

          if (!isMounted) {
            return;
          }

          setClients(mockClients);
          setStatus(mockClients.length > 0 ? "mock" : "empty");
          return;
        }

        const realClients = await getSupabaseClients(accountId);

        if (!isMounted) {
          return;
        }

        setClients(realClients);
        setStatus(realClients.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setClients([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar clientes da conta ativa.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, [accountId, useMockFallback]);

  return {
    clients,
    isLoading,
    isUsingMock: status === "mock",
    status,
    errorMessage,
  };
}
