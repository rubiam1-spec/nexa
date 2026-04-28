import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getAuthenticatedProfile } from "../../infra/repositories/profileSupabaseRepository";
import { isSupabaseConfigured, supabase } from "../../infra/supabase/supabaseClient";
import { isMockFallbackEnabled } from "../../shared/config/runtime";
import {
  getCurrentSession,
  onAuthStateChange,
  signIn,
  signOut,
} from "../../modules/auth/services/supabaseAuthService";
import type { AuthenticatedProfile, AuthUser } from "../../shared/types/auth";

const AUTH_INIT_TIMEOUT_MS = 4000;
const AUTH_SAFETY_NET_MS = 6000;

function clearLocalSupabaseTokens(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("sb-") || k.includes("supabase") || k.includes("auth-token")) {
        keys.push(k);
      }
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

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
  avatarUrl: null,
  phone: null,
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

function friendlyAuthError(rawMessage: string | null | undefined): string {
  if (!rawMessage) return "Erro ao entrar. Tente novamente.";
  const msg = rawMessage.toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (msg.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timed out") || msg.includes("timeout")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("user not found")) {
    return "Usuário não encontrado.";
  }
  return "Erro ao entrar. Tente novamente.";
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
  const hasHydratedOnce = useRef(false);

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
      hasHydratedOnce.current = true;
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
          // Only show loading on first hydration — after that, sync silently
          // This prevents the visual reload when switching windows
          if (!hasHydratedOnce.current) {
            setIsInitializing(true);
            setStatus("loading");
          }
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

        let sessionData: Awaited<ReturnType<typeof getCurrentSession>>["data"] | null = null;
        let sessionFailed = false;

        try {
          const result = await withTimeout(
            getCurrentSession(),
            "getCurrentSession",
          );
          if (result.error) {
            sessionFailed = true;
            if (import.meta.env.DEV) {
              console.warn("AuthContext: getCurrentSession returned error", result.error);
            }
          } else {
            sessionData = result.data;
          }
        } catch (err) {
          // Timeout, network hiccup, or corrupted local token.
          // Treat as "no session" silently — the user simply sees the login form.
          sessionFailed = true;
          if (import.meta.env.DEV) {
            console.warn("AuthContext: session restore failed (will clear local tokens)", err);
          }
        }

        debugAuthLog("AuthContext: session fetched", {
          hasSession: Boolean(sessionData?.session),
          hasUser: Boolean(sessionData?.session?.user),
          sessionFailed,
        });

        if (sessionFailed) {
          // Wipe any partially-loaded or corrupt local auth state so the next
          // attempt starts clean. Scope "local" avoids hitting the network.
          if (supabase) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          }
          setUnauthenticatedState();
          return;
        }

        await syncSession(sessionData?.session ?? null);
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

      // Skip events that don't change the user — prevents visual reload on window focus
      if (_event === "TOKEN_REFRESHED" || _event === "INITIAL_SESSION") {
        return Promise.resolve();
      }

      void syncSession(session);
      return Promise.resolve();
    });

    return () => {
      isMounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  // Safety net: if initialization runs longer than AUTH_SAFETY_NET_MS, wipe any
  // corrupt local tokens and force the unauthenticated state so the user always
  // lands on the login form instead of a frozen loading screen.
  useEffect(() => {
    if (!isInitializing) return;
    const timer = window.setTimeout(() => {
      console.warn(`AuthContext: safety net reached (${AUTH_SAFETY_NET_MS}ms) — forcing unauthenticated`);
      if (supabase) {
        supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      clearLocalSupabaseTokens();
      setUser(null);
      setAuthenticatedProfile(null);
      setSessionSource(null);
      setStatus(isSupabaseConfigured ? "unauthenticated" : "env_not_configured");
      setErrorMessage(null);
      setIsInitializing(false);
    }, AUTH_SAFETY_NET_MS);
    return () => window.clearTimeout(timer);
  }, [isInitializing]);

  async function handleSignIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return "Supabase nao configurado neste ambiente.";
    }

    const { error } = await signIn(email, password);

    if (!error && supabase) {
      // Log successful auth event (fire-and-forget)
      const sb = supabase;
      sb.auth.getUser().then(({ data }) => {
        if (data.user) {
          sb.rpc("log_auth_event", {
            p_user_id: data.user.id,
            p_event_type: "login",
            p_email: data.user.email || email,
            p_metadata: JSON.stringify({ method: "email_password" }),
          }).then(() => {}, () => {});
        }
      });
    }

    return error ? friendlyAuthError(error.message) : null;
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
        // Log logout event before signing out (fire-and-forget)
        if (supabase && user) {
          supabase.rpc("log_auth_event", {
            p_user_id: user.id,
            p_event_type: "logout",
            p_email: user.email || "",
            p_metadata: JSON.stringify({}),
          }).then(() => {}, () => {});
        }
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
