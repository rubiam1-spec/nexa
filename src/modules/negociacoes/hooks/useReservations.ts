import { useEffect, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { cancelarReserva } from "../../../app/reserva/CancelarReserva";
import { expirarReserva } from "../../../app/reserva/ExpirarReserva";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeService } from "../../../domain/unidade/UnidadeService";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { Reservation } from "../../../shared/types/reservation";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import type { UserRole } from "../../../shared/types/auth";
import type { Unidade } from "../../../domain/unidade/Unidade";
import {
  createNegotiationHistoryEvent as createSupabaseNegotiationHistoryEvent,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import { createUnitHistoryEvent as createSupabaseUnitHistoryEvent } from "../../../infra/repositories/unitHistorySupabaseRepository";
import {
  getReservationsByNegotiation as getSupabaseReservationsByNegotiation,
  updateReservationStatus as updateSupabaseReservationStatus,
} from "../../../infra/repositories/reservationsSupabaseRepository";
import { appendNegotiationHistoryEvent } from "../repositories/negotiationHistoryRepository";
import { appendUnitHistoryEvent } from "../../units/repositories/unitHistoryRepository";
import {
  getReservationsByNegotiation as getMockReservationsByNegotiation,
  updateReservationStatus as updateMockReservationStatus,
} from "../repositories/reservationsRepository";

type ReservationsStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useReservations(
  negotiation: Negotiation | null,
  useMockFallback: boolean,
  actorRole: UserRole | null,
  unitsState: {
    units: Unidade[];
    persistUnitStatus: (unitId: string, status: Unidade["status"]) => Promise<Unidade>;
  },
  queueState: {
    promoteNext: (
      currentUnit: Unidade | null,
      performedBy: string | null,
    ) => Promise<unknown>;
  },
) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<ReservationsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadReservations() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!negotiation) {
          if (!isMounted) {
            return;
          }

          setReservations([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockReservations = getMockReservationsByNegotiation(negotiation.id);

          if (!isMounted) {
            return;
          }

          setReservations(mockReservations);
          setStatus(mockReservations.length > 0 ? "mock" : "empty");
          return;
        }

        const realReservations = await getSupabaseReservationsByNegotiation(
          negotiation.id,
        );

        if (!isMounted) {
          return;
        }

        setReservations(realReservations);
        setStatus(realReservations.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setReservations([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar reservas da negociacao.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReservations();

    return () => {
      isMounted = false;
    };
  }, [negotiation?.id, useMockFallback]);

  return {
    reservations,
    isLoading,
    isUpdating,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    prependReservation: (reservation: Reservation) =>
      setReservations((current) => [
        reservation,
        ...current.filter(
          (currentReservation) => currentReservation.id !== reservation.id,
        ),
      ]),
    cancelReservation: async (
      reservationId: string,
      performedBy: string | null,
    ): Promise<{
      reservation: Reservation;
      historyEvent: NegotiationHistoryEvent;
    } | null> => {
      const currentReservation =
        reservations.find((item) => item.id === reservationId) ?? null;

      if (!currentReservation || !negotiation) {
        setErrorMessage("Reserva nao encontrada para cancelamento.");
        return null;
      }

      try {
        setIsUpdating(true);
        setErrorMessage(null);

        assertPermission(
          actorRole,
          PermissionAction.CANCEL_RESERVATION,
          "Perfil sem permissao para cancelar reserva.",
        );

        const nextReservation = cancelarReserva(currentReservation);
        const persistedReservation = useMockFallback
          ? updateMockReservationStatus(reservationId, nextReservation.status)
          : await updateSupabaseReservationStatus(
              reservationId,
              nextReservation.status,
            );

        const historyInput = {
          negotiationId: negotiation.id,
          fromStatus: currentReservation.status,
          toStatus: persistedReservation.status,
          action: NegotiationHistoryAction.RESERVATION_CANCELLED,
          performedBy,
        };

        const historyEvent = useMockFallback
          ? appendNegotiationHistoryEvent(historyInput)
          : await createSupabaseNegotiationHistoryEvent(historyInput);

        const currentUnit =
          unitsState.units.find((item) => item.id === currentReservation.unitId) ??
          null;

        if (currentUnit && UnidadeService.podeLiberarNoFluxo(currentUnit)) {
          const nextUnit = UnidadeService.liberarNoFluxo(currentUnit);
          const persistedUnit = await unitsState.persistUnitStatus(
            currentUnit.id,
            nextUnit.status,
          );

          const unitHistoryInput = {
            unitId: currentUnit.id,
            negotiationId: negotiation.id,
            fromStatus: currentUnit.status,
            toStatus: persistedUnit.status,
            action: UnidadeHistoryAction.RESERVATION_CANCELLED,
            performedBy,
          };

          if (useMockFallback) {
            appendUnitHistoryEvent(unitHistoryInput);
          } else {
            await createSupabaseUnitHistoryEvent(unitHistoryInput);
          }

          await queueState.promoteNext(persistedUnit, performedBy);
        }

        setReservations((current) =>
          current.map((item) =>
            item.id === persistedReservation.id ? persistedReservation : item,
          ),
        );
        setStatus("ready");

        return {
          reservation: persistedReservation,
          historyEvent,
        };
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao cancelar reserva.",
        );
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    expireReservation: async (
      reservationId: string,
      performedBy: string | null,
    ): Promise<{
      reservation: Reservation;
      historyEvent: NegotiationHistoryEvent;
    } | null> => {
      const currentReservation =
        reservations.find((item) => item.id === reservationId) ?? null;

      if (!currentReservation || !negotiation) {
        setErrorMessage("Reserva nao encontrada para expiracao.");
        return null;
      }

      try {
        setIsUpdating(true);
        setErrorMessage(null);

        assertPermission(
          actorRole,
          PermissionAction.EXPIRE_RESERVATION,
          "Perfil sem permissao para expirar reserva.",
        );

        const nextReservation = expirarReserva(currentReservation);
        const persistedReservation = useMockFallback
          ? updateMockReservationStatus(reservationId, nextReservation.status)
          : await updateSupabaseReservationStatus(
              reservationId,
              nextReservation.status,
            );

        const historyInput = {
          negotiationId: negotiation.id,
          fromStatus: currentReservation.status,
          toStatus: persistedReservation.status,
          action: NegotiationHistoryAction.RESERVATION_EXPIRED,
          performedBy,
        };

        const historyEvent = useMockFallback
          ? appendNegotiationHistoryEvent(historyInput)
          : await createSupabaseNegotiationHistoryEvent(historyInput);

        const currentUnit =
          unitsState.units.find((item) => item.id === currentReservation.unitId) ??
          null;

        if (currentUnit && UnidadeService.podeLiberarNoFluxo(currentUnit)) {
          const nextUnit = UnidadeService.liberarNoFluxo(currentUnit);
          const persistedUnit = await unitsState.persistUnitStatus(
            currentUnit.id,
            nextUnit.status,
          );

          const unitHistoryInput = {
            unitId: currentUnit.id,
            negotiationId: negotiation.id,
            fromStatus: currentUnit.status,
            toStatus: persistedUnit.status,
            action: UnidadeHistoryAction.RESERVATION_EXPIRED,
            performedBy,
          };

          if (useMockFallback) {
            appendUnitHistoryEvent(unitHistoryInput);
          } else {
            await createSupabaseUnitHistoryEvent(unitHistoryInput);
          }

          await queueState.promoteNext(persistedUnit, performedBy);
        }

        setReservations((current) =>
          current.map((item) =>
            item.id === persistedReservation.id ? persistedReservation : item,
          ),
        );
        setStatus("ready");

        return {
          reservation: persistedReservation,
          historyEvent,
        };
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao expirar reserva.",
        );
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
  };
}
