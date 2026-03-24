import { useAuth } from "../../../app/contexts/AuthContext";
import { useNegotiationHistory } from "./useNegotiationHistory";
import { useNegotiationsOverview } from "./useNegotiationsOverview";
import { useProposals } from "./useProposals";
import { useCommercialSettings } from "../../configuracoes/hooks/useCommercialSettings";
import { useReservationRequests } from "./useReservationRequests";
import { useReservations } from "./useReservations";
import { useSales } from "./useSales";
import { useUnitQueue } from "./useUnitQueue";

export function useNegotiationDetail(negotiationId: string | undefined) {
  const { authenticatedProfile } = useAuth();
  const overview = useNegotiationsOverview();
  const {
    clientsState: { clients },
    brokersState: { brokers },
    negotiationsState: { negotiations },
    unitsState: { units },
  } = overview;

  const negotiation =
    negotiations.find((item) => item.id === negotiationId) ?? null;
  const unit = negotiation
    ? units.find((item) => item.id === negotiation.unitId) ?? null
    : null;
  const client =
    negotiation?.clientId != null
      ? clients.find((item) => item.id === negotiation.clientId) ?? null
      : null;
  const broker =
    negotiation?.brokerId != null
      ? brokers.find((item) => item.id === negotiation.brokerId) ?? null
      : null;
  const historyState = useNegotiationHistory(
    negotiationId,
    overview.negotiationsState.isUsingMock,
  );
  const settingsState = useCommercialSettings(
    overview.accountContext.account?.accountId ?? null,
    overview.developmentContext.development?.developmentId ?? null,
    overview.negotiationsState.isUsingMock,
    overview.accountContext.account?.role ?? null,
  );
  const proposalsState = useProposals(
    negotiation,
    overview.negotiationsState.isUsingMock,
    overview.accountContext.account?.role ?? null,
    overview.unitsState,
  );
  const queueState = useUnitQueue(
    negotiation,
    unit,
    proposalsState.proposals,
    client,
    settingsState.effectiveSettings,
    overview.negotiationsState.isUsingMock,
    overview.accountContext.account?.role ?? null,
    authenticatedProfile?.id ?? null,
    overview.unitsState,
  );
  const reservationRequestsState = useReservationRequests(
    negotiation,
    unit,
    proposalsState.proposals,
    client,
    settingsState.effectiveSettings,
    queueState.entries,
    overview.negotiationsState.isUsingMock,
    overview.accountContext.account?.role ?? null,
    overview.unitsState,
  );
  const reservationsState = useReservations(
    negotiation,
    overview.negotiationsState.isUsingMock,
    overview.accountContext.account?.role ?? null,
    overview.unitsState,
    queueState,
  );
  const salesState = useSales(
    negotiation,
    proposalsState.proposals,
    reservationRequestsState.requests,
    reservationsState.reservations,
    overview.negotiationsState.isUsingMock,
    overview.accountContext.account?.role ?? null,
    overview.unitsState,
  );

  return {
    ...overview,
    settingsState,
    queueState,
    historyState,
    proposalsState,
    reservationRequestsState,
    reservationsState,
    salesState,
    negotiation,
    unit,
    client,
    broker,
  };
}
