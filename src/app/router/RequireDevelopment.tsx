import { Navigate } from "react-router-dom";
import { useAccount } from "../contexts/AccountContext";
import { useDevelopment } from "../contexts/DevelopmentContext";
import LoadingScreen from "../../shared/components/LoadingScreen";

export default function RequireDevelopment({
  children,
}: {
  children: React.ReactNode;
}) {
  const { account, isLoading: isLoadingAccount, status: accountStatus } = useAccount();
  const { development, isLoading: isLoadingDevelopment, status: developmentStatus } = useDevelopment();

  // Aguardar qualquer estado de carregamento ou idle (ainda não iniciou)
  const isStillLoading =
    isLoadingAccount ||
    isLoadingDevelopment ||
    accountStatus === "idle" ||
    developmentStatus === "idle";

  if (isStillLoading) {
    return <LoadingScreen />;
  }

  if (!account || !development) {
    return <Navigate to="/selecionar-empreendimento" replace />;
  }

  return <>{children}</>;
}
