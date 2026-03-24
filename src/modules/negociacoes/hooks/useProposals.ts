import { useEffect, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { aceitarProposta } from "../../../app/proposta/AceitarProposta";
import { colocarPropostaEmAnalise } from "../../../app/proposta/ColocarPropostaEmAnalise";
import { criarPropostaDaNegociacao } from "../../../app/proposta/CriarPropostaDaNegociacao";
import { enviarProposta } from "../../../app/proposta/EnviarProposta";
import { recusarProposta } from "../../../app/proposta/RecusarProposta";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeService } from "../../../domain/unidade/UnidadeService";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { Proposal } from "../../../shared/types/proposal";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import type { UserRole } from "../../../shared/types/auth";
import type { Unidade } from "../../../domain/unidade/Unidade";
import {
  createNegotiationHistoryEvent as createSupabaseNegotiationHistoryEvent,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import { createUnitHistoryEvent as createSupabaseUnitHistoryEvent } from "../../../infra/repositories/unitHistorySupabaseRepository";
import {
  createProposal as createSupabaseProposal,
  getProposalsByNegotiation as getSupabaseProposalsByNegotiation,
  updateProposalStatus as updateSupabaseProposalStatus,
} from "../../../infra/repositories/proposalsSupabaseRepository";
import {
  updateNegotiationStatus as updateSupabaseNegotiationStatus,
} from "../../../infra/repositories/negotiationsSupabaseRepository";
import {
  appendNegotiationHistoryEvent,
} from "../repositories/negotiationHistoryRepository";
import {
  createProposal as createMockProposal,
  getProposalsByNegotiation as getMockProposalsByNegotiation,
  updateProposalStatus as updateMockProposalStatus,
} from "../repositories/proposalsRepository";
import { appendUnitHistoryEvent } from "../../units/repositories/unitHistoryRepository";
import { updateNegotiationStatus as updateMockNegotiationStatus } from "../repositories/negotiationsRepository";

type ProposalsStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useProposals(
  negotiation: Negotiation | null,
  useMockFallback: boolean,
  actorRole: UserRole | null,
  unitsState: {
    units: Unidade[];
    persistUnitStatus: (unitId: string, status: Unidade["status"]) => Promise<Unidade>;
  },
) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<ProposalsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProposals() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!negotiation) {
          if (!isMounted) {
            return;
          }

          setProposals([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockProposals = getMockProposalsByNegotiation(negotiation.id);

          if (!isMounted) {
            return;
          }

          setProposals(mockProposals);
          setStatus(mockProposals.length > 0 ? "mock" : "empty");
          return;
        }

        const realProposals = await getSupabaseProposalsByNegotiation(
          negotiation.id,
        );

        if (!isMounted) {
          return;
        }

        setProposals(realProposals);
        setStatus(realProposals.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProposals([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar propostas da negociacao.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProposals();

    return () => {
      isMounted = false;
    };
  }, [negotiation?.id, useMockFallback]);

  async function createProposal(params: {
    performedBy: string | null;
    suggestedAmount: number;
    title?: string;
    tipo?: string;
    entradaTipo?: string;
    entradaValor?: number;
    entradaPercentual?: number;
    parcelasQuantidade?: number;
    parcelasValor?: number;
    balaoQuantidade?: number;
    balaoValor?: number;
    permutaValor?: number;
    permutaDescricao?: string;
    observacoes?: string;
  }): Promise<{
    proposal: Proposal;
    historyEvents: NegotiationHistoryEvent[];
    updatedNegotiation: Negotiation | null;
  } | null> {
    if (!negotiation) {
      setErrorMessage("Negociacao nao encontrada para criar proposta.");
      return null;
    }

    try {
      setIsCreating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.CREATE_PROPOSAL,
        "Perfil sem permissao para criar proposta.",
      );

      const proposalPlan = criarPropostaDaNegociacao(negotiation, proposals.length);
      let persistedNegotiation: Negotiation | null = null;
      const historyEvents: NegotiationHistoryEvent[] = [];
      let currentStatus = negotiation.status;

      if (proposalPlan.nextNegotiation) {
        persistedNegotiation = useMockFallback
          ? updateMockNegotiationStatus(
              negotiation.id,
              proposalPlan.nextNegotiation.status,
            )
          : await updateSupabaseNegotiationStatus(
              negotiation.id,
              proposalPlan.nextNegotiation.status,
            );

        const startedEventInput = {
          negotiationId: negotiation.id,
          fromStatus: negotiation.status,
          toStatus: persistedNegotiation.status,
          action: NegotiationHistoryAction.NEGOTIATION_STARTED,
          performedBy: params.performedBy,
        };

        const startedEvent = useMockFallback
          ? appendNegotiationHistoryEvent(startedEventInput)
          : await createSupabaseNegotiationHistoryEvent(startedEventInput);

        historyEvents.push(startedEvent);
        currentStatus = persistedNegotiation.status;

        const currentUnit =
          unitsState.units.find((item) => item.id === negotiation.unitId) ?? null;

        if (currentUnit && UnidadeService.podeEntrarEmNegociacao(currentUnit)) {
          const nextUnit = UnidadeService.entrarEmNegociacao(currentUnit);
          const persistedUnit = await unitsState.persistUnitStatus(
            currentUnit.id,
            nextUnit.status,
          );

          const unitHistoryInput = {
            unitId: currentUnit.id,
            negotiationId: negotiation.id,
            fromStatus: currentUnit.status,
            toStatus: persistedUnit.status,
            action: UnidadeHistoryAction.NEGOTIATION_STARTED,
            performedBy: params.performedBy,
          };

          if (useMockFallback) {
            appendUnitHistoryEvent(unitHistoryInput);
          } else {
            await createSupabaseUnitHistoryEvent(unitHistoryInput);
          }
        }
      }

      const effectiveTitle = params.title?.trim() || proposalPlan.proposalTitle;

      const persistedProposal = useMockFallback
        ? createMockProposal({
            negotiationId: negotiation.id,
            accountId: negotiation.accountId,
            developmentId: negotiation.developmentId,
            unitId: negotiation.unitId,
            clientId: negotiation.clientId,
            brokerId: negotiation.brokerId,
            title: effectiveTitle,
            amount: params.suggestedAmount,
            createdBy: params.performedBy,
          })
        : await createSupabaseProposal({
            negotiationId: negotiation.id,
            accountId: negotiation.accountId,
            developmentId: negotiation.developmentId,
            unitId: negotiation.unitId,
            clientId: negotiation.clientId,
            brokerId: negotiation.brokerId,
            title: effectiveTitle,
            amount: params.suggestedAmount,
            createdBy: params.performedBy,
            tipo: params.tipo,
            entradaTipo: params.entradaTipo,
            entradaValor: params.entradaValor,
            entradaPercentual: params.entradaPercentual,
            parcelasQuantidade: params.parcelasQuantidade,
            parcelasValor: params.parcelasValor,
            balaoQuantidade: params.balaoQuantidade,
            balaoValor: params.balaoValor,
            permutaValor: params.permutaValor,
            permutaDescricao: params.permutaDescricao,
            observacoes: params.observacoes,
          });

      const proposalCreatedInput = {
        negotiationId: negotiation.id,
        fromStatus: currentStatus,
        toStatus: currentStatus,
        action: NegotiationHistoryAction.PROPOSAL_CREATED,
        performedBy: params.performedBy,
      };

      const proposalCreatedEvent = useMockFallback
        ? appendNegotiationHistoryEvent(proposalCreatedInput)
        : await createSupabaseNegotiationHistoryEvent(proposalCreatedInput);

      historyEvents.push(proposalCreatedEvent);
      setProposals((current) => [persistedProposal, ...current]);
      setStatus("ready");

      return {
        proposal: persistedProposal,
        historyEvents,
        updatedNegotiation: persistedNegotiation,
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao criar proposta da negociacao.",
      );
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  async function transitionProposalStatus(
    proposalId: string,
    transition: "send" | "analyze" | "accept" | "reject",
    performedBy: string | null,
  ): Promise<{
    proposal: Proposal;
    historyEvent: NegotiationHistoryEvent;
    updatedNegotiation: Negotiation | null;
  } | null> {
    const currentProposal =
      proposals.find((item) => item.id === proposalId) ?? null;

    if (!currentProposal) {
      setErrorMessage("Proposta nao encontrada para atualizar status.");
      return null;
    }

    try {
      setIsUpdating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.OPERATE_PROPOSAL,
        "Perfil sem permissao para operar proposta.",
      );

      const nextProposal =
        transition === "send"
          ? enviarProposta(currentProposal)
          : transition === "analyze"
            ? colocarPropostaEmAnalise(currentProposal)
            : transition === "accept"
              ? aceitarProposta(currentProposal)
              : recusarProposta(currentProposal);

      const persistedProposal = useMockFallback
        ? updateMockProposalStatus(proposalId, nextProposal.status)
        : await updateSupabaseProposalStatus(proposalId, nextProposal.status);

      const action =
        transition === "send"
          ? NegotiationHistoryAction.PROPOSAL_SENT
          : transition === "analyze"
            ? NegotiationHistoryAction.PROPOSAL_UNDER_ANALYSIS
            : transition === "accept"
              ? NegotiationHistoryAction.PROPOSAL_ACCEPTED
              : NegotiationHistoryAction.PROPOSAL_REJECTED;

      const historyInput = {
        negotiationId: currentProposal.negotiationId,
        fromStatus: currentProposal.status,
        toStatus: persistedProposal.status,
        action,
        performedBy,
      };

      const historyEvent = useMockFallback
        ? appendNegotiationHistoryEvent(historyInput)
        : await createSupabaseNegotiationHistoryEvent(historyInput);

      setProposals((current) =>
        current.map((item) =>
          item.id === persistedProposal.id ? persistedProposal : item,
        ),
      );
      setStatus("ready");

      return {
        proposal: persistedProposal,
        historyEvent,
        updatedNegotiation: null,
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar status da proposta.",
      );
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    proposals,
    isLoading,
    isCreating,
    isUpdating,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    createProposal,
    sendProposal: async (proposalId: string, performedBy: string | null) =>
      await transitionProposalStatus(proposalId, "send", performedBy),
    markProposalUnderAnalysis: async (
      proposalId: string,
      performedBy: string | null,
    ) => await transitionProposalStatus(proposalId, "analyze", performedBy),
    acceptProposal: async (proposalId: string, performedBy: string | null) =>
      await transitionProposalStatus(proposalId, "accept", performedBy),
    rejectProposal: async (proposalId: string, performedBy: string | null) =>
      await transitionProposalStatus(proposalId, "reject", performedBy),
    prependProposal: (proposal: Proposal) =>
      setProposals((current) => [
        proposal,
        ...current.filter((currentProposal) => currentProposal.id !== proposal.id),
      ]),
  };
}
