import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthenticatedProfile } from "../../infra/repositories/profileSupabaseRepository";
import { isSupabaseConfigured } from "../../infra/supabase/supabaseClient";
import { isMockFallbackEnabled } from "../../shared/config/runtime";
import {
  getCurrentSession,
  onAuthStateChange,
  signIn,
  signOut,
} from "../../modules/auth/services/supabaseAuthService";
import type { AuthenticatedProfile, AuthUser } from "../../shared/types/auth";

const AUTH_INIT_TIMEOUT_MS = 8000;

type AuthStatus =
  | "loading"
  | "env_not_configured"
  | "unauthenticated"
  | "authenticated"
  | "profile_missing"
  | "error";

type AuthContextValue = {
  user: AuthUser | null;
  authenticatedProfile: AuthenticatedProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  status: AuthStatus;
  errorMessage: string | null;
  sessionSource: "mock" | "supabase" | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInMock: () => void;
  signOut: () => Promise<void>;
  signOutMock: () => Promise<void>;
};

const mockUser: AuthUser = {
  id: "user_1",
  name: "Ana Souza",
  email: "ana@nexa.local",
  role: "director",
};

const mockProfile: AuthenticatedProfile = {
  id: mockUser.id,
  fullName: mockUser.name,
  email: mockUser.email,
  status: "active",
  role: mockUser.role,
};

function debugAuthLog(message: string, payload?: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  if (payload === undefined) {
    console.log(message);
    return;
  }

  console.log(message, payload);
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapProfileToUser(profile: AuthenticatedProfile): AuthUser {
  return {
    id: profile.id,
    name: profile.fullName,
    email: profile.email,
    role: profile.role,
  };
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${AUTH_INIT_TIMEOUT_MS}ms.`));
      }, AUTH_INIT_TIMEOUT_MS);
    }),
  ]);
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authenticatedProfile, setAuthenticatedProfile] =
    useState<AuthenticatedProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionSource, setSessionSource] = useState<"mock" | "supabase" | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    function setUnauthenticatedState() {
      if (!isMounted) {
        return;
      }

      setUser(null);
      setAuthenticatedProfile(null);
      setSessionSource(null);
      setStatus(isSupabaseConfigured ? "unauthenticated" : "env_not_configured");
      setErrorMessage(null);
    }

    function setProfileMissingState() {
      if (!isMounted) {
        return;
      }

      setUser(null);
      setAuthenticatedProfile(null);
      setSessionSource("supabase");
      setStatus("profile_missing");
      setErrorMessage("Usuario autenticado sem profile valido no banco.");
    }

    function setAuthenticatedState(profile: AuthenticatedProfile) {
      if (!isMounted) {
        return;
      }

      setAuthenticatedProfile(profile);
      setUser(mapProfileToUser(profile));
      setSessionSource("supabase");
      setStatus("authenticated");
      setErrorMessage(null);
    }

    function setErrorState(message: string) {
      if (!isMounted) {
        return;
      }

      setUser(null);
      setAuthenticatedProfile(null);
      setSessionSource(null);
      setStatus("error");
      setErrorMessage(message);
    }

    async function syncSession(session: Awaited<ReturnType<typeof getCurrentSession>>["data"]["session"]) {
      debugAuthLog("AuthContext: syncSession start", {
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
      });

      try {
        if (isMounted) {
          setIsInitializing(true);
          setStatus("loading");
          setErrorMessage(null);
        }

        if (!isSupabaseConfigured) {
          if (isMounted) {
            setStatus("env_not_configured");
            setErrorMessage(null);
          }
          return;
        }

        if (!session?.user) {
          setUnauthenticatedState();
          debugAuthLog("AuthContext: syncSession unauthenticated");
          return;
        }

        const profile = await withTimeout(
          getAuthenticatedProfile(session.user.id),
          "getAuthenticatedProfile",
        );

        if (!profile) {
          setProfileMissingState();
          debugAuthLog("AuthContext: syncSession profile missing");
          return;
        }

        setAuthenticatedState(profile);
        debugAuthLog("AuthContext: syncSession authenticated");
      } catch (error) {
        setErrorState(
          error instanceof Error
            ? error.message
            : "Falha ao sincronizar sessao do usuario.",
        );
        if (import.meta.env.DEV) {
          console.error("AuthContext: syncSession error", error);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }

        debugAuthLog("AuthContext: syncSession end", {
          isMounted,
        });
      }
    }

    async function hydrateCurrentSession() {
      debugAuthLog("AuthContext: init start");

      try {
        if (!isMounted) {
          return;
        }

        if (!isSupabaseConfigured) {
          await syncSession(null);
          return;
        }

        const { data, error } = await withTimeout(
          getCurrentSession(),
          "getCurrentSession",
        );

        debugAuthLog("AuthContext: session fetched", {
          hasSession: Boolean(data.session),
          hasUser: Boolean(data.session?.user),
          hasError: Boolean(error),
        });

        if (error) {
          throw error;
        }

        await syncSession(data.session);
      } catch (error) {
        setErrorState(
          error instanceof Error
            ? error.message
            : "Falha ao carregar sessao do usuario.",
        );
        if (import.meta.env.DEV) {
          console.error("AuthContext: init error", error);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }

        debugAuthLog("AuthContext: isInitializing false");
      }
    }

    void hydrateCurrentSession();

    const subscription = onAuthStateChange(async (_event, session) => {
      if (!isMounted) {
        return;
      }

      debugAuthLog("AuthContext: auth state change", {
        event: _event,
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
      });

      void syncSession(session);
      return Promise.resolve();
    });

    return () => {
      isMounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  async function handleSignIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return "Supabase nao configurado neste ambiente.";
    }

    const { error } = await signIn(email, password);

    return error?.message ?? null;
  }

  function handleSignInMock() {
    if (!isMockFallbackEnabled) {
      setStatus(isSupabaseConfigured ? "error" : "env_not_configured");
      setErrorMessage(
        "Fallback mock desativado neste ambiente. Configure o Supabase real para continuar.",
      );
      return;
    }

    setAuthenticatedProfile(mockProfile);
    setUser(mockUser);
    setSessionSource("mock");
    setStatus("authenticated");
    setIsInitializing(false);
    setErrorMessage(null);
  }

  async function handleSignOut() {
    try {
      if (sessionSource === "supabase" && isSupabaseConfigured) {
        setIsInitializing(true);
        await signOut();
      }
    } finally {
      setIsInitializing(false);
      debugAuthLog("AuthContext: signOut finished");
    }

    setUser(null);
    setAuthenticatedProfile(null);
    setSessionSource(null);
    setStatus(isSupabaseConfigured ? "unauthenticated" : "env_not_configured");
    setErrorMessage(null);
  }

  const value = useMemo(
    () => ({
      user,
      authenticatedProfile,
      isAuthenticated: authenticatedProfile !== null,
      isLoading: isInitializing,
      status,
      errorMessage,
      sessionSource,
      signIn: handleSignIn,
      signInMock: handleSignInMock,
      signOut: handleSignOut,
      signOutMock: handleSignOut,
    }),
    [authenticatedProfile, errorMessage, isInitializing, sessionSource, status, user],
  );

  debugAuthLog("AuthContext: render", {
    isInitializing,
    status,
    sessionSource,
    isAuthenticated: authenticatedProfile !== null,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
