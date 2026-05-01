import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingScreen from "../../shared/components/LoadingScreen";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // LOADING: session restore in progress — show spinner, do NOT redirect
  if (isLoading) {
    return <LoadingScreen />;
  }

  // NOT AUTHENTICATED: redirect to login, preserving current URL
  if (!isAuthenticated) {
    return <Navigate to="/entrar" state={{ from: location.pathname + location.search }} replace />;
  }

  // AUTHENTICATED: render the page (preserves current URL)
  return <>{children}</>;
}
