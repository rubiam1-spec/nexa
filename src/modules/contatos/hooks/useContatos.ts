import { useEffect, useState } from "react";
import { getClients } from "../../../infra/repositories/clientsSupabaseRepository";
import type { Client } from "../../../shared/types/client";

type ContatosStatus = "idle" | "loading" | "ready" | "empty" | "error";

export type ContatoFilters = {
  status?: string;
  temperature?: string;
  origin?: string;
  assignedTo?: string;
  search?: string;
  period?: string;
  city?: string;
};

export function useContatos(
  accountId: string | null,
  filters?: ContatoFilters,
  ownerFilter?: { userId: string; clientIdsFromNegs: string[] },
) {
  const [contatos, setContatos] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<ContatosStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        if (isMounted) { setIsLoading(true); setErrorMessage(null); }
        if (!accountId) { if (isMounted) { setContatos([]); setStatus("idle"); } return; }
        if (isMounted) setStatus("loading");
        const data = await getClients(accountId, ownerFilter, filters);
        if (!isMounted) return;
        setContatos(data);
        setStatus(data.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) return;
        setContatos([]);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar contatos.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void load();
    return () => { isMounted = false; };
  }, [accountId, filters?.status, filters?.temperature, filters?.origin, filters?.assignedTo, filters?.search, filters?.period, filters?.city, ownerFilter?.userId, refreshKey]);

  return { contatos, isLoading, status, errorMessage, refetch: () => setRefreshKey((k) => k + 1) };
}
