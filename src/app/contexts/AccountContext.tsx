import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getAccessibleAccounts } from "../../infra/repositories/accountSupabaseRepository";
import { isSupabaseConfigured, supabase } from "../../infra/supabase/supabaseClient";
import { isMockFallbackEnabled } from "../../shared/config/runtime";
import type { AccountContextData } from "../../shared/types/account";
import {
  sanitizeRoleOverrides,
  type RolePermissionOverrides,
} from "../../shared/constants/permissionPresets";
import { useBrokerProfile } from "../../shared/hooks/useBrokerProfile";
import { useAuth } from "./AuthContext";

type AccountStatus = "idle" | "loading" | "mock" | "ready" | "no_access" | "error";

type AccountContextValue = {
  account: AccountContextData | null;
  availableAccounts: AccountContextData[];
  isLoading: boolean;
  isUsingMock: boolean;
  status: AccountStatus;
  errorMessage: string | null;
  brokerId: string | null;
  isBroker: boolean;
  isBrokerManager: boolean;
  brokerageId: string | null;
  isConsultant: boolean;
  ownerProfileId: string | null;
  rolePermissionOverrides: RolePermissionOverrides | null;
  reloadRolePermissionOverrides: () => Promise<void>;
  selectAccount: (accountId: string) => void;
  clearAccount: () => void;
};

const mockAccount: AccountContextData = {
  accountId: "account_1",
  accountName: "NEXA Workspace",
  slug: "nexa-workspace",
  role: "director",
  permissionOverrides: null,
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
  const brokerProfile = useBrokerProfile(authenticatedProfile?.id, account?.role);
  const [availableAccounts, setAvailableAccounts] = useState<AccountContextData[]>(
    [],
  );
  const [status, setStatus] = useState<AccountStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rolePermissionOverrides, setRolePermissionOverrides] =
    useState<RolePermissionOverrides | null>(null);

  const clearAccount = useCallback(() => {
    setAccount(null);
    setAvailableAccounts([]);
    setStatus("idle");
    setErrorMessage(null);
    setRolePermissionOverrides(null);
  }, []);

  const loadRolePermissionOverrides = useCallback(async (accountId: string) => {
    if (!supabase) { setRolePermissionOverrides(null); return; }
    try {
      const { data } = await supabase
        .from("account_settings")
        .select("role_permission_overrides")
        .eq("account_id", accountId)
        .maybeSingle();
      const raw = (data as { role_permission_overrides?: unknown } | null)?.role_permission_overrides;
      setRolePermissionOverrides(sanitizeRoleOverrides(raw));
    } catch {
      // RLS ou falha pontual: segue com null — hook cai no preset + override individual.
      setRolePermissionOverrides(null);
    }
  }, []);

  const reloadRolePermissionOverrides = useCallback(async () => {
    if (!account?.accountId) return;
    await loadRolePermissionOverrides(account.accountId);
  }, [account?.accountId, loadRolePermissionOverrides]);

  // Carrega role_permission_overrides quando a conta ativa muda.
  // Lógica inline (em vez de chamar loadRolePermissionOverrides direto) para
  // que o React Compiler reconheça o setState como em callback async, não
  // como call síncrono no body do effect.
  useEffect(() => {
    const id = account?.accountId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      if (!supabase) {
        if (!cancelled) setRolePermissionOverrides(null);
        return;
      }
      try {
        const { data } = await supabase
          .from("account_settings")
          .select("role_permission_overrides")
          .eq("account_id", id)
          .maybeSingle();
        if (cancelled) return;
        const raw = (data as { role_permission_overrides?: unknown } | null)?.role_permission_overrides;
        setRolePermissionOverrides(sanitizeRoleOverrides(raw));
      } catch {
        if (!cancelled) setRolePermissionOverrides(null);
      }
    })();
    return () => { cancelled = true; };
  }, [account?.accountId]);

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
        setRolePermissionOverrides(null);
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
          setRolePermissionOverrides(null);
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
      isLoading: status === "loading" || brokerProfile.loading,
      isUsingMock: status === "mock",
      status,
      errorMessage,
      brokerId: brokerProfile.brokerId,
      isBroker: brokerProfile.isBroker,
      isBrokerManager: brokerProfile.isBrokerManager,
      brokerageId: brokerProfile.brokerageId,
      isConsultant: account?.role === "commercial_consultant",
      ownerProfileId: account?.role === "commercial_consultant" ? authenticatedProfile?.id ?? null : null,
      rolePermissionOverrides,
      reloadRolePermissionOverrides,
      selectAccount,
      clearAccount,
    }),
    [account, authenticatedProfile?.id, availableAccounts, brokerProfile.brokerId, brokerProfile.isBroker, brokerProfile.isBrokerManager, brokerProfile.brokerageId, brokerProfile.loading, clearAccount, errorMessage, reloadRolePermissionOverrides, rolePermissionOverrides, selectAccount, status],
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
