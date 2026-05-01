import { useEffect, useState } from "react";
import { LOGIN_MURAL_FALLBACK, type LoginMuralItem } from "../types/loginMural";
import { SHOW_LOGIN_MURAL } from "../config";

const EDGE_FUNCTION_URL =
  "https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/get-login-mural-item";

// Cache em memória (module-level) — evita refetch em re-renders de React
// e mantém a frase estável durante a sessão atual.
let memoryCache: LoginMuralItem | null = null;
let inFlight: Promise<LoginMuralItem> | null = null;

async function fetchMuralItem(): Promise<LoginMuralItem> {
  if (memoryCache) return memoryCache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "GET",
        // A função é pública (verify_jwt=false) — não precisamos enviar token.
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as LoginMuralItem;
      if (!data || typeof data.headline !== "string" || data.headline.length === 0) {
        throw new Error("invalid payload");
      }
      memoryCache = data;
      return data;
    } catch {
      // Sem quebrar a tela: sempre devolve algo.
      memoryCache = LOGIN_MURAL_FALLBACK;
      return LOGIN_MURAL_FALLBACK;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export interface UseLoginMuralResult {
  item: LoginMuralItem | null;
  loading: boolean;
}

export function useLoginMural(): UseLoginMuralResult {
  const [item, setItem] = useState<LoginMuralItem | null>(memoryCache);
  const [loading, setLoading] = useState<boolean>(
    SHOW_LOGIN_MURAL ? memoryCache === null : false,
  );

  useEffect(() => {
    // Feature flag desligada: não bate na Edge Function. Componente
    // LoginMural permanece no código, apenas dormente.
    if (!SHOW_LOGIN_MURAL) return;

    let mounted = true;
    if (memoryCache) {
      if (item !== memoryCache) setItem(memoryCache);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    void fetchMuralItem().then((result) => {
      if (!mounted) return;
      setItem(result);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SHOW_LOGIN_MURAL) return { item: null, loading: false };
  return { item, loading };
}

// Exposto apenas para testes unitários.
export const __TEST__ = {
  reset: () => {
    memoryCache = null;
    inFlight = null;
  },
  getCache: () => memoryCache,
  EDGE_FUNCTION_URL,
};
