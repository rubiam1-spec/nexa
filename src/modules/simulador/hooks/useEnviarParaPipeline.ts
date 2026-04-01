import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";

export interface SimInput {
  unitId: string; clientId: string | null; brokerId: string | null;
  valorTotal: number; entradaPercentual: number; entradaValor: number;
  parcelasQuantidade: number; parcelasValor: number;
  balaoQuantidade?: number; balaoValor?: number; permutaValor?: number; permutaDescricao?: string;
  editingSimulationId?: string | null;
  followUpAt?: Date | null;
}

export function useEnviarParaPipeline(accountId: string | null, developmentId: string | null) {
  const navigate = useNavigate();
  const { authenticatedProfile } = useAuth();
  const { brokerId, isBroker } = useAccount();
  const userId = authenticatedProfile?.id ?? null;
  const [salvando, setSalvando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const salvarComoSimulacao = useCallback(async (input: SimInput) => {
    setSalvando(true); setErro(null); setSucesso(null);
    try {
      if (!supabase) throw new Error("Supabase não configurado.");
      if (!accountId || !developmentId) throw new Error("Selecione uma conta e empreendimento.");
      if (!input.unitId) throw new Error("Selecione uma unidade.");

      const effectiveBrokerId = isBroker ? brokerId : input.brokerId;
      const payload: Record<string, unknown> = {
        account_id: accountId, development_id: developmentId, unit_id: input.unitId,
        client_id: input.clientId, broker_id: effectiveBrokerId,
        valor_total: input.valorTotal, entrada_percentual: input.entradaPercentual, entrada_valor: input.entradaValor,
        parcelas_quantidade: input.parcelasQuantidade, parcelas_valor: input.parcelasValor,
        balao_quantidade: input.balaoQuantidade ?? null, balao_valor: input.balaoValor ?? null,
        permuta_valor: input.permutaValor ?? null, permuta_descricao: input.permutaDescricao ?? null,
        status: "ativa",
      };
      if (userId) payload.created_by = userId;
      if (input.followUpAt) payload.follow_up_at = input.followUpAt.toISOString();

      if (input.editingSimulationId) {
        const { error } = await supabase.from("pipeline_simulations").update(payload).eq("id", input.editingSimulationId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pipeline_simulations").insert(payload);
        if (error) throw error;
      }

      setSucesso(input.editingSimulationId ? "Simulação atualizada!" : "Simulação salva com sucesso!");
      setTimeout(() => navigate("/pipeline"), 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar simulação.";
      console.error("[NEXA] salvarComoSimulacao error:", msg);
      setErro(msg);
    } finally { setSalvando(false); }
  }, [accountId, developmentId, isBroker, brokerId, userId, navigate]);

  const iniciarNegociacao = useCallback(async (input: SimInput) => {
    setIniciando(true); setErro(null); setSucesso(null);
    try {
      if (!supabase) throw new Error("Supabase não configurado.");
      if (!accountId || !developmentId) throw new Error("Selecione uma conta e empreendimento.");
      if (!input.unitId) throw new Error("Selecione uma unidade.");
      if (!input.clientId) throw new Error("Selecione um cliente para iniciar a negociação.");

      // Check if unit is already in an active negotiation
      const { data: existing } = await supabase.from("negotiations").select("id, clients ( name )").eq("unit_id", input.unitId).eq("account_id", accountId).not("status", "in", '("WON","LOST","CANCELLED")').limit(1);
      if (existing && existing.length > 0) {
        const cl = Array.isArray((existing[0] as Record<string, unknown>).clients) ? ((existing[0] as Record<string, unknown>).clients as Record<string, unknown>[])[0] : (existing[0] as Record<string, unknown>).clients;
        throw new Error(`Unidade já em negociação com ${(cl as Record<string, unknown>)?.name || "outro cliente"}. Acesse o pipeline.`);
      }

      const effectiveBrokerId = isBroker ? brokerId : input.brokerId;
      const payload: Record<string, unknown> = {
        account_id: accountId, development_id: developmentId,
        unit_id: input.unitId, client_id: input.clientId,
        broker_id: effectiveBrokerId, status: "IN_PROGRESS",
      };
      if (userId) payload.owner_profile_id = userId;

      console.log("[NEXA] iniciarNegociacao payload:", payload);
      const { error: nErr } = await supabase.from("negotiations").insert(payload);
      if (nErr) throw nErr;

      setSucesso("Negociação criada com sucesso!");
      setTimeout(() => navigate("/pipeline"), 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar negociação.";
      console.error("[NEXA] iniciarNegociacao error:", msg);
      setErro(msg);
    } finally { setIniciando(false); }
  }, [accountId, developmentId, isBroker, brokerId, userId, navigate]);

  return { salvarComoSimulacao, iniciarNegociacao, salvando, iniciando, erro, setErro, sucesso, setSucesso };
}
