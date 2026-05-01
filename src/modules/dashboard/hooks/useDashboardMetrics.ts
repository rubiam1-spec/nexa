import { useEffect, useState } from "react";
import { useNegotiationsOverview } from "../../negociacoes/hooks/useNegotiationsOverview";
import { buildDashboardMetrics, type DashboardMetrics } from "../../../app/dashboard/buildDashboardMetrics";
import { getProposals as getMockProposals } from "../../negociacoes/repositories/proposalsRepository";
import { getReservationRequests as getMockReservationRequests } from "../../negociacoes/repositories/reservationRequestsRepository";
import { getReservations as getMockReservations } from "../../negociacoes/repositories/reservationsRepository";
import { getSales as getMockSales } from "../../negociacoes/repositories/salesRepository";
import { getProposals as getSupabaseProposals } from "../../../infra/repositories/proposalsSupabaseRepository";
import { getReservationRequests as getSupabaseReservationRequests } from "../../../infra/repositories/reservationRequestsSupabaseRepository";
import { getReservations as getSupabaseReservations } from "../../../infra/repositories/reservationsSupabaseRepository";
import { getSales as getSupabaseSales } from "../../../infra/repositories/salesSupabaseRepository";

type DashboardMetricsStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

export function useDashboardMetrics() {
  const overview = useNegotiationsOverview();
  const accountId = overview.accountContext.account?.accountId ?? null;
  const developmentId =
    overview.developmentContext.development?.developmentId ?? null;
  const useMockFallback =
    overview.accountContext.isUsingMock || overview.developmentContext.isUsingMock;
  const isBroker = overview.accountContext.isBroker;

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<DashboardMetricsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const negotiationsLength = overview.negotiationsState.negotiations.length;
  const unitsLength = overview.unitsState.units.length;
  const negotiationsStatus = overview.negotiationsState.status;
  const unitsStatus = overview.unitsState.status;

  useEffect(() => {
    let isMounted = true;

    async function loadMetrics() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId || !developmentId) {
          if (!isMounted) {
            return;
          }

          setMetrics(null);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        const proposals = useMockFallback
          ? getMockProposals(accountId, developmentId)
          : await getSupabaseProposals(accountId, developmentId);
        const reservationRequests = useMockFallback
          ? getMockReservationRequests(accountId, developmentId)
          : await getSupabaseReservationRequests(accountId, developmentId);
        const reservations = useMockFallback
          ? getMockReservations(accountId, developmentId)
          : await getSupabaseReservations(accountId, developmentId);
        const sales = useMockFallback
          ? getMockSales(accountId, developmentId)
          : await getSupabaseSales(accountId, developmentId);

        if (!isMounted) {
          return;
        }

        // For brokers, filter proposals/reservations/sales to only their negotiations
        const brokerNegotiationIds = isBroker
          ? new Set(overview.negotiationsState.negotiations.map((n) => n.id))
          : null;

        const filteredProposals = brokerNegotiationIds
          ? proposals.filter((p) => brokerNegotiationIds.has(p.negotiationId))
          : proposals;
        const filteredReservations = brokerNegotiationIds
          ? reservations.filter((r) => brokerNegotiationIds.has(r.negotiationId))
          : reservations;
        const filteredSales = brokerNegotiationIds
          ? sales.filter((s) => brokerNegotiationIds.has(s.negotiationId))
          : sales;
        const filteredReservationRequests = brokerNegotiationIds
          ? reservationRequests.filter((rr) => brokerNegotiationIds.has(rr.negotiationId))
          : reservationRequests;

        const nextMetrics = buildDashboardMetrics({
          negotiations: overview.negotiationsState.negotiations,
          proposals: filteredProposals,
          reservationRequests: filteredReservationRequests,
          reservations: filteredReservations,
          sales: filteredSales,
          units: overview.unitsState.units,
        });

        const totalDataPoints =
          overview.negotiationsState.negotiations.length +
          proposals.length +
          reservationRequests.length +
          reservations.length +
          sales.length +
          overview.unitsState.units.length;

        setMetrics(nextMetrics);
        setStatus(totalDataPoints > 0 ? (useMockFallback ? "mock" : "ready") : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMetrics(null);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar indicadores do dashboard.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [
    accountId,
    developmentId,
    negotiationsLength,
    unitsLength,
    negotiationsStatus,
    unitsStatus,
    useMockFallback,
  ]);

  return {
    ...overview,
    metrics,
    isLoading,
    isUsingMock: status === "mock",
    status,
    errorMessage,
  };
}
