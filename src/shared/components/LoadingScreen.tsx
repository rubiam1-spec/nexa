import { useEffect, useState } from "react";

function clearSupabaseStorage(): void {
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
    /* storage may be unavailable in private mode — nothing to clear */
  }
}

function forceLoginReset(): void {
  clearSupabaseStorage();
  window.location.href = "/entrar";
}

interface LoadingScreenProps {
  /** Optional label override (e.g. "Carregando sessão..."). */
  label?: string;
  /** Show retry CTA after this many seconds. Default: 4s. */
  retryAfterSeconds?: number;
  /** Hard-recover after this many seconds (clears storage, goes to /entrar). Default: 8s. */
  autoRecoverAfterSeconds?: number;
}

export default function LoadingScreen({
  label,
  retryAfterSeconds = 4,
  autoRecoverAfterSeconds = 8,
}: LoadingScreenProps = {}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (seconds < autoRecoverAfterSeconds) return;
    console.warn(`LoadingScreen: auto-recovery triggered after ${autoRecoverAfterSeconds}s`);
    forceLoginReset();
  }, [seconds, autoRecoverAfterSeconds]);

  const showRetry = seconds >= retryAfterSeconds;
  const resolvedLabel = label ?? (seconds < 3 ? "Carregando..." : "Reconectando...");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-base, #12110F)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "var(--surface-raised, #1C1B18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border-default, #2A2822)",
        }}
      >
        <span
          style={{
            color: "var(--interactive-primary, #4ADE80)",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          N
        </span>
      </div>

      <div
        style={{
          width: 24,
          height: 24,
          border: "2px solid rgba(74,222,128,0.2)",
          borderTopColor: "var(--interactive-primary, #4ADE80)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
        aria-hidden="true"
      />

      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 12,
          color: "var(--text-muted, #9C9686)",
          letterSpacing: "0.04em",
        }}
        role="status"
        aria-live="polite"
      >
        {resolvedLabel}
      </span>

      {showRetry ? (
        <button
          type="button"
          onClick={forceLoginReset}
          style={{
            marginTop: 8,
            padding: "10px 20px",
            minHeight: 44,
            borderRadius: 8,
            border: "1px solid var(--border-default, #2A2822)",
            background: "transparent",
            color: "var(--text-tertiary, #C4BFB3)",
            fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 150ms ease, color 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(156,150,134,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          Entrar novamente
        </button>
      ) : null}
    </div>
  );
}
