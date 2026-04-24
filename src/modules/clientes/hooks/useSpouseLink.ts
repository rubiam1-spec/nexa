// NEXA — Engrenagem de Partes v1 — Fase 2
// Mutations para vincular/desvincular cônjuges entre 2 cadastros de client.
// Validação de conta + estado civil fica no repositório (única fonte de verdade).

import { useCallback, useState } from "react";
import { linkSpouses as repoLinkSpouses, unlinkSpouses as repoUnlinkSpouses } from "../../../infra/repositories/clientsSupabaseRepository";

export interface UseSpouseLinkResult {
  linkSpouses: (clientId: string, spouseClientId: string) => Promise<boolean>;
  unlinkSpouses: (clientId: string) => Promise<boolean>;
  isMutating: boolean;
  errorMessage: string | null;
  clearError: () => void;
}

export function useSpouseLink(): UseSpouseLinkResult {
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const linkSpouses = useCallback(
    async (clientId: string, spouseClientId: string): Promise<boolean> => {
      setIsMutating(true);
      setErrorMessage(null);
      try {
        await repoLinkSpouses(clientId, spouseClientId);
        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Falha ao vincular cônjuge.",
        );
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const unlinkSpouses = useCallback(async (clientId: string): Promise<boolean> => {
    setIsMutating(true);
    setErrorMessage(null);
    try {
      await repoUnlinkSpouses(clientId);
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao desvincular cônjuge.",
      );
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return {
    linkSpouses,
    unlinkSpouses,
    isMutating,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
