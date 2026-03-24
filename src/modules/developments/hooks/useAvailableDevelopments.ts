import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";

export function useAvailableDevelopments() {
  const { sessionSource } = useAuth();
  const accountContext = useAccount();
  const developmentContext = useDevelopment();

  return {
    sessionSource,
    accountContext,
    developmentContext,
  };
}
