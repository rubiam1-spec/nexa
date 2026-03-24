import { useEffect } from "react";
import AccountProvider from "../contexts/AccountContext";
import AuthProvider from "../contexts/AuthContext";
import DevelopmentProvider, {
  useDevelopment,
} from "../contexts/DevelopmentContext";
import { useAccount } from "../contexts/AccountContext";
import { useAuth } from "../contexts/AuthContext";

function SessionContextSync({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { clearAccount } = useAccount();
  const { clearDevelopment } = useDevelopment();

  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setTimeout(() => {
        clearAccount();
        clearDevelopment();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [clearAccount, clearDevelopment, isAuthenticated]);

  return <>{children}</>;
}

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AccountProvider>
        <DevelopmentProvider>
          <SessionContextSync>{children}</SessionContextSync>
        </DevelopmentProvider>
      </AccountProvider>
    </AuthProvider>
  );
}
