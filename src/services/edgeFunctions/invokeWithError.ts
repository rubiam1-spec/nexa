// Wrapper único de supabase.functions.invoke que expõe a mensagem REAL de erro
// das nossas Edge Functions. Padrão do projeto: em falha, a function responde com
// JSON { error: "<mensagem>" } e status não-2xx. O supabase-js descarta esse corpo
// e devolve apenas um genérico ("Edge Function returned a non-2xx status code").
// Aqui lemos error.context (o Response cru) e extraímos o campo `error`.
//
// Regra fora da UI: NENHUM componente faz parsing de Response — o parsing vive aqui.
import { supabase } from "../../infra/supabase/supabaseClient";

export type EdgeInvokeResult<T> = {
  data: T | null;
  errorMessage: string | null;
};

const GENERIC_ERROR = "Não foi possível completar a solicitação. Tente novamente.";

// Lê o corpo JSON do Response anexado ao erro do supabase-js (FunctionsHttpError.context)
// e devolve o campo `error` quando presente. Qualquer falha de parsing → null (fallback).
async function readEdgeErrorMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as Response).json !== "function") return null;
  try {
    const body = await (context as Response).json();
    const message = (body as { error?: unknown })?.error;
    return typeof message === "string" && message.trim() ? message.trim() : null;
  } catch {
    return null; // corpo não-JSON ou já consumido: cai no fallback do chamador
  }
}

/**
 * Invoca uma Edge Function e retorna sempre { data, errorMessage }.
 * - errorMessage traz a mensagem REAL em PT-BR quando a function a fornece ({ error }).
 * - Fallback para a mensagem do supabase-js e, por fim, uma genérica.
 * - Também trata o caso 2xx que carrega { error } no corpo (contrato do projeto).
 */
export async function invokeWithError<T = unknown>(
  functionName: string,
  options?: { body?: Record<string, unknown>; headers?: Record<string, string> },
): Promise<EdgeInvokeResult<T>> {
  if (!supabase) {
    return { data: null, errorMessage: "Supabase não configurado." };
  }

  const { data, error } = await supabase.functions.invoke<T>(functionName, options);

  if (error) {
    const real = await readEdgeErrorMessage(error);
    return {
      data: null,
      errorMessage: real ?? (error instanceof Error && error.message ? error.message : GENERIC_ERROR),
    };
  }

  // Contrato do projeto: algumas functions respondem 2xx com { error } no corpo.
  const bodyError = (data as { error?: unknown } | null)?.error;
  if (typeof bodyError === "string" && bodyError.trim()) {
    return { data: null, errorMessage: bodyError.trim() };
  }

  return { data, errorMessage: null };
}
