import { useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { createNotificationWithEmail, createNotificationsWithEmail } from "../../../shared/utils/notificationHelper";
import { formatDateBRT } from "../../../shared/utils/dateUtils";
import { RESERVATION_ACTIVE_DB, ReservationStatus } from "../../../domain/status/reservation";
import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { SaleStatus } from "../../../domain/venda/SaleStatus";
import { PipelineSimulationStatus } from "../../../domain/status/pipelineSimulation";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { promoteFirstWaiting } from "../../../infra/repositories/unitQueueSupabaseRepository";
import { updateProposalDetails, createProposal, rejectActiveProposals } from "../../../infra/repositories/proposalsSupabaseRepository";
import { touchNegotiation, updateNegotiationStatus, createNegotiationForConversion, markNegotiationLost } from "../../../infra/repositories/negotiationsSupabaseRepository";
import { createReservationRequest, updateReservationRequestStatus, cancelPendingRequests } from "../../../infra/repositories/reservationRequestsSupabaseRepository";
import { createReservation, updateReservationStatus } from "../../../infra/repositories/reservationsSupabaseRepository";
import { updateUnitStatus } from "../../../infra/repositories/unitsSupabaseRepository";
import { createSale } from "../../../infra/repositories/salesSupabaseRepository";
import { updateSimulationStatus } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";

function logActivity(accountId: string, developmentId: string | null, entity: string, entityId: string, action: string, userId: string | null, details?: string) {
  if (!supabase) return;
  supabase.from("activity_logs").insert({ account_id: accountId, development_id: developmentId, entity, entity_id: entityId, action, actor_profile_id: userId, details: details || null }).then(() => {}, (err) => { console.error("[logActivity] falha ao gravar auditoria:", err); });
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
        await updateProposalDetails(existing[0].id, { amount: input.amount, entradaPercentual: input.entradaPercentual, entradaValor: input.entradaValor, parcelasQuantidade: input.parcelasQuantidade, parcelasValor: input.parcelasValor });
      }
      // Don't change negotiation status — stage is derived from proposal existence
      await touchNegotiation(input.negotiationId);
      onSuccess(); return;
    }

    await createProposal({ negotiationId: input.negotiationId, accountId, developmentId, unitId: input.unitId, clientId: input.clientId, brokerId: input.brokerId, title: "Proposta Comercial", amount: input.amount, createdBy: null, tipo: "proposta", entradaTipo: "percentual", entradaValor: input.entradaValor, entradaPercentual: input.entradaPercentual, parcelasQuantidade: input.parcelasQuantidade, parcelasValor: input.parcelasValor });
    // Only touch updated_at, NOT status — stage derived from proposal existence
    await touchNegotiation(input.negotiationId);
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
    await createReservationRequest({ negotiationId: input.negotiationId, proposalId, accountId, developmentId, unitId: input.unitId, requestedBy: null });
    await touchNegotiation(input.negotiationId);
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
    await createReservation({ reservationRequestId: reservationRequestId ?? null, negotiationId, accountId, developmentId, unitId, status: ReservationStatus.ACTIVE, startedAt: new Date(), expiresAt: new Date(expiresAt) });
    await updateUnitStatus(unitId, UnidadeStatus.RESERVADO);
    if (reservationRequestId) await updateReservationRequestStatus(reservationRequestId, ReservationStatus.APPROVED);
    await touchNegotiation(negotiationId);
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
    // salesSupabaseRepository (WIP) exige reservationId/proposalId non-nullable; o fluxo atual
    // permite NULL (venda direta sem reserva/proposta) → cast preservando o comportamento.
    // Alargar a assinatura do repo de vendas fica registrado como pendência.
    await createSale({ negotiationId: input.negotiationId, reservationId: reservationId as string, proposalId: proposalId as string, accountId, developmentId, unitId: input.unitId, amount: input.amount || 0, status: SaleStatus.AWAITING_DOCUMENTS, createdBy: null });
    if (input.unitId) await updateUnitStatus(input.unitId, UnidadeStatus.VENDIDO);
    await updateNegotiationStatus(input.negotiationId, NegotiationStatus.WON);
    if (reservationId) await updateReservationStatus(reservationId, ReservationStatus.CONVERTED);
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
    await createNegotiationForConversion({ accountId, developmentId, unitId: input.unitId, clientId: input.clientId, brokerId: effectiveBrokerId, ownerProfileId: userId, thirdPartyPropertyId: input.thirdPartyPropertyId ?? null });
    await updateSimulationStatus(input.simulationId, PipelineSimulationStatus.CONVERTIDA);
    // Sync third-party property status → em_negociacao
    if (input.thirdPartyPropertyId) {
      supabase.from("third_party_properties").update({ status: "em_negociacao", updated_at: new Date().toISOString() }).eq("id", input.thirdPartyPropertyId).then(() => {}, () => {});
    }
    onSuccess();
  }, [accountId, developmentId, isBroker, brokerId, userId, onSuccess]);

  // Promote first from queue when a unit becomes available
  // Fila via repositório (fonte única). Fix M1: antes filtrava "ACTIVE" (inexistente
  // nos dados) e gravava UPPER — nunca promovia; agora promove a 1ª "waiting" → "promoted".
  const promoteQueueFirst = useCallback(async (unitId: string) => {
    if (!accountId) return;
    try {
      await promoteFirstWaiting(unitId, accountId);
    } catch (queueErr) {
      console.error("[QUEUE] Erro ao promover:", queueErr);
    }
  }, [accountId]);

  // Cancel negotiation with full cascade
  const cancelarNegociacao = useCallback(async (input: { negotiationId: string; unitId: string; reason: string; currentStatus?: string }) => {
    if (!supabase || !accountId) throw new Error("Contexto invalido");
    await rejectActiveProposals(input.negotiationId);
    await cancelPendingRequests(input.negotiationId);
    const { data: activeRes } = await supabase.from("reservations").select("id, unit_id").eq("negotiation_id", input.negotiationId).eq("status", RESERVATION_ACTIVE_DB);
    if (activeRes && activeRes.length > 0) {
      for (const r of activeRes) {
        await updateReservationStatus(r.id, ReservationStatus.CANCELLED);
        await updateUnitStatus(r.unit_id, UnidadeStatus.DISPONIVEL);
        try { await promoteQueueFirst(r.unit_id); } catch { /* non-blocking */ }
      }
    } else if (input.unitId) {
      const { data: unitData } = await supabase.from("units").select("status").eq("id", input.unitId).single();
      if (unitData && unitData.status === "reserved") {
        await updateUnitStatus(input.unitId, UnidadeStatus.DISPONIVEL);
        try { await promoteQueueFirst(input.unitId); } catch { /* non-blocking */ }
      }
    }
    await markNegotiationLost(input.negotiationId, { reason: input.reason, lostAtStage: input.currentStatus || null });
    if (accountId && userId) logActivity(accountId, developmentId, "negotiation", input.negotiationId, "cancelled", userId, `Negociação cancelada — ${input.reason}`);
    // Sync third-party property status → disponivel
    const { data: negInfo } = await supabase.from("negotiations").select("third_party_property_id").eq("id", input.negotiationId).maybeSingle();
    const propId = (negInfo as Record<string, unknown> | null)?.third_party_property_id as string | null;
    if (propId) supabase.from("third_party_properties").update({ status: "disponivel", updated_at: new Date().toISOString() }).eq("id", propId).then(() => {}, () => {});
    onSuccess();
  }, [accountId, onSuccess, promoteQueueFirst]);

  return { criarProposta, solicitarReserva, aprovarReserva, registrarVenda, converterSimulacao, cancelarNegociacao, promoteQueueFirst };
}
