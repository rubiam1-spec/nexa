import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { createSimulation, updateSimulation, type SimulationWriteInput } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";
import { createNegotiationForConversion } from "../../../infra/repositories/negotiationsSupabaseRepository";

export interface SimInput {
  unitId: string; clientId: string | null; brokerId: string | null;
  propertyId?: string | null; propertyName?: string | null;
  valorTotal: number; entradaPercentual: number; entradaValor: number;
  parcelasQuantidade: number; parcelasValor: number;
  balaoQuantidade?: number; balaoValor?: number; permutaValor?: number; permutaDescricao?: string;
  editingSimulationId?: string | null;
  followUpAt?: Date | null;
  /** Engrenagem Comercial v1 — vincula simulação a uma negociação existente. */
  negotiationId?: string | null;
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
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const salvarComoSimulacao = useCallback(async (input: SimInput) => {
    setSalvando(true); setErro(null); setSucesso(null);
    try {
      if (!supabase) throw new Error("Supabase não configurado.");
      if (!accountId || !developmentId) throw new Error("Selecione uma conta e empreendimento.");
      if (!input.unitId && !input.propertyId) throw new Error("Selecione uma unidade ou imóvel.");

      const effectiveBrokerId = isBroker ? brokerId : input.brokerId;
      // Escrita via repositório (Etapa 5c). created_by/follow_up_at só entram quando
      // presentes — o builder do repo espelha o payload inline anterior.
      const simInput: SimulationWriteInput = {
        accountId, developmentId,
        unitId: input.unitId || null,
        clientId: input.clientId, brokerId: effectiveBrokerId,
        valorTotal: input.valorTotal, entradaPercentual: input.entradaPercentual, entradaValor: input.entradaValor,
        parcelasQuantidade: input.parcelasQuantidade, parcelasValor: input.parcelasValor,
        balaoQuantidade: input.balaoQuantidade ?? null, balaoValor: input.balaoValor ?? null,
        permutaValor: input.permutaValor ?? null, permutaDescricao: input.permutaDescricao ?? null,
        thirdPartyPropertyId: input.propertyId || null, propertyName: input.propertyName || null,
        negotiationId: input.negotiationId ?? null,
        createdBy: userId, followUpAt: input.followUpAt ?? null,
      };

      let savedId: string | null = null;
      if (input.editingSimulationId) {
        await updateSimulation(input.editingSimulationId, simInput);
        savedId = input.editingSimulationId;
      } else {
        savedId = await createSimulation(simInput);
      }

      setSucesso(input.editingSimulationId ? "Simulação atualizada!" : "Simulação salva com sucesso!");
      setLastSavedId(savedId);
      // Engrenagem v1: quando a simulação está vinculada a uma negociação,
      // mantemos o usuário na tela para que ele decida (criar proposta ou não).
      if (!input.negotiationId) {
        setTimeout(() => navigate("/pipeline"), 1500);
      }
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
      if (!input.unitId && !input.propertyId) throw new Error("Selecione uma unidade ou imóvel.");
      if (!input.clientId) throw new Error("Selecione um cliente para iniciar a negociação.");

      // Check if unit is already in an active negotiation (only for units, not third-party properties)
      if (input.unitId) {
        const { data: existing } = await supabase.from("negotiations").select("id, clients ( name )").eq("unit_id", input.unitId).eq("account_id", accountId).not("status", "in", '("WON","LOST","CANCELLED")').limit(1);
        if (existing && existing.length > 0) {
          const cl = Array.isArray((existing[0] as Record<string, unknown>).clients) ? ((existing[0] as Record<string, unknown>).clients as Record<string, unknown>[])[0] : (existing[0] as Record<string, unknown>).clients;
          throw new Error(`Unidade já em negociação com ${(cl as Record<string, unknown>)?.name || "outro cliente"}. Acesse o pipeline.`);
        }
      }

      const effectiveBrokerId = isBroker ? brokerId : input.brokerId;
      // Escrita via repositório (Etapa 5c). createNegotiationForConversion grava status
      // IN_PROGRESS + owner (quando presente); sem unidade vira negociação sem unit_id.
      await createNegotiationForConversion({
        accountId, developmentId,
        unitId: input.unitId || null,
        clientId: input.clientId,
        brokerId: effectiveBrokerId,
        ownerProfileId: userId,
      });

      setSucesso("Negociação criada com sucesso!");
      setTimeout(() => navigate("/pipeline"), 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar negociação.";
      console.error("[NEXA] iniciarNegociacao error:", msg);
      setErro(msg);
    } finally { setIniciando(false); }
  }, [accountId, developmentId, isBroker, brokerId, userId, navigate]);

  return { salvarComoSimulacao, iniciarNegociacao, salvando, iniciando, erro, setErro, sucesso, setSucesso, lastSavedId };
}
