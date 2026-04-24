// NEXA — Engrenagem de Partes v1 — Fase 2
// Mutations agrupadas para negotiation_parties. Lê accountId/profileId
// dos contexts automaticamente (padrão de useSocialMutations).

import { useCallback, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import type {
  AddPartyInput,
  NegotiationParty,
  UpdatePartyInput,
} from "../../../shared/types/negotiationParty";
import {
  addParty as repoAddParty,
  removeParty as repoRemoveParty,
  updateParty as repoUpdateParty,
} from "../../../infra/repositories/negotiationPartiesSupabaseRepository";

export interface UsePartyMutationsResult {
  addParty: (input: AddPartyInput) => Promise<NegotiationParty | null>;
  updateParty: (partyId: string, input: UpdatePartyInput) => Promise<NegotiationParty | null>;
  removeParty: (partyId: string) => Promise<boolean>;
  isMutating: boolean;
  errorMessage: string | null;
  clearError: () => void;
}

export function usePartyMutations(): UsePartyMutationsResult {
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const accountId = account?.accountId ?? null;
  const profileId = authenticatedProfile?.id ?? null;

  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addParty = useCallback(
    async (input: AddPartyInput): Promise<NegotiationParty | null> => {
      if (!accountId || !profileId) {
        setErrorMessage(
          "Contexto de conta/perfil ausente para adicionar parte. Faça login e selecione uma conta.",
        );
        return null;
      }
      setIsMutating(true);
      setErrorMessage(null);
      try {
        return await repoAddParty(input, accountId, profileId);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Falha ao adicionar parte.",
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [accountId, profileId],
  );

  const updateParty = useCallback(
    async (partyId: string, input: UpdatePartyInput): Promise<NegotiationParty | null> => {
      setIsMutating(true);
      setErrorMessage(null);
      try {
        return await repoUpdateParty(partyId, input);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Falha ao atualizar parte.",
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const removeParty = useCallback(async (partyId: string): Promise<boolean> => {
    setIsMutating(true);
    setErrorMessage(null);
    try {
      await repoRemoveParty(partyId);
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao remover parte.",
      );
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return {
    addParty,
    updateParty,
    removeParty,
    isMutating,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
