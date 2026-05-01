import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getDevelopmentsByAccountId } from "../../infra/repositories/developmentsSupabaseRepository";
import { getDevelopments as getMockDevelopments } from "../../modules/developments/repositories/developmentsRepository";
import { isSupabaseConfigured } from "../../infra/supabase/supabaseClient";
import { isMockFallbackEnabled } from "../../shared/config/runtime";
import type { DevelopmentContextData } from "../../shared/types/development";
import { useAccount } from "./AccountContext";
import { useAuth } from "./AuthContext";

type DevelopmentStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "empty"
  | "error";

type DevelopmentContextValue = {
  development: DevelopmentContextData | null;
  availableDevelopments: DevelopmentContextData[];
  isLoading: boolean;
  isUsingMock: boolean;
  status: DevelopmentStatus;
  errorMessage: string | null;
  selectDevelopment: (developmentId: string) => void;
  clearDevelopment: () => void;
};

const DevelopmentContext = createContext<DevelopmentContextValue | undefined>(
  undefined,
);

function getStorageKey(accountId: string) {
  return `nexa.activeDevelopment.${accountId}`;
}

export default function DevelopmentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { account } = useAccount();
  const { authenticatedProfile, isAuthenticated, sessionSource } = useAuth();
  const [development, setDevelopment] = useState<DevelopmentContextData | null>(
    null,
  );
  const [availableDevelopments, setAvailableDevelopments] = useState<
    DevelopmentContextData[]
  >([]);
  const [status, setStatus] = useState<DevelopmentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectDevelopment = useCallback(
    (developmentId: string) => {
      const selectedDevelopment =
        availableDevelopments.find((item) => item.developmentId === developmentId) ??
        null;

      if (selectedDevelopment?.status !== "active") {
        return;
      }

      setDevelopment(selectedDevelopment);
      localStorage.setItem(
        getStorageKey(selectedDevelopment.accountId),
        selectedDevelopment.developmentId,
      );
    },
    [availableDevelopments],
  );

  const clearDevelopment = useCallback(() => {
    if (account) {
      localStorage.removeItem(getStorageKey(account.accountId));
    }

    setDevelopment(null);
  }, [account?.accountId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDevelopments() {
      if (!isAuthenticated || !authenticatedProfile || !account) {
        setAvailableDevelopments([]);
        setDevelopment(null);
        setStatus("idle");
        setErrorMessage(null);
        return;
      }

      setStatus("loading");

      if (sessionSource === "mock" || (!isSupabaseConfigured && isMockFallbackEnabled)) {
        const accountDevelopments = getMockDevelopments(account.accountId);

        if (!isMounted) {
          return;
        }

        const storedDevelopmentId = localStorage.getItem(
          getStorageKey(account.accountId),
        );

        const selectedDevelopment =
          accountDevelopments.find(
            (item) => item.developmentId === storedDevelopmentId,
          ) ?? null;

        setAvailableDevelopments(accountDevelopments);
        setDevelopment(selectedDevelopment);
        setStatus(accountDevelopments.length > 0 ? "mock" : "empty");
        setErrorMessage(
          accountDevelopments.length > 0
            ? null
            : "Nenhum empreendimento disponível para a conta ativa.",
        );
        return;
      }

      if (!isSupabaseConfigured) {
        if (!isMounted) {
          return;
        }

        setAvailableDevelopments([]);
        setDevelopment(null);
        setStatus("error");
        setErrorMessage(
          "Supabase nao configurado para carregar empreendimentos reais neste ambiente.",
        );
        return;
      }

      try {
        const developments = await getDevelopmentsByAccountId(account.accountId);

        if (!isMounted) {
          return;
        }

        if (developments.length === 0) {
          setAvailableDevelopments([]);
          setDevelopment(null);
          setStatus("empty");
          setErrorMessage(
            "A conta ativa nao possui empreendimentos disponiveis.",
          );
          return;
        }

        const storedDevelopmentId = localStorage.getItem(
          getStorageKey(account.accountId),
        );

        const selectedDevelopment =
          developments.find(
            (item) => item.developmentId === storedDevelopmentId,
          ) ?? null;

        setAvailableDevelopments(developments);
        setDevelopment(selectedDevelopment);
        setStatus("ready");
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAvailableDevelopments([]);
        setDevelopment(null);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar empreendimentos da conta ativa.",
        );
      }
    }

    void loadDevelopments();

    return () => {
      isMounted = false;
    };
  }, [account?.accountId, authenticatedProfile?.id, isAuthenticated, sessionSource]);

  const value = useMemo(
    () => ({
      development,
      availableDevelopments,
      isLoading: status === "loading",
      isUsingMock: status === "mock",
      status,
      errorMessage,
      selectDevelopment,
      clearDevelopment,
    }),
    [
      availableDevelopments,
      clearDevelopment,
      development,
      errorMessage,
      selectDevelopment,
      status,
    ],
  );

  return (
    <DevelopmentContext.Provider value={value}>
      {children}
    </DevelopmentContext.Provider>
  );
}

export function useDevelopment() {
  const context = useContext(DevelopmentContext);

  if (!context) {
    throw new Error("useDevelopment must be used within DevelopmentProvider");
  }

  return context;
}
