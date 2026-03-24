import { useEffect, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { aprovarSolicitacaoReserva } from "../../../app/reserva/AprovarSolicitacaoReserva";
import { criarReservaAtiva } from "../../../app/reserva/CriarReservaAtiva";
import { recusarSolicitacaoReserva } from "../../../app/reserva/RecusarSolicitacaoReserva";
import { UnitQueueService } from "../../../domain/fila/UnitQueueService";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeService } from "../../../domain/unidade/UnidadeService";
import { solicitarReservaDaNegociacao } from "../../../app/reserva/SolicitarReservaDaNegociacao";
import type { Client } from "../../../shared/types/client";
import type { CommercialSettings } from "../../../shared/types/commercialSettings";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { Proposal } from "../../../shared/types/proposal";
import type { ReservationRequest } from "../../../shared/types/reservationRequest";
import type { Reservation } from "../../../shared/types/reservation";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import type { UserRole } from "../../../shared/types/auth";
import type { UnitQueueEntry } from "../../../shared/types/unitQueueEntry";
import type { Unidade } from "../../../domain/unidade/Unidade";
import {
  createNegotiationHistoryEvent as createSupabaseNegotiationHistoryEvent,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import { createUnitHistoryEvent as createSupabaseUnitHistoryEvent } from "../../../infra/repositories/unitHistorySupabaseRepository";
import {
  createReservationRequest as createSupabaseReservationRequest,
  getReservationRequestsByNegotiation as getSupabaseReservationRequestsByNegotiation,
  updateReservationRequestStatus as updateSupabaseReservationRequestStatus,
} from "../../../infra/repositories/reservationRequestsSupabaseRepository";
import {
  createReservation as createSupabaseReservation,
} from "../../../infra/repositories/reservationsSupabaseRepository";
import { appendNegotiationHistoryEvent } from "../repositories/negotiationHistoryRepository";
import { appendUnitHistoryEvent } from "../../units/repositories/unitHistoryRepository";
import {
  createReservationRequest as createMockReservationRequest,
  getReservationRequestsByNegotiation as getMockReservationRequestsByNegotiation,
  updateReservationRequestStatus as updateMockReservationRequestStatus,
} from "../repositories/reservationRequestsRepository";
import { createReservation as createMockReservation } from "../repositories/reservationsRepository";

type ReservationRequestsStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

export function useReservationRequests(
  negotiation: Negotiation | null,
  unit: Unidade | null,
  proposals: Proposal[],
  client: Client | null,
  settings: CommercialSettings | null,
  queueEntries: UnitQueueEntry[],
  useMockFallback: boolean,
  actorRole: UserRole | null,
  unitsState: {
    units: Unidade[];
    persistUnitStatus: (unitId: string, status: Unidade["status"]) => Promise<Unidade>;
  },
) {
  const [requests, setRequests] = useState<ReservationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<ReservationRequestsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!negotiation) {
          if (!isMounted) {
            return;
          }

          setRequests([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockRequests = getMockReservationRequestsByNegotiation(
            negotiation.id,
          );

          if (!isMounted) {
            return;
          }

          setRequests(mockRequests);
          setStatus(mockRequests.length > 0 ? "mock" : "empty");
          return;
        }

        const realRequests = await getSupabaseReservationRequestsByNegotiation(
          negotiation.id,
        );

        if (!isMounted) {
          return;
        }

        setRequests(realRequests);
        setStatus(realRequests.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setRequests([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar solicitacoes de reserva.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRequests();

    return () => {
      isMounted = false;
    };
  }, [negotiation?.id, useMockFallback]);

  async function createRequest(performedBy: string | null): Promise<{
    request: ReservationRequest;
    historyEvent: NegotiationHistoryEvent;
  } | null> {
    if (!negotiation) {
      setErrorMessage("Negociacao nao encontrada para solicitar reserva.");
      return null;
    }

    if (!settings) {
      setErrorMessage("Configuracoes comerciais indisponiveis para solicitar reserva.");
      return null;
    }

    const effectiveSettings = settings;

    try {
      setIsCreating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.REQUEST_RESERVATION,
        "Perfil sem permissao para solicitar reserva.",
      );

      if (
        settings.queueEnabled &&
        unit &&
        UnitQueueService.requiresQueueForNegotiation(
          unit,
          queueEntries,
          negotiation.id,
        )
      ) {
        throw new Error(
          "A unidade esta indisponivel no fluxo atual. Use a fila operacional em vez de solicitar nova reserva direta.",
        );
      }

      const plan = solicitarReservaDaNegociacao({
        negotiation,
        proposals,
        existingRequests: requests,
        settings: effectiveSettings,
        client,
      });

      const persistedRequest = useMockFallback
        ? createMockReservationRequest({
            negotiationId: negotiation.id,
            proposalId: plan.proposal.id,
            accountId: negotiation.accountId,
            developmentId: negotiation.developmentId,
            unitId: negotiation.unitId,
            requestedBy: performedBy,
          })
        : await createSupabaseReservationRequest({
            negotiationId: negotiation.id,
            proposalId: plan.proposal.id,
            accountId: negotiation.accountId,
            developmentId: negotiation.developmentId,
            unitId: negotiation.unitId,
            requestedBy: performedBy,
          });

      const historyInput = {
        negotiationId: negotiation.id,
        fromStatus: null,
        toStatus: persistedRequest.status,
        action: NegotiationHistoryAction.RESERVATION_REQUESTED,
        performedBy,
      };

      const historyEvent = useMockFallback
        ? appendNegotiationHistoryEvent(historyInput)
        : await createSupabaseNegotiationHistoryEvent(historyInput);

      setRequests((current) => [persistedRequest, ...current]);
      setStatus("ready");

      return {
        request: persistedRequest,
        historyEvent,
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao solicitar reserva.",
      );
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  async function transitionRequest(
    requestId: string,
    transition: "approve" | "reject",
    performedBy: string | null,
  ): Promise<{
    request: ReservationRequest;
    historyEvent: NegotiationHistoryEvent;
    reservation: Reservation | null;
  } | null> {
    const currentRequest = requests.find((item) => item.id === requestId) ?? null;

    if (!currentRequest || !negotiation) {
      setErrorMessage(
        "Solicitacao de reserva nao encontrada para atualizar status.",
      );
      return null;
    }

    if (!settings) {
      setErrorMessage(
        "Configuracoes comerciais indisponiveis para atualizar solicitacao de reserva.",
      );
      return null;
    }

    const effectiveSettings = settings;

    try {
      setIsUpdating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        transition === "approve"
          ? PermissionAction.APPROVE_RESERVATION_REQUEST
          : PermissionAction.REJECT_RESERVATION_REQUEST,
        "Perfil sem permissao para decidir a solicitacao de reserva.",
      );

      const nextRequest =
        transition === "approve"
          ? aprovarSolicitacaoReserva(currentRequest)
          : recusarSolicitacaoReserva(currentRequest);

      const persistedRequest = useMockFallback
        ? updateMockReservationRequestStatus(requestId, nextRequest.status)
        : await updateSupabaseReservationRequestStatus(
            requestId,
            nextRequest.status,
          );

      const reservation =
        transition === "approve"
          ? useMockFallback
            ? createMockReservation({
                ...criarReservaAtiva({
                  reservationRequestId: persistedRequest.id,
                  negotiationId: persistedRequest.negotiationId,
                  accountId: persistedRequest.accountId,
                  developmentId: persistedRequest.developmentId,
                  unitId: persistedRequest.unitId,
                  reservationDurationHours:
                    effectiveSettings.reservationDurationHours,
                }),
              })
            : await createSupabaseReservation({
                ...criarReservaAtiva({
                  reservationRequestId: persistedRequest.id,
                  negotiationId: persistedRequest.negotiationId,
                  accountId: persistedRequest.accountId,
                  developmentId: persistedRequest.developmentId,
                  unitId: persistedRequest.unitId,
                  reservationDurationHours:
                    effectiveSettings.reservationDurationHours,
                }),
              })
          : null;

      const historyInput = {
        negotiationId: persistedRequest.negotiationId,
        fromStatus: currentRequest.status,
        toStatus: persistedRequest.status,
        action:
          transition === "approve"
            ? NegotiationHistoryAction.RESERVATION_APPROVED
            : NegotiationHistoryAction.RESERVATION_REJECTED,
        performedBy,
      };

      const historyEvent = useMockFallback
        ? appendNegotiationHistoryEvent(historyInput)
        : await createSupabaseNegotiationHistoryEvent(historyInput);

      if (reservation) {
        const currentUnit =
          unitsState.units.find((item) => item.id === reservation.unitId) ?? null;

        if (
          currentUnit &&
          UnidadeService.podeMarcarComoReservadaNoFluxo(currentUnit)
        ) {
          const nextUnit = UnidadeService.marcarComoReservadaNoFluxo(currentUnit);
          const persistedUnit = await unitsState.persistUnitStatus(
            currentUnit.id,
            nextUnit.status,
          );

          const unitHistoryInput = {
            unitId: currentUnit.id,
            negotiationId: reservation.negotiationId,
            fromStatus: currentUnit.status,
            toStatus: persistedUnit.status,
            action: UnidadeHistoryAction.RESERVATION_ACTIVATED,
            performedBy,
          };

          if (useMockFallback) {
            appendUnitHistoryEvent(unitHistoryInput);
          } else {
            await createSupabaseUnitHistoryEvent(unitHistoryInput);
          }
        }
      }

      setRequests((current) =>
        current.map((item) =>
          item.id === persistedRequest.id ? persistedRequest : item,
        ),
      );
      setStatus("ready");

      return {
        request: persistedRequest,
        historyEvent,
        reservation,
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar solicitacao de reserva.",
      );
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    requests,
    isLoading,
    isCreating,
    isUpdating,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    createRequest,
    approveRequest: async (requestId: string, performedBy: string | null) =>
      await transitionRequest(requestId, "approve", performedBy),
    rejectRequest: async (requestId: string, performedBy: string | null) =>
      await transitionRequest(requestId, "reject", performedBy),
    replaceRequest: (request: ReservationRequest) =>
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? request : item)),
      ),
  };
}
