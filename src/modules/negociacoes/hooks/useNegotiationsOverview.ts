import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useClientFilter } from "../../../shared/hooks/useClientFilter";
import { useClients } from "../../clientes/hooks/useClients";
import { useBrokers } from "../../corretores/hooks/useBrokers";
import { useNegotiations } from "./useNegotiations";
import { useUnits } from "../../units/hooks/useUnits";

export function useNegotiationsOverview() {
  const accountContext = useAccount();
  const developmentContext = useDevelopment();
  const clientFilter = useClientFilter();
  const useMockFallback =
    accountContext.isUsingMock || developmentContext.isUsingMock;
  const actorRole = accountContext.account?.role ?? null;
  const negotiationFilters = accountContext.isBroker
    ? { brokerId: accountContext.brokerId }
    : accountContext.isConsultant
      ? { ownerProfileId: accountContext.ownerProfileId }
      : undefined;
  const unitsState = useUnits(
    accountContext.account?.accountId ?? null,
    developmentContext.development?.developmentId ?? null,
    useMockFallback,
  );
  const negotiationsState = useNegotiations(
    accountContext.account?.accountId ?? null,
    developmentContext.development?.developmentId ?? null,
    useMockFallback,
    actorRole,
    unitsState,
    negotiationFilters,
  );
  const clientsState = useClients(
    accountContext.account?.accountId ?? null,
    useMockFallback,
    clientFilter,
  );
  const brokersState = useBrokers(
    accountContext.account?.accountId ?? null,
    useMockFallback,
  );

  return {
    accountContext,
    developmentContext,
    negotiationsState,
    clientsState,
    brokersState,
    unitsState,
  };
}
