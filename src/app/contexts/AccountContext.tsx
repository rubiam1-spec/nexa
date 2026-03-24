import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getAccessibleAccounts } from "../../infra/repositories/accountSupabaseRepository";
import { isSupabaseConfigured } from "../../infra/supabase/supabaseClient";
import { isMockFallbackEnabled } from "../../shared/config/runtime";
import type { AccountContextData } from "../../shared/types/account";
import { useAuth } from "./AuthContext";

type AccountStatus = "idle" | "loading" | "mock" | "ready" | "no_access" | "error";

type AccountContextValue = {
  account: AccountContextData | null;
  availableAccounts: AccountContextData[];
  isLoading: boolean;
  isUsingMock: boolean;
  status: AccountStatus;
  errorMessage: string | null;
  selectAccount: (accountId: string) => void;
  clearAccount: () => void;
};

const mockAccount: AccountContextData = {
  accountId: "account_1",
  accountName: "NEXA Workspace",
  slug: "nexa-workspace",
  role: "director",
};

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

function getStorageKey(userId: string) {
  return `nexa.activeAccount.${userId}`;
}

export default function AccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticatedProfile, isAuthenticated, sessionSource } = useAuth();
  const [account, setAccount] = useState<AccountContextData | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AccountContextData[]>(
    [],
  );
  const [status, setStatus] = useState<AccountStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearAccount = useCallback(() => {
    setAccount(null);
    setAvailableAccounts([]);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const selectAccount = useCallback(
    (accountId: string) => {
      const selectedAccount =
        availableAccounts.find((item) => item.accountId === accountId) ?? null;

      setAccount(selectedAccount);

      if (authenticatedProfile) {
        localStorage.setItem(getStorageKey(authenticatedProfile.id), accountId);
      }
    },
    [authenticatedProfile?.id, availableAccounts],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAccounts() {
      if (!isAuthenticated || !authenticatedProfile) {
        clearAccount();
        return;
      }

      setStatus("loading");

      if (sessionSource === "mock" || (!isSupabaseConfigured && isMockFallbackEnabled)) {
        if (!isMounted) {
          return;
        }

        setAvailableAccounts([mockAccount]);
        setAccount(mockAccount);
        setStatus("mock");
        setErrorMessage(null);
        return;
      }

      if (!isSupabaseConfigured) {
        if (!isMounted) {
          return;
        }

        setAvailableAccounts([]);
        setAccount(null);
        setStatus("error");
        setErrorMessage(
          "Supabase nao configurado para carregar contas reais neste ambiente.",
        );
        return;
      }

      try {
        const accounts = await getAccessibleAccounts(authenticatedProfile.id);

        if (!isMounted) {
          return;
        }

        if (accounts.length === 0) {
          setAvailableAccounts([]);
          setAccount(null);
          setStatus("no_access");
          setErrorMessage(
            "Usuario autenticado sem acesso a nenhuma conta disponivel.",
          );
          return;
        }

        const storedAccountId = localStorage.getItem(
          getStorageKey(authenticatedProfile.id),
        );

        const selectedAccount =
          accounts.find((item) => item.accountId === storedAccountId) ??
          accounts[0] ??
          null;

        setAvailableAccounts(accounts);
        setAccount(selectedAccount);
        setStatus("ready");
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAvailableAccounts([]);
        setAccount(null);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar contas acessiveis.",
        );
      }
    }

    void loadAccounts();

    return () => {
      isMounted = false;
    };
  }, [authenticatedProfile?.id, clearAccount, isAuthenticated, sessionSource]);

  const value = useMemo(
    () => ({
      account,
      availableAccounts,
      isLoading: status === "loading",
      isUsingMock: status === "mock",
      status,
      errorMessage,
      selectAccount,
      clearAccount,
    }),
    [account, availableAccounts, clearAccount, errorMessage, selectAccount, status],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);

  if (!context) {
    throw new Error("useAccount must be used within AccountProvider");
  }

  return context;
}
