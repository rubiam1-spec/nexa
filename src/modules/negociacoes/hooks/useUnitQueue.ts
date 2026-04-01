import { useEffect, useMemo, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { entrarNaFilaDaUnidade } from "../../../app/fila/EntrarNaFilaDaUnidade";
import { promoverFilaDaUnidade } from "../../../app/fila/PromoverFilaDaUnidade";
import { UnitQueueService } from "../../../domain/fila/UnitQueueService";
import { UnitQueueStatus } from "../../../domain/fila/UnitQueueStatus";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeService } from "../../../domain/unidade/UnidadeService";
import type { UserRole } from "../../../shared/types/auth";
import type { Client } from "../../../shared/types/client";
import type { CommercialSettings } from "../../../shared/types/commercialSettings";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import type { Proposal } from "../../../shared/types/proposal";
import type { UnitQueueEntry } from "../../../shared/types/unitQueueEntry";
import type { Unidade } from "../../../domain/unidade/Unidade";
import {
  createNegotiationHistoryEvent as createSupabaseNegotiationHistoryEvent,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import { createUnitHistoryEvent as createSupabaseUnitHistoryEvent } from "../../../infra/repositories/unitHistorySupabaseRepository";
import {
  createUnitQueueEntry as createSupabaseUnitQueueEntry,
  getUnitQueueEntriesByUnit as getSupabaseUnitQueueEntriesByUnit,
  updateUnitQueueEntryStatus as updateSupabaseUnitQueueEntryStatus,
} from "../../../infra/repositories/unitQueueSupabaseRepository";
import { appendNegotiationHistoryEvent } from "../repositories/negotiationHistoryRepository";
import { appendUnitHistoryEvent } from "../../units/repositories/unitHistoryRepository";
import {
  createUnitQueueEntry as createMockUnitQueueEntry,
  getUnitQueueEntriesByUnit as getMockUnitQueueEntriesByUnit,
  updateUnitQueueEntryStatus as updateMockUnitQueueEntryStatus,
} from "../repositories/unitQueueRepository";

type UnitQueueStateStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

function sortEntries(entries: UnitQueueEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function canViewFullQueue(role: UserRole | null) {
  return role === "director" || role === "manager" || (role as string) === "owner";
}

export function useUnitQueue(
  negotiation: Negotiation | null,
  unit: Unidade | null,
  proposals: Proposal[],
  client: Client | null,
  settings: CommercialSettings | null,
  useMockFallback: boolean,
  actorRole: UserRole | null,
  actorId: string | null,
  unitsState: {
    units: Unidade[];
    persistUnitStatus: (unitId: string, status: Unidade["status"]) => Promise<Unidade>;
  },
) {
  const [entries, setEntries] = useState<UnitQueueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<UnitQueueStateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQueue() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!negotiation || !unit) {
          if (!isMounted) {
            return;
          }

          setEntries([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockEntries = getMockUnitQueueEntriesByUnit(unit.id);

          if (!isMounted) {
            return;
          }

          setEntries(sortEntries(mockEntries));
          setStatus(mockEntries.length > 0 ? "mock" : "empty");
          return;
        }

        const realEntries = await getSupabaseUnitQueueEntriesByUnit(unit.id);

        if (!isMounted) {
          return;
        }

        setEntries(sortEntries(realEntries));
        setStatus(realEntries.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setEntries([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar a fila operacional da unidade.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      isMounted = false;
    };
  }, [negotiation?.id, unit?.id, useMockFallback]);

  const queueRequired = useMemo(() => {
    if (!negotiation || !unit) {
      return false;
    }

    return UnitQueueService.requiresQueueForNegotiation(
      unit,
      entries,
      negotiation.id,
    );
  }, [entries, negotiation, unit]);

  const canViewCompleteQueue = canViewFullQueue(actorRole);
  const visibleEntries = useMemo(() => {
    if (canViewCompleteQueue) {
      return entries;
    }

    if (!actorId) {
      return [];
    }

    return entries.filter((entry) => entry.requestedBy === actorId);
  }, [actorId, canViewCompleteQueue, entries]);

  const currentActorEntry = useMemo(() => {
    if (!actorId) {
      return null;
    }

    return (
      entries.find(
        (entry) =>
          entry.requestedBy === actorId &&
          (entry.status === UnitQueueStatus.ACTIVE ||
            entry.status === UnitQueueStatus.PROMOTED),
      ) ?? null
    );
  }, [actorId, entries]);

  async function createEntry(
    performedBy: string | null,
  ): Promise<{
    entry: UnitQueueEntry;
    historyEvent: NegotiationHistoryEvent;
  } | null> {
    if (!negotiation || !unit) {
      setErrorMessage("Negociacao ou unidade indisponivel para entrar na fila.");
      return null;
    }

    if (!settings) {
      setErrorMessage("Configuracoes comerciais indisponiveis para operar a fila.");
      return null;
    }

    try {
      setIsCreating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.ENTER_UNIT_QUEUE,
        "Perfil sem permissao para entrar na fila operacional.",
      );

      const plan = entrarNaFilaDaUnidade({
        negotiation,
        unit,
        proposals,
        client,
        settings,
        existingEntries: entries,
      });

      const persistedEntry = useMockFallback
        ? createMockUnitQueueEntry({
            unitId: unit.id,
            negotiationId: negotiation.id,
            accountId: negotiation.accountId,
            developmentId: negotiation.developmentId,
            requestedBy: performedBy,
            position: plan.position,
          })
        : await createSupabaseUnitQueueEntry({
            unitId: unit.id,
            negotiationId: negotiation.id,
            accountId: negotiation.accountId,
            developmentId: negotiation.developmentId,
            requestedBy: performedBy,
            position: plan.position,
          });

      const historyInput = {
        negotiationId: negotiation.id,
        fromStatus: null,
        toStatus: persistedEntry.status,
        action: NegotiationHistoryAction.QUEUE_ENTERED,
        performedBy,
      };

      const historyEvent = useMockFallback
        ? appendNegotiationHistoryEvent(historyInput)
        : await createSupabaseNegotiationHistoryEvent(historyInput);

      setEntries((current) => sortEntries([persistedEntry, ...current]));
      setStatus((current) => (current === "mock" ? "mock" : "ready"));

      return {
        entry: persistedEntry,
        historyEvent,
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao entrar na fila da unidade.",
      );
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  async function promoteNext(
    currentUnit: Unidade | null,
    performedBy: string | null,
  ): Promise<UnitQueueEntry | null> {
    try {
      setIsUpdating(true);
      setErrorMessage(null);

      const nextEntry = promoverFilaDaUnidade(entries);

      if (!nextEntry) {
        return null;
      }

      const persistedEntry = useMockFallback
        ? updateMockUnitQueueEntryStatus(nextEntry.id, nextEntry.status)
        : await updateSupabaseUnitQueueEntryStatus(nextEntry.id, nextEntry.status);

      const historyInput = {
        negotiationId: persistedEntry.negotiationId,
        fromStatus: UnitQueueStatus.ACTIVE,
        toStatus: persistedEntry.status,
        action: NegotiationHistoryAction.QUEUE_PROMOTED,
        performedBy,
      };

      if (useMockFallback) {
        appendNegotiationHistoryEvent(historyInput);
      } else {
        await createSupabaseNegotiationHistoryEvent(historyInput);
      }

      const activeUnit =
        currentUnit ??
        unitsState.units.find((item) => item.id === persistedEntry.unitId) ??
        null;

      if (activeUnit && UnidadeService.podeEntrarEmNegociacao(activeUnit)) {
        const nextUnit = UnidadeService.entrarEmNegociacao(activeUnit);
        const persistedUnit = await unitsState.persistUnitStatus(
          activeUnit.id,
          nextUnit.status,
        );

        const unitHistoryInput = {
          unitId: persistedUnit.id,
          negotiationId: persistedEntry.negotiationId,
          fromStatus: activeUnit.status,
          toStatus: persistedUnit.status,
          action: UnidadeHistoryAction.QUEUE_PROMOTED,
          performedBy,
        };

        if (useMockFallback) {
          appendUnitHistoryEvent(unitHistoryInput);
        } else {
          await createSupabaseUnitHistoryEvent(unitHistoryInput);
        }
      }

      setEntries((current) =>
        sortEntries(
          current.map((entry) =>
            entry.id === persistedEntry.id ? persistedEntry : entry,
          ),
        ),
      );
      setStatus((current) => (current === "mock" ? "mock" : "ready"));

      return persistedEntry;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao promover a fila operacional da unidade.",
      );
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    entries,
    visibleEntries,
    currentActorEntry,
    queueRequired,
    canViewCompleteQueue,
    isLoading,
    isCreating,
    isUpdating,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    createEntry,
    promoteNext,
  };
}
