import { useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { createNotificationWithEmail, createNotificationsWithEmail } from "../../../shared/utils/notificationHelper";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

function logActivity(accountId: string, developmentId: string | null, entity: string, entityId: string, action: string, userId: string | null, details?: string) {
  if (!supabase) return;
  supabase.from("activity_logs").insert({ account_id: accountId, development_id: developmentId, entity, entity_id: entityId, action, actor_profile_id: userId, details: details || null }).then(() => {}, () => {});
}

export function usePipelineActions(accountId: string | null, developmentId: string | null, onSuccess: () => void) {
  const { authenticatedProfile } = useAuth();
  const { account, brokerId, isBroker } = useAccount();
  const { development } = useDevelopment();
  const userId = authenticatedProfile?.id ?? null;
  const criarProposta = useCallback(async (input: { negotiationId: string; unitId: string; clientId: string; brokerId: string | null; amount: number; entradaPercentual: number; entradaValor: number; parcelasQuantidade: number; parcelasValor: number }) => {
    if (!supabase || !accountId || !developmentId) throw new Error("Contexto invalido");

    // Check for existing proposal
    const { data: existing } = await supabase.from("proposals").select("id, status").eq("negotiation_id", input.negotiationId).limit(1);
    if (existing && existing.length > 0) {
      if (existing[0].status === "draft") {
        await supabase.from("proposals").update({ amount: input.amount, entrada_percentual: input.entradaPercentual, entrada_valor: input.entradaValor, parcelas_quantidade: input.parcelasQuantidade, parcelas_valor: input.parcelasValor, updated_at: new Date().toISOString() }).eq("id", existing[0].id);
      }
      // Don't change negotiation status — stage is derived from proposal existence
      await supabase.from("negotiations").update({ updated_at: new Date().toISOString() }).eq("id", input.negotiationId);
      onSuccess(); return;
    }

    const { error } = await supabase.from("proposals").insert({ negotiation_id: input.negotiationId, account_id: accountId, development_id: developmentId, unit_id: input.unitId, client_id: input.clientId, broker_id: input.brokerId, title: "Proposta Comercial", amount: input.amount, status: "draft", tipo: "proposta", entrada_tipo: "percentual", entrada_valor: input.entradaValor, entrada_percentual: input.entradaPercentual, parcelas_quantidade: input.parcelasQuantidade, parcelas_valor: input.parcelasValor });
    if (error) throw error;
    // Only touch updated_at, NOT status — stage derived from proposal existence
    await supabase.from("negotiations").update({ updated_at: new Date().toISOString() }).eq("id", input.negotiationId);
    if (accountId && userId) logActivity(accountId, developmentId, "proposal", input.negotiationId, "created", userId, `Proposta criada — ${input.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);

    // Notify managers/directors about new proposal (fire-and-forget)
    if (accountId && userId) {
      const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
      supabase.from("negotiations").select("clients(name), units(quadra, lote)").eq("id", input.negotiationId).maybeSingle().then(({ data: nd }) => {
        const cl = (nd as Record<string, unknown>)?.clients as Record<string, unknown> | null;
        const un = (nd as Record<string, unknown>)?.units as Record<string, unknown> | null;
        const cn = (cl?.name as string) || "Cliente";
        const ul = un ? `Q${un.quadra}/L${un.lote}` : "";
        const sn = authenticatedProfile?.fullName || "Equipe";
        supabase!.from("user_account_access").select("user_id").eq("account_id", accountId).in("role", ["owner", "director", "manager"]).then(({ data: mgrs }) => {
          const notifs = (mgrs || []).filter((m: Record<string, unknown>) => m.user_id !== userId).map((m: Record<string, unknown>) => ({
            account_id: accountId, recipient_id: m.user_id as string, sender_id: userId,
            type: "new_proposal", title: "Nova proposta recebida",
            message: `${cn} — ${ul} — ${fmt(input.amount)}. Enviada por ${sn}.`,
            action_url: `/negociacoes/${input.negotiationId}`,
            metadata: { client_name: cn, unit_label: ul, total_value: fmt(input.amount), entrada: `${input.entradaPercentual}% (${fmt(input.entradaValor)})`, parcelas: `${input.parcelasQuantidade}x de ${fmt(input.parcelasValor)}`, sent_by: sn, account_name: account?.accountName, development_name: development?.developmentName },
          }));
          if (notifs.length > 0) void createNotificationsWithEmail(notifs);
        });
      });
    }

    onSuccess();
  }, [accountId, developmentId, userId, authenticatedProfile, onSuccess]);

  const solicitarReserva = useCallback(async (input: { negotiationId: string; unitId: string }) => {
    if (!supabase || !accountId || !developmentId) throw new Error("Contexto invalido");
    const { data: propostas } = await supabase.from("proposals").select("id").eq("negotiation_id", input.negotiationId).order("created_at", { ascending: false }).limit(1);
    const proposalId = propostas?.[0]?.id ?? null;
    const { error } = await supabase.from("reservation_requests").insert({ negotiation_id: input.negotiationId, proposal_id: proposalId, account_id: accountId, development_id: developmentId, unit_id: input.unitId, status: "requested" });
    if (error) throw error;
    await supabase.from("negotiations").update({ updated_at: new Date().toISOString() }).eq("id", input.negotiationId);
    if (accountId && userId) logActivity(accountId, developmentId, "reservation_request", input.negotiationId, "created", userId, "Reserva solicitada");
    // Notify managers about reservation request
    if (userId) {
      const sn = authenticatedProfile?.fullName || "Equipe";
      supabase.from("negotiations").select("clients(name), units(quadra, lote)").eq("id", input.negotiationId).maybeSingle().then(({ data: nd }) => {
        const cl = (nd as Record<string, unknown>)?.clients as Record<string, unknown> | null;
        const un = (nd as Record<string, unknown>)?.units as Record<string, unknown> | null;
        const cn = (cl?.name as string) || "Cliente"; const ul = un ? `Q${un.quadra}/L${un.lote}` : "";
        supabase!.from("user_account_access").select("user_id").eq("account_id", accountId).in("role", ["owner", "director", "manager"]).then(({ data: mgrs }) => {
          const notifs = (mgrs || []).filter((m: Record<string, unknown>) => m.user_id !== userId).map((m: Record<string, unknown>) => ({
            account_id: accountId, recipient_id: m.user_id as string, sender_id: userId,
            type: "reservation_requested", title: "Reserva solicitada",
            message: `${sn} solicitou reserva de ${ul} para ${cn}.`,
            action_url: `/pipeline`, metadata: { client_name: cn, unit_label: ul, sent_by: sn, account_name: account?.accountName, development_name: development?.developmentName },
          }));
          if (notifs.length > 0) void createNotificationsWithEmail(notifs);
        });
      });
    }
    onSuccess();
  }, [accountId, developmentId, userId, authenticatedProfile, account, development, onSuccess]);

  const aprovarReserva = useCallback(async (negotiationId: string, unitId: string, reservationRequestId?: string) => {
    if (!supabase || !accountId || !developmentId) throw new Error("Contexto invalido");
    const { data: settings } = await supabase.from("account_settings").select("reservation_duration_hours").eq("account_id", accountId).single();
    const horas = settings?.reservation_duration_hours ?? 72;
    const expiresAt = new Date(Date.now() + horas * 3600000).toISOString();
    const { error } = await supabase.from("reservations").insert({ reservation_request_id: reservationRequestId ?? null, negotiation_id: negotiationId, account_id: accountId, development_id: developmentId, unit_id: unitId, status: "active", started_at: new Date().toISOString(), expires_at: expiresAt });
    if (error) throw error;
    await supabase.from("units").update({ status: "reserved" }).eq("id", unitId);
    if (reservationRequestId) await supabase.from("reservation_requests").update({ status: "approved" }).eq("id", reservationRequestId);
    await supabase.from("negotiations").update({ updated_at: new Date().toISOString() }).eq("id", negotiationId);
    if (accountId && userId) logActivity(accountId, developmentId, "reservation", negotiationId, "approved", userId, `Reserva aprovada — prazo ${formatDateBRT(expiresAt)}`);
    if (accountId && userId) logActivity(accountId, developmentId, "unit", unitId, "status_changed", userId, "Unidade reservada");
    // Notify requester about approval
    if (userId && reservationRequestId) {
      supabase.from("reservation_requests").select("requested_by").eq("id", reservationRequestId).maybeSingle().then(({ data: rr }) => {
        const reqBy = (rr as Record<string, unknown>)?.requested_by as string | undefined;
        if (reqBy && reqBy !== userId) {
          supabase!.from("negotiations").select("clients(name), units(quadra, lote)").eq("id", negotiationId).maybeSingle().then(({ data: nd }) => {
            const cl = (nd as Record<string, unknown>)?.clients as Record<string, unknown> | null;
            const un = (nd as Record<string, unknown>)?.units as Record<string, unknown> | null;
            const cn = (cl?.name as string) || "Cliente"; const ul = un ? `Q${un.quadra}/L${un.lote}` : "";
            const exp = formatDateBRT(expiresAt);
            void createNotificationWithEmail({ account_id: accountId, recipient_id: reqBy, sender_id: userId, type: "reservation_approved", title: "Reserva aprovada", message: `Reserva de ${ul} para ${cn} foi aprovada. Prazo: ${exp}.`, action_url: "/pipeline", metadata: { client_name: cn, unit_label: ul, account_name: account?.accountName, development_name: development?.developmentName } });
          });
        }
      });
    }
    onSuccess();
  }, [accountId, developmentId, userId, account, development, onSuccess]);

  const registrarVenda = useCallback(async (input: { negotiationId: string; unitId: string; amount: number }) => {
    if (!supabase || !accountId || !developmentId) throw new Error("Contexto invalido");
    let proposalId: string | null = null;
    const { data: propostas } = await supabase.from("proposals").select("id, amount").eq("negotiation_id", input.negotiationId).order("created_at", { ascending: false }).limit(1);
    if (propostas && propostas.length > 0) { proposalId = propostas[0].id; if (!input.amount) input = { ...input, amount: Number(propostas[0].amount) }; }
    let reservationId: string | null = null;
    const { data: reservas } = await supabase.from("reservations").select("id").eq("negotiation_id", input.negotiationId).order("created_at", { ascending: false }).limit(1);
    if (reservas && reservas.length > 0) reservationId = reservas[0].id;
    const { error } = await supabase.from("sales").insert({ negotiation_id: input.negotiationId, reservation_id: reservationId, proposal_id: proposalId, account_id: accountId, development_id: developmentId, unit_id: input.unitId, amount: input.amount || 0, status: "awaiting_documents" });
    if (error) throw error;
    if (input.unitId) await supabase.from("units").update({ status: "sold" }).eq("id", input.unitId);
    await supabase.from("negotiations").update({ status: "WON", updated_at: new Date().toISOString() }).eq("id", input.negotiationId);
    if (reservationId) await supabase.from("reservations").update({ status: "converted" }).eq("id", reservationId);
    // Sync third-party property status → vendido
    const { data: negData } = await supabase.from("negotiations").select("third_party_property_id").eq("id", input.negotiationId).maybeSingle();
    const tppId = (negData as Record<string, unknown> | null)?.third_party_property_id as string | null;
    if (tppId) supabase.from("third_party_properties").update({ status: "vendido", updated_at: new Date().toISOString() }).eq("id", tppId).then(() => {}, () => {});
    if (accountId && userId) {
      logActivity(accountId, developmentId, "sale", input.negotiationId, "registered", userId, `Venda registrada — ${(input.amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
      logActivity(accountId, developmentId, "negotiation", input.negotiationId, "won", userId, "Negociação ganha");
      if (input.unitId) logActivity(accountId, developmentId, "unit", input.unitId, "sold", userId, "Unidade vendida");
    }
    // Notify ALL team members about the sale
    if (userId) {
      const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
      const sn = authenticatedProfile?.fullName || "Equipe";
      supabase.from("negotiations").select("clients(name), units(quadra, lote)").eq("id", input.negotiationId).maybeSingle().then(({ data: nd }) => {
        const cl = (nd as Record<string, unknown>)?.clients as Record<string, unknown> | null;
        const un = (nd as Record<string, unknown>)?.units as Record<string, unknown> | null;
        const cn = (cl?.name as string) || "Cliente"; const ul = un ? `Q${un.quadra}/L${un.lote}` : "";
        // Notify all team members (in-app)
        supabase!.from("user_account_access").select("user_id").eq("account_id", accountId).then(({ data: all }) => {
          const notifs = (all || []).filter((m: Record<string, unknown>) => m.user_id !== userId).map((m: Record<string, unknown>) => ({
            account_id: accountId, recipient_id: m.user_id as string, sender_id: userId,
            type: "sale_registered", title: "Venda registrada!",
            message: `${cn} — ${ul} — ${fmt(input.amount)}. Vendido por ${sn}.`,
            action_url: "/pipeline",
          }));
          if (notifs.length > 0) supabase!.from("notifications").insert(notifs.map((n) => ({ ...n, read: false }))).then(() => {}, () => {});
        });
        // Email only to managers/directors
        supabase!.from("user_account_access").select("user_id").eq("account_id", accountId).in("role", ["owner", "director", "manager"]).then(({ data: mgrs }) => {
          for (const m of (mgrs || []) as Record<string, unknown>[]) {
            if (m.user_id === userId) continue;
            supabase!.functions.invoke("send-notification-email", {
              body: { recipient_id: m.user_id, type: "sale_registered", title: "Venda registrada!", message: `${cn} — ${ul} — ${fmt(input.amount)}. Vendido por ${sn}.`, action_url: "/pipeline", metadata: { client_name: cn, unit_label: ul, total_value: fmt(input.amount), sent_by: sn, account_name: account?.accountName, development_name: development?.developmentName } },
            }).catch(() => {});
          }
        });
      });
    }
    onSuccess();
  }, [accountId, developmentId, userId, authenticatedProfile, account, development, onSuccess]);

  const converterSimulacao = useCallback(async (input: { simulationId: string; unitId: string; clientId: string | null; brokerId: string | null; thirdPartyPropertyId?: string | null }) => {
    if (!supabase || !accountId || !developmentId) throw new Error("Contexto invalido");
    // Check if unit is already in a negotiation
    const { data: existing } = await supabase.from("negotiations").select("id").eq("unit_id", input.unitId).eq("account_id", accountId).not("status", "in", '("WON","LOST","CANCELLED")').limit(1);
    if (existing && existing.length > 0) throw new Error("Esta unidade já está em negociação. Acesse os detalhes no pipeline.");
    const effectiveBrokerId = isBroker ? brokerId : input.brokerId;
    const payload: Record<string, unknown> = { account_id: accountId, development_id: developmentId, unit_id: input.unitId, client_id: input.clientId, broker_id: effectiveBrokerId, status: "IN_PROGRESS" };
    if (userId) payload.owner_profile_id = userId;
    if (input.thirdPartyPropertyId) { payload.third_party_property_id = input.thirdPartyPropertyId; payload.development_id = null; }
    const { error: nErr } = await supabase.from("negotiations").insert(payload);
    if (nErr) throw nErr;
    await supabase.from("pipeline_simulations").update({ status: "converted" }).eq("id", input.simulationId);
    // Sync third-party property status → em_negociacao
    if (input.thirdPartyPropertyId) {
      supabase.from("third_party_properties").update({ status: "em_negociacao", updated_at: new Date().toISOString() }).eq("id", input.thirdPartyPropertyId).then(() => {}, () => {});
    }
    onSuccess();
  }, [accountId, developmentId, isBroker, brokerId, userId, onSuccess]);

  // Promote first from queue when a unit becomes available
  const promoteQueueFirst = useCallback(async (unitId: string) => {
    if (!supabase || !accountId) return;
    try {
      const { data: queueEntries } = await supabase
        .from("unit_queue_entries")
        .select("id")
        .eq("unit_id", unitId)
        .eq("account_id", accountId)
        .eq("status", "waiting")
        .order("position", { ascending: true })
        .limit(1);
      if (queueEntries && queueEntries.length > 0) {
        await supabase.from("unit_queue_entries").update({ status: "promoted", promoted_at: new Date().toISOString() }).eq("id", queueEntries[0].id);
      }
    } catch (queueErr) {
      console.error("[QUEUE] Erro ao promover:", queueErr);
    }
  }, [accountId]);

  // Cancel negotiation with full cascade
  const cancelarNegociacao = useCallback(async (input: { negotiationId: string; unitId: string; reason: string; currentStatus?: string }) => {
    if (!supabase || !accountId) throw new Error("Contexto invalido");
    await supabase.from("proposals").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("negotiation_id", input.negotiationId).in("status", ["draft", "sent", "under_analysis"]);
    await supabase.from("reservation_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("negotiation_id", input.negotiationId).eq("status", "requested");
    const { data: activeRes } = await supabase.from("reservations").select("id, unit_id").eq("negotiation_id", input.negotiationId).in("status", ["active", "ativa", "ACTIVE"]);
    if (activeRes && activeRes.length > 0) {
      for (const r of activeRes) {
        await supabase.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
        await supabase.from("units").update({ status: "available" }).eq("id", r.unit_id);
        try { await promoteQueueFirst(r.unit_id); } catch { /* non-blocking */ }
      }
    } else if (input.unitId) {
      const { data: unitData } = await supabase.from("units").select("status").eq("id", input.unitId).single();
      if (unitData && unitData.status === "reserved") {
        await supabase.from("units").update({ status: "available" }).eq("id", input.unitId);
        try { await promoteQueueFirst(input.unitId); } catch { /* non-blocking */ }
      }
    }
    await supabase.from("negotiations").update({ status: "LOST", lost_reason: input.reason, lost_at: new Date().toISOString(), lost_at_stage: input.currentStatus || null, updated_at: new Date().toISOString() }).eq("id", input.negotiationId);
    if (accountId && userId) logActivity(accountId, developmentId, "negotiation", input.negotiationId, "cancelled", userId, `Negociação cancelada — ${input.reason}`);
    // Sync third-party property status → disponivel
    const { data: negInfo } = await supabase.from("negotiations").select("third_party_property_id").eq("id", input.negotiationId).maybeSingle();
    const propId = (negInfo as Record<string, unknown> | null)?.third_party_property_id as string | null;
    if (propId) supabase.from("third_party_properties").update({ status: "disponivel", updated_at: new Date().toISOString() }).eq("id", propId).then(() => {}, () => {});
    onSuccess();
  }, [accountId, onSuccess, promoteQueueFirst]);

  return { criarProposta, solicitarReserva, aprovarReserva, registrarVenda, converterSimulacao, cancelarNegociacao, promoteQueueFirst };
}
