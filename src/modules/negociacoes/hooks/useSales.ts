import { useEffect, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeService } from "../../../domain/unidade/UnidadeService";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { Proposal } from "../../../shared/types/proposal";
import type { ReservationRequest } from "../../../shared/types/reservationRequest";
import type { Reservation } from "../../../shared/types/reservation";
import type { Sale } from "../../../shared/types/sale";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";
import type { UserRole } from "../../../shared/types/auth";
import type { Unidade } from "../../../domain/unidade/Unidade";
import { ReservationStatus } from "../../../domain/reserva/ReservationStatus";
import { converterNegociacaoEmVenda } from "../../../app/venda/ConverterNegociacaoEmVenda";
import { avancarVendaParaDocumentos } from "../../../app/venda/AvancarVendaParaDocumentos";
import { avancarVendaParaContrato } from "../../../app/venda/AvancarVendaParaContrato";
import { avancarVendaParaPagamento } from "../../../app/venda/AvancarVendaParaPagamento";
import { concluirVenda } from "../../../app/venda/ConcluirVenda";
import { cancelarVenda } from "../../../app/venda/CancelarVenda";
import {
  createNegotiationHistoryEvent as createSupabaseNegotiationHistoryEvent,
} from "../../../infra/repositories/negotiationHistorySupabaseRepository";
import { createUnitHistoryEvent as createSupabaseUnitHistoryEvent } from "../../../infra/repositories/unitHistorySupabaseRepository";
import {
  createSale as createSupabaseSale,
  getSalesByNegotiation as getSupabaseSalesByNegotiation,
  updateSaleStatus as updateSupabaseSaleStatus,
} from "../../../infra/repositories/salesSupabaseRepository";
import {
  updateReservationStatus as updateSupabaseReservationStatus,
} from "../../../infra/repositories/reservationsSupabaseRepository";
import {
  updateNegotiationStatus as updateSupabaseNegotiationStatus,
} from "../../../infra/repositories/negotiationsSupabaseRepository";
import { appendNegotiationHistoryEvent } from "../repositories/negotiationHistoryRepository";
import { appendUnitHistoryEvent } from "../../units/repositories/unitHistoryRepository";
import {
  createSale as createMockSale,
  getSalesByNegotiation as getMockSalesByNegotiation,
  updateSaleStatus as updateMockSaleStatus,
} from "../repositories/salesRepository";
import { updateNegotiationStatus as updateMockNegotiationStatus } from "../repositories/negotiationsRepository";
import { updateReservationStatus as updateMockReservationStatus } from "../repositories/reservationsRepository";

type SalesStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useSales(
  negotiation: Negotiation | null,
  proposals: Proposal[],
  reservationRequests: ReservationRequest[],
  reservations: Reservation[],
  useMockFallback: boolean,
  actorRole: UserRole | null,
  unitsState: {
    units: Unidade[];
    persistUnitStatus: (unitId: string, status: Unidade["status"]) => Promise<Unidade>;
  },
) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [status, setStatus] = useState<SalesStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSales() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!negotiation) {
          if (!isMounted) {
            return;
          }

          setSales([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockSales = getMockSalesByNegotiation(negotiation.id);

          if (!isMounted) {
            return;
          }

          setSales(mockSales);
          setStatus(mockSales.length > 0 ? "mock" : "empty");
          return;
        }

        const realSales = await getSupabaseSalesByNegotiation(negotiation.id);

        if (!isMounted) {
          return;
        }

        setSales(realSales);
        setStatus(realSales.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSales([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar vendas da negociacao.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSales();

    return () => {
      isMounted = false;
    };
  }, [negotiation?.id, useMockFallback]);

  async function createSale(performedBy: string | null): Promise<{
    sale: Sale;
    historyEvent: NegotiationHistoryEvent;
    updatedNegotiation: Negotiation;
  } | null> {
    if (!negotiation) {
      setErrorMessage("Negociacao nao encontrada para converter em venda.");
      return null;
    }

    try {
      setIsCreating(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.CONVERT_SALE,
        "Perfil sem permissao para converter negociacao em venda.",
      );

      const plan = converterNegociacaoEmVenda({
        negotiation,
        proposals,
        reservationRequests,
        reservations,
        existingSales: sales,
      });

      const persistedNegotiation = useMockFallback
        ? updateMockNegotiationStatus(negotiation.id, plan.updatedNegotiation.status)
        : await updateSupabaseNegotiationStatus(
            negotiation.id,
            plan.updatedNegotiation.status,
          );

      const persistedSale = useMockFallback
        ? createMockSale({
            ...plan.saleDraft,
            createdBy: performedBy,
          })
        : await createSupabaseSale({
            ...plan.saleDraft,
            createdBy: performedBy,
          });

      const historyInput = {
        negotiationId: negotiation.id,
        fromStatus: negotiation.status,
        toStatus: persistedNegotiation.status,
        action: NegotiationHistoryAction.SALE_CREATED,
        performedBy,
      };

      const historyEvent = useMockFallback
        ? appendNegotiationHistoryEvent(historyInput)
        : await createSupabaseNegotiationHistoryEvent(historyInput);

      const currentUnit =
        unitsState.units.find((item) => item.id === negotiation.unitId) ?? null;

      if (currentUnit && UnidadeService.podeVender(currentUnit)) {
        const nextUnit = UnidadeService.marcarComoVendida(currentUnit);
        const persistedUnit = await unitsState.persistUnitStatus(
          currentUnit.id,
          nextUnit.status,
        );

        const unitHistoryInput = {
          unitId: currentUnit.id,
          negotiationId: negotiation.id,
          fromStatus: currentUnit.status,
          toStatus: persistedUnit.status,
          action: UnidadeHistoryAction.SALE_CREATED,
          performedBy,
        };

        if (useMockFallback) {
          appendUnitHistoryEvent(unitHistoryInput);
        } else {
          await createSupabaseUnitHistoryEvent(unitHistoryInput);
        }
      }

      // Convert reservation to CONVERTED status
      if (useMockFallback) {
        updateMockReservationStatus(
          plan.saleDraft.reservationId,
          ReservationStatus.CONVERTED,
        );
      } else {
        await updateSupabaseReservationStatus(
          plan.saleDraft.reservationId,
          ReservationStatus.CONVERTED,
        );
      }

      const convertedHistoryInput = {
        negotiationId: negotiation.id,
        fromStatus: persistedNegotiation.status,
        toStatus: persistedNegotiation.status,
        action: NegotiationHistoryAction.RESERVATION_CONVERTED,
        performedBy,
      };

      if (useMockFallback) {
        appendNegotiationHistoryEvent(convertedHistoryInput);
      } else {
        await createSupabaseNegotiationHistoryEvent(convertedHistoryInput);
      }

      setSales((current) => [persistedSale, ...current]);
      setStatus("ready");

      return {
        sale: persistedSale,
        historyEvent,
        updatedNegotiation: persistedNegotiation,
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao converter negociacao em venda.",
      );
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  async function transitionSale(
    saleId: string,
    transitionFn: (sale: Sale) => Sale,
    historyAction: NegotiationHistoryAction,
    permissionAction: PermissionAction,
    permissionMessage: string,
    performedBy: string | null,
  ): Promise<Sale | null> {
    const sale = sales.find((item) => item.id === saleId);

    if (!sale || !negotiation) {
      setErrorMessage("Venda ou negociacao nao encontrada.");
      return null;
    }

    try {
      setIsTransitioning(true);
      setErrorMessage(null);

      assertPermission(actorRole, permissionAction, permissionMessage);

      const transitioned = transitionFn(sale);

      const persistedSale = useMockFallback
        ? updateMockSaleStatus(saleId, transitioned.status)
        : await updateSupabaseSaleStatus(saleId, transitioned.status);

      const historyInput = {
        negotiationId: negotiation.id,
        fromStatus: sale.status,
        toStatus: persistedSale.status,
        action: historyAction,
        performedBy,
      };

      if (useMockFallback) {
        appendNegotiationHistoryEvent(historyInput);
      } else {
        await createSupabaseNegotiationHistoryEvent(historyInput);
      }

      setSales((current) =>
        current.map((item) => (item.id === saleId ? persistedSale : item)),
      );

      return persistedSale;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao atualizar venda.",
      );
      return null;
    } finally {
      setIsTransitioning(false);
    }
  }

  async function advanceSaleToDocuments(saleId: string, performedBy: string | null) {
    return transitionSale(
      saleId,
      avancarVendaParaDocumentos,
      NegotiationHistoryAction.SALE_ADVANCED,
      PermissionAction.ADVANCE_SALE,
      "Perfil sem permissao para avancar status da venda.",
      performedBy,
    );
  }

  async function advanceSaleToContract(saleId: string, performedBy: string | null) {
    return transitionSale(
      saleId,
      avancarVendaParaContrato,
      NegotiationHistoryAction.SALE_ADVANCED,
      PermissionAction.ADVANCE_SALE,
      "Perfil sem permissao para avancar status da venda.",
      performedBy,
    );
  }

  async function advanceSaleToPayment(saleId: string, performedBy: string | null) {
    return transitionSale(
      saleId,
      avancarVendaParaPagamento,
      NegotiationHistoryAction.SALE_ADVANCED,
      PermissionAction.ADVANCE_SALE,
      "Perfil sem permissao para avancar status da venda.",
      performedBy,
    );
  }

  async function completeSale(saleId: string, performedBy: string | null) {
    return transitionSale(
      saleId,
      concluirVenda,
      NegotiationHistoryAction.SALE_COMPLETED,
      PermissionAction.ADVANCE_SALE,
      "Perfil sem permissao para concluir a venda.",
      performedBy,
    );
  }

  async function cancelSale(saleId: string, performedBy: string | null): Promise<Sale | null> {
    const sale = sales.find((item) => item.id === saleId);

    if (!sale || !negotiation) {
      setErrorMessage("Venda ou negociacao nao encontrada.");
      return null;
    }

    try {
      setIsTransitioning(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.CANCEL_SALE,
        "Perfil sem permissao para cancelar a venda.",
      );

      const cancelled = cancelarVenda(sale);

      const persistedSale = useMockFallback
        ? updateMockSaleStatus(saleId, cancelled.status)
        : await updateSupabaseSaleStatus(saleId, cancelled.status);

      // Revert unit status: VENDIDO -> DISPONIVEL or EM_NEGOCIACAO
      const currentUnit =
        unitsState.units.find((item) => item.id === negotiation.unitId) ?? null;

      if (currentUnit && currentUnit.status === "VENDIDO") {
        const nextUnitStatus = negotiation.status === "WON" || negotiation.status === "CANCELLED"
          ? "DISPONIVEL"
          : "EM_NEGOCIACAO";

        const persistedUnit = await unitsState.persistUnitStatus(
          currentUnit.id,
          nextUnitStatus as Unidade["status"],
        );

        const unitHistoryInput = {
          unitId: currentUnit.id,
          negotiationId: negotiation.id,
          fromStatus: currentUnit.status,
          toStatus: persistedUnit.status,
          action: UnidadeHistoryAction.SALE_CREATED,
          performedBy,
        };

        if (useMockFallback) {
          appendUnitHistoryEvent(unitHistoryInput);
        } else {
          await createSupabaseUnitHistoryEvent(unitHistoryInput);
        }
      }

      const historyInput = {
        negotiationId: negotiation.id,
        fromStatus: sale.status,
        toStatus: persistedSale.status,
        action: NegotiationHistoryAction.SALE_CANCELLED,
        performedBy,
      };

      if (useMockFallback) {
        appendNegotiationHistoryEvent(historyInput);
      } else {
        await createSupabaseNegotiationHistoryEvent(historyInput);
      }

      setSales((current) =>
        current.map((item) => (item.id === saleId ? persistedSale : item)),
      );

      return persistedSale;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao cancelar venda.",
      );
      return null;
    } finally {
      setIsTransitioning(false);
    }
  }

  return {
    sales,
    isLoading,
    isCreating,
    isTransitioning,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    createSale,
    advanceSaleToDocuments,
    advanceSaleToContract,
    advanceSaleToPayment,
    completeSale,
    cancelSale,
    prependSale: (sale: Sale) =>
      setSales((current) => [
        sale,
        ...current.filter((currentSale) => currentSale.id !== sale.id),
      ]),
  };
}
