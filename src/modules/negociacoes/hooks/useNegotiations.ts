import { useEffect, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { cancelarNegociacao } from "../../../app/negociacao/CancelarNegociacao";
import { iniciarNegociacao } from "../../../app/negociacao/IniciarNegociacao";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeService } from "../../../domain/unidade/UnidadeService";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import type { UserRole } from "../../../shared/types/auth";
import type { Unidade } from "../../../domain/unidade/Unidade";
import {
  getNegotiations as getMockNegotiations,
  createNegotiation as createMockNegotiation,
} from "../repositories/negotiationsRepository";
import {
  createNegotiationHistoryEvent as createSupabaseNegotiationHistoryEvent,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import { createUnitHistoryEvent as createSupabaseUnitHistoryEvent } from "../../../infra/repositories/unitHistorySupabaseRepository";
import {
  createNegotiation as createSupabaseNegotiation,
  getNegotiations as getSupabaseNegotiations,
  updateNegotiationStatus as updateSupabaseNegotiationStatus,
} from "../../../infra/repositories/negotiationsSupabaseRepository";
import { appendUnitHistoryEvent } from "../../units/repositories/unitHistoryRepository";
import { appendNegotiationHistoryEvent } from "../repositories/negotiationHistoryRepository";
import { updateNegotiationStatus as updateMockNegotiationStatus } from "../repositories/negotiationsRepository";

type NegotiationsStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

export function useNegotiations(
  accountId: string | null,
  developmentId: string | null,
  useMockFallback: boolean,
  actorRole: UserRole | null,
  unitsState: {
    units: Unidade[];
    persistUnitStatus: (unitId: string, status: Unidade["status"]) => Promise<Unidade>;
  },
  filters?: { brokerId?: string | null; ownerProfileId?: string | null },
) {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<NegotiationsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNegotiations() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId || !developmentId) {
          if (!isMounted) {
            return;
          }

          setNegotiations([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockNegotiations = getMockNegotiations(accountId, developmentId);

          if (!isMounted) {
            return;
          }

          setNegotiations(mockNegotiations);
          setStatus(mockNegotiations.length > 0 ? "mock" : "empty");
          return;
        }

        const realNegotiations = await getSupabaseNegotiations(
          accountId,
          developmentId,
          filters,
        );

        if (!isMounted) {
          return;
        }

        setNegotiations(realNegotiations);
        setStatus(realNegotiations.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setNegotiations([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar negociacoes do empreendimento ativo.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadNegotiations();

    return () => {
      isMounted = false;
    };
  }, [accountId, developmentId, useMockFallback, filters?.brokerId, filters?.ownerProfileId]);

  async function updateStatus(
    negotiationId: string,
    nextAction: "start" | "cancel",
    performedBy: string | null,
  ): Promise<NegotiationHistoryEvent | null> {
    const currentNegotiation =
      negotiations.find((item) => item.id === negotiationId) ?? null;

    if (!currentNegotiation) {
      setErrorMessage("Negociacao nao encontrada para atualizar status.");
      return null;
    }

    try {
      setIsUpdating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        nextAction === "start"
          ? PermissionAction.START_NEGOTIATION
          : PermissionAction.CANCEL_NEGOTIATION,
        "Perfil sem permissao para operar o status da negociacao.",
      );

      const updatedNegotiation =
        nextAction === "start"
          ? iniciarNegociacao(currentNegotiation)
          : cancelarNegociacao(currentNegotiation);

      const persistedNegotiation = useMockFallback
        ? updateMockNegotiationStatus(
            negotiationId,
            updatedNegotiation.status,
          )
        : await updateSupabaseNegotiationStatus(
            negotiationId,
            updatedNegotiation.status,
          );

      const historyInput = {
        negotiationId,
        fromStatus: currentNegotiation.status,
        toStatus: persistedNegotiation.status,
        action:
          nextAction === "start"
            ? NegotiationHistoryAction.NEGOTIATION_STARTED
            : NegotiationHistoryAction.NEGOTIATION_CANCELLED,
        performedBy,
      };

      const createdHistoryEvent = useMockFallback
        ? appendNegotiationHistoryEvent(historyInput)
        : await createSupabaseNegotiationHistoryEvent(historyInput);

      const currentUnit =
        unitsState.units.find((item) => item.id === currentNegotiation.unitId) ?? null;

      if (currentUnit) {
        const nextUnit =
          nextAction === "start" && UnidadeService.podeEntrarEmNegociacao(currentUnit)
            ? UnidadeService.entrarEmNegociacao(currentUnit)
            : nextAction === "cancel" &&
                UnidadeService.podeLiberarNoFluxo(currentUnit)
              ? UnidadeService.liberarNoFluxo(currentUnit)
              : null;

        if (nextUnit) {
          const persistedUnit = await unitsState.persistUnitStatus(
            currentUnit.id,
            nextUnit.status,
          );

          const unitHistoryInput = {
            unitId: currentUnit.id,
            negotiationId,
            fromStatus: currentUnit.status,
            toStatus: persistedUnit.status,
            action:
              nextAction === "start"
                ? UnidadeHistoryAction.NEGOTIATION_STARTED
                : UnidadeHistoryAction.NEGOTIATION_CANCELLED,
            performedBy,
          };

          if (useMockFallback) {
            appendUnitHistoryEvent(unitHistoryInput);
          } else {
            await createSupabaseUnitHistoryEvent(unitHistoryInput);
          }
        }
      }

      setNegotiations((current) =>
        current.map((item) =>
          item.id === persistedNegotiation.id ? persistedNegotiation : item,
        ),
      );
      setStatus("ready");
      return createdHistoryEvent;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar status da negociacao.",
      );
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  async function createNegotiation(input: {
    accountId: string;
    developmentId: string;
    unitId: string;
    clientId: string | null;
    brokerId: string | null;
    performedBy: string | null;
  }): Promise<Negotiation | null> {
    try {
      setIsUpdating(true);
      setErrorMessage(null);

      const persistedNegotiation = useMockFallback
        ? createMockNegotiation({
            accountId: input.accountId,
            developmentId: input.developmentId,
            unitId: input.unitId,
            clientId: input.clientId,
            brokerId: input.brokerId,
          })
        : await createSupabaseNegotiation({
            accountId: input.accountId,
            developmentId: input.developmentId,
            unitId: input.unitId,
            clientId: input.clientId,
            brokerId: input.brokerId,
            ownerProfileId: input.performedBy,
          });

      const historyInput = {
        negotiationId: persistedNegotiation.id,
        fromStatus: null,
        toStatus: persistedNegotiation.status,
        action: NegotiationHistoryAction.NEGOTIATION_CREATED,
        performedBy: input.performedBy,
      };

      if (useMockFallback) {
        appendNegotiationHistoryEvent(historyInput);
      } else {
        await createSupabaseNegotiationHistoryEvent(historyInput);
      }

      const currentUnit =
        unitsState.units.find((item) => item.id === input.unitId) ?? null;

      if (currentUnit && UnidadeService.podeEntrarEmNegociacao(currentUnit)) {
        const nextUnit = UnidadeService.entrarEmNegociacao(currentUnit);
        const persistedUnit = await unitsState.persistUnitStatus(
          currentUnit.id,
          nextUnit.status,
        );

        const unitHistoryInput = {
          unitId: currentUnit.id,
          negotiationId: persistedNegotiation.id,
          fromStatus: currentUnit.status,
          toStatus: persistedUnit.status,
          action: UnidadeHistoryAction.NEGOTIATION_STARTED,
          performedBy: input.performedBy,
        };

        if (useMockFallback) {
          appendUnitHistoryEvent(unitHistoryInput);
        } else {
          await createSupabaseUnitHistoryEvent(unitHistoryInput);
        }
      }

      setNegotiations((current) => [persistedNegotiation, ...current]);
      setStatus("ready");
      return persistedNegotiation;
    } catch (error) {
      // Loga o erro completo (mensagem do Postgres/constraint) para diagnóstico.
      console.error("[useNegotiations] Falha ao criar negociação:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao criar negociacao.",
      );
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    negotiations,
    isLoading,
    isUpdating,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    createNegotiation,
    replaceNegotiation: (negotiation: Negotiation) =>
      setNegotiations((current) =>
        current.map((item) => (item.id === negotiation.id ? negotiation : item)),
      ),
    startNegotiation: async (negotiationId: string, performedBy: string | null) =>
      await updateStatus(negotiationId, "start", performedBy),
    cancelNegotiation: async (negotiationId: string, performedBy: string | null) =>
      await updateStatus(negotiationId, "cancel", performedBy),
  };
}
