import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useClients } from "../../clientes/hooks/useClients";
import { useBrokers } from "../../corretores/hooks/useBrokers";
import { useNegotiations } from "./useNegotiations";
import { useUnits } from "../../units/hooks/useUnits";

export function useNegotiationsOverview() {
  const accountContext = useAccount();
  const developmentContext = useDevelopment();
  const useMockFallback =
    accountContext.isUsingMock || developmentContext.isUsingMock;
  const actorRole = accountContext.account?.role ?? null;
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
  );
  const clientsState = useClients(
    accountContext.account?.accountId ?? null,
    useMockFallback,
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
