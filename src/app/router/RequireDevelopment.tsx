import { Navigate } from "react-router-dom";
import { useAccount } from "../contexts/AccountContext";
import { useDevelopment } from "../contexts/DevelopmentContext";

export default function RequireDevelopment({
  children,
}: {
  children: React.ReactNode;
}) {
  const { account, isLoading: isLoadingAccount } = useAccount();
  const { development, isLoading: isLoadingDevelopment } = useDevelopment();

  if (isLoadingAccount || isLoadingDevelopment) {
    return <p>Carregando contexto operacional...</p>;
  }

  if (!account || !development) {
    return <Navigate to="/selecionar-empreendimento" replace />;
  }

  return <>{children}</>;
}
