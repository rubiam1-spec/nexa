// NEXA — Engrenagem Comercial v1 — Fase 2
// Hook de mutação: cria uma proposta pré-preenchida a partir de uma simulação.
// Expõe `createFromSimulation`, `isMutating` e `errorMessage`.

import { useCallback, useState } from "react";
import { useAuth } from "../../../app/contexts/AuthContext";
import type { Proposal } from "../../../shared/types/proposal";
import {
  createProposalFromSimulation as repoCreateProposalFromSimulation,
  type CreateProposalFromSimulationOverrides,
} from "../../../infra/repositories/proposalsSupabaseRepository";

export interface UseCreateProposalFromSimulationResult {
  createFromSimulation: (params: {
    simulationId: string;
    negotiationId: string;
    title?: string;
    overrides?: CreateProposalFromSimulationOverrides;
  }) => Promise<Proposal | null>;
  isMutating: boolean;
  errorMessage: string | null;
  clearError: () => void;
}

export function useCreateProposalFromSimulation(): UseCreateProposalFromSimulationResult {
  const { authenticatedProfile } = useAuth();
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createFromSimulation = useCallback(
    async (params: {
      simulationId: string;
      negotiationId: string;
      title?: string;
      overrides?: CreateProposalFromSimulationOverrides;
    }): Promise<Proposal | null> => {
      setIsMutating(true);
      setErrorMessage(null);
      try {
        const proposal = await repoCreateProposalFromSimulation({
          simulationId: params.simulationId,
          negotiationId: params.negotiationId,
          createdBy: authenticatedProfile?.id ?? null,
          title: params.title,
          overrides: params.overrides,
        });
        return proposal;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao criar proposta a partir da simulação.",
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [authenticatedProfile?.id],
  );

  return {
    createFromSimulation,
    isMutating,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
