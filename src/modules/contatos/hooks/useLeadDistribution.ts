import { useCallback, useState } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

export type DistributeResult =
  | { ok: true; consultantId: string }
  | { ok: false; error: string };

/**
 * Distribuição manual de um contato sem responsável via RPC distribute_lead.
 * A regra (permissão, round-robin, log) vive no banco; o hook só dispara e
 * traduz os erros conhecidos em mensagens de toast.
 */
export function useLeadDistribution() {
  const [distributingId, setDistributingId] = useState<string | null>(null);

  const distribute = useCallback(async (clientId: string): Promise<DistributeResult> => {
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    setDistributingId(clientId);
    try {
      const { data, error } = await supabase.rpc("distribute_lead", { p_client_id: clientId });
      if (error) {
        const m = error.message || "";
        const friendly = m.includes("sem permissão")
          ? "Sem permissão para distribuir"
          : m.includes("rodízio vazio")
          ? "Rodízio vazio — ative participantes em Configurações"
          : m.includes("cliente inexistente")
          ? "Contato não encontrado"
          : "Não foi possível distribuir";
        return { ok: false, error: friendly };
      }
      return { ok: true, consultantId: data as string };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao distribuir" };
    } finally {
      setDistributingId(null);
    }
  }, []);

  return { distribute, distributingId };
}
