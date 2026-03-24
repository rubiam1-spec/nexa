import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { canPerformAction, PermissionAction } from "../../../app/authorization/permissions";
import { ProposalService } from "../../../domain/proposta/ProposalService";
import { getProposalStatusLabel } from "../../../domain/proposta/ProposalStatusLabel";
import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { NegotiationService } from "../../../domain/negociacao/NegotiationService";
import { UnitQueueStatus } from "../../../domain/fila/UnitQueueStatus";
import { getUnitQueueStatusLabel } from "../../../domain/fila/UnitQueueStatusLabel";
import { getReservationStatusLabel } from "../../../domain/reserva/ReservationStatusLabel";
import { ReservationStatus } from "../../../domain/reserva/ReservationStatus";
import { useAuth } from "../../../app/contexts/AuthContext";
import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { getUnidadeStatusLabel } from "../../../domain/unidade/UnidadeStatusLabel";
import NexaBadge from "../../../shared/components/NexaBadge";
import { SaleService } from "../../../domain/venda/SaleService";
import { getSaleStatusLabel } from "../../../domain/venda/SaleStatusLabel";
import { getUserRoleLabel } from "../../../shared/types/role";
import { useNegotiationDetail } from "../hooks/useNegotiationDetail";

export default function NegotiationDetailPage() {
  const { id } = useParams();
  const { authenticatedProfile } = useAuth();
  const {
    accountContext: {
      account,
      errorMessage: accountErrorMessage,
      status: accountStatus,
    },
    developmentContext: {
      errorMessage: developmentErrorMessage,
      status: developmentStatus,
    },
    negotiationsState: {
      errorMessage: negotiationErrorMessage,
      isLoading: isLoadingNegotiations,
      isUpdating,
      negotiations,
      replaceNegotiation,
      cancelNegotiation,
      startNegotiation,
      status: negotiationStatus,
    },
    clientsState: { isLoading: isLoadingClients },
    brokersState: { isLoading: isLoadingBrokers },
    unitsState: {
      errorMessage: unitsErrorMessage,
      isLoading: isLoadingUnits,
      status: unitsStatus,
    },
    historyState: {
      errorMessage: historyErrorMessage,
      events,
      isLoading: isLoadingHistory,
      prependEvent,
      status: historyStatus,
    },
    settingsState: {
      effectiveSettings,
      errorMessage: settingsErrorMessage,
      isLoading: isLoadingSettings,
      status: settingsStatus,
    },
    queueState: {
      canViewCompleteQueue,
      createEntry,
      currentActorEntry,
      entries: unitQueueEntries,
      errorMessage: unitQueueErrorMessage,
      isCreating: isCreatingQueueEntry,
      isLoading: isLoadingQueue,
      isUpdating: isUpdatingQueue,
      queueRequired,
      status: unitQueueStatus,
      visibleEntries: visibleQueueEntries,
    },
    proposalsState: {
      createProposal,
      acceptProposal,
      errorMessage: proposalsErrorMessage,
      isCreating,
      isUpdating: isUpdatingProposals,
      isLoading: isLoadingProposals,
      markProposalUnderAnalysis,
      proposals,
      rejectProposal,
      sendProposal,
      status: proposalsStatus,
    },
    reservationRequestsState: {
      approveRequest,
      createRequest,
      errorMessage: reservationRequestsErrorMessage,
      isCreating: isCreatingReservationRequest,
      isUpdating: isUpdatingReservationRequest,
      isLoading: isLoadingReservationRequests,
      rejectRequest,
      requests: reservationRequests,
      status: reservationRequestsStatus,
    },
    reservationsState: {
      cancelReservation,
      expireReservation,
      errorMessage: reservationsErrorMessage,
      isLoading: isLoadingReservations,
      isUpdating: isUpdatingReservations,
      prependReservation,
      reservations,
      status: reservationsStatus,
    },
    salesState: {
      createSale,
      advanceSaleToDocuments,
      advanceSaleToContract,
      advanceSaleToPayment,
      completeSale,
      cancelSale,
      errorMessage: salesErrorMessage,
      isCreating: isCreatingSale,
      isTransitioning: isTransitioningSale,
      isLoading: isLoadingSales,
      prependSale,
      sales,
      status: salesStatus,
    },
    broker,
    client,
    negotiation,
    unit,
  } = useNegotiationDetail(id);

  const isLoading =
    isLoadingNegotiations ||
    isLoadingUnits ||
    isLoadingClients ||
    isLoadingBrokers ||
    isLoadingSettings ||
    isLoadingQueue ||
    isLoadingHistory ||
    isLoadingProposals ||
    isLoadingReservationRequests ||
    isLoadingReservations ||
    isLoadingSales;

  if (isLoading) {
    return <p>Carregando detalhe da negociação...</p>;
  }

  if (accountStatus === "no_access" || accountStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>{accountErrorMessage ?? "O contexto de conta não está disponível."}</p>
      </div>
    );
  }

  if (developmentStatus === "empty" || developmentStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>
          {developmentErrorMessage ??
            "O contexto de empreendimento não está disponível."}
        </p>
      </div>
    );
  }

  if (negotiationStatus === "idle") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Selecione uma conta e um empreendimento ativos para continuar.</p>
      </div>
    );
  }

  if (negotiationStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar negociações do empreendimento ativo.</p>
        <p>{negotiationErrorMessage}</p>
      </div>
    );
  }

  if (unitsStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar unidades vinculadas.</p>
        <p>{unitsErrorMessage}</p>
      </div>
    );
  }

  if (historyStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar histórico da negociação.</p>
        <p>{historyErrorMessage}</p>
      </div>
    );
  }

  if (settingsStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar configurações comerciais.</p>
        <p>{settingsErrorMessage}</p>
      </div>
    );
  }

  if (unitQueueStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar a fila operacional da unidade.</p>
        <p>{unitQueueErrorMessage}</p>
      </div>
    );
  }

  if (proposalsStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar propostas da negociação.</p>
        <p>{proposalsErrorMessage}</p>
      </div>
    );
  }

  if (reservationRequestsStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar solicitacoes de reserva.</p>
        <p>{reservationRequestsErrorMessage}</p>
      </div>
    );
  }

  if (reservationsStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar reservas da negociação.</p>
        <p>{reservationsErrorMessage}</p>
      </div>
    );
  }

  if (salesStatus === "error") {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Falha ao carregar vendas da negociação.</p>
        <p>{salesErrorMessage}</p>
      </div>
    );
  }

  if (!negotiation) {
    return (
      <div>
        <h1>Detalhe da negociação</h1>
        <p>Negociação não encontrada no contexto atual.</p>
        <p>Total de negociações carregadas: {negotiations.length}</p>
        <Link to="/negociacoes">Voltar para negociações</Link>
      </div>
    );
  }

  const currentNegotiation = negotiation;
  const actorRole = account?.role ?? authenticatedProfile?.role ?? null;
  const canStart = NegotiationService.podeIniciar(negotiation);
  const canCancel = NegotiationService.podeCancelar(negotiation);
  const canStartByRole = canPerformAction(actorRole, PermissionAction.START_NEGOTIATION);
  const canCancelByRole = canPerformAction(actorRole, PermissionAction.CANCEL_NEGOTIATION);
  const canCreateProposalByRole = canPerformAction(actorRole, PermissionAction.CREATE_PROPOSAL);
  const canOperateProposalByRole = canPerformAction(actorRole, PermissionAction.OPERATE_PROPOSAL);
  const canEnterQueueByRole = canPerformAction(actorRole, PermissionAction.ENTER_UNIT_QUEUE);
  const canRequestReservationByRole = canPerformAction(actorRole, PermissionAction.REQUEST_RESERVATION);
  const canApproveReservationRequestByRole = canPerformAction(
    actorRole,
    PermissionAction.APPROVE_RESERVATION_REQUEST,
  );
  const canRejectReservationRequestByRole = canPerformAction(
    actorRole,
    PermissionAction.REJECT_RESERVATION_REQUEST,
  );
  const canCancelReservationByRole = canPerformAction(
    actorRole,
    PermissionAction.CANCEL_RESERVATION,
  );
  const canExpireReservationByRole = canPerformAction(
    actorRole,
    PermissionAction.EXPIRE_RESERVATION,
  );
  const canConvertSaleByRole = canPerformAction(actorRole, PermissionAction.CONVERT_SALE);
  const canAdvanceSaleByRole = canPerformAction(actorRole, PermissionAction.ADVANCE_SALE);
  const canCancelSaleByRole = canPerformAction(actorRole, PermissionAction.CANCEL_SALE);
  const hasRequestedReservation = reservationRequests.some(
    (request) => request.status === ReservationStatus.REQUESTED,
  );
  const hasOpenQueueEntry = unitQueueEntries.some(
    (entry) =>
      entry.negotiationId === negotiation.id &&
      (entry.status === UnitQueueStatus.ACTIVE ||
        entry.status === UnitQueueStatus.PROMOTED),
  );
  const activeReservation =
    reservations.find((reservation) => reservation.status === ReservationStatus.ACTIVE) ??
    null;

  async function handleStartNegotiation() {
    const event = await startNegotiation(
      currentNegotiation.id,
      authenticatedProfile?.id ?? null,
    );

    if (event) {
      prependEvent(event);
    }
  }

  async function handleCancelNegotiation() {
    const event = await cancelNegotiation(
      currentNegotiation.id,
      authenticatedProfile?.id ?? null,
    );

    if (event) {
      prependEvent(event);
    }
  }

  async function handleCreateProposal(data: {
    title: string;
    amount: number;
    tipo?: string;
    entradaTipo?: string;
    entradaValor?: number;
    entradaPercentual?: number;
    parcelasQuantidade?: number;
    parcelasValor?: number;
    balaoQuantidade?: number;
    balaoValor?: number;
    permutaValor?: number;
    permutaDescricao?: string;
    observacoes?: string;
  }) {
    const result = await createProposal({
      performedBy: authenticatedProfile?.id ?? null,
      suggestedAmount: data.amount,
      title: data.title,
      tipo: data.tipo,
      entradaTipo: data.entradaTipo,
      entradaValor: data.entradaValor,
      entradaPercentual: data.entradaPercentual,
      parcelasQuantidade: data.parcelasQuantidade,
      parcelasValor: data.parcelasValor,
      balaoQuantidade: data.balaoQuantidade,
      balaoValor: data.balaoValor,
      permutaValor: data.permutaValor,
      permutaDescricao: data.permutaDescricao,
      observacoes: data.observacoes,
    });

    if (!result) {
      return;
    }

    result.historyEvents.forEach((event) => {
      prependEvent(event);
    });

    if (result.updatedNegotiation) {
      replaceNegotiation(result.updatedNegotiation);
    }
  }

  async function handleProposalTransition(
    proposalId: string,
    action: "send" | "analyze" | "accept" | "reject",
  ) {
    const result =
      action === "send"
        ? await sendProposal(proposalId, authenticatedProfile?.id ?? null)
        : action === "analyze"
          ? await markProposalUnderAnalysis(
              proposalId,
              authenticatedProfile?.id ?? null,
            )
          : action === "accept"
            ? await acceptProposal(proposalId, authenticatedProfile?.id ?? null)
            : await rejectProposal(proposalId, authenticatedProfile?.id ?? null);

    if (!result) {
      return;
    }

    prependEvent(result.historyEvent);

    if (result.updatedNegotiation) {
      replaceNegotiation(result.updatedNegotiation);
    }
  }

  async function handleCreateReservationRequest() {
    const result = await createRequest(authenticatedProfile?.id ?? null);

    if (!result) {
      return;
    }

    prependEvent(result.historyEvent);
  }

  async function handleCreateQueueEntry() {
    const result = await createEntry(authenticatedProfile?.id ?? null);

    if (!result) {
      return;
    }

    prependEvent(result.historyEvent);
  }

  async function handleReservationRequestTransition(
    requestId: string,
    action: "approve" | "reject",
  ) {
    const result =
      action === "approve"
        ? await approveRequest(requestId, authenticatedProfile?.id ?? null)
        : await rejectRequest(requestId, authenticatedProfile?.id ?? null);

    if (!result) {
      return;
    }

    prependEvent(result.historyEvent);

    if (result.reservation) {
      prependReservation(result.reservation);
    }
  }

  async function handleReservationTransition(
    reservationId: string,
    action: "cancel" | "expire",
  ) {
    const result =
      action === "cancel"
        ? await cancelReservation(reservationId, authenticatedProfile?.id ?? null)
        : await expireReservation(reservationId, authenticatedProfile?.id ?? null);

    if (!result) {
      return;
    }

    prependEvent(result.historyEvent);
    prependReservation(result.reservation);
  }

  async function handleCreateSale() {
    const result = await createSale(authenticatedProfile?.id ?? null);

    if (!result) {
      return;
    }

    prependEvent(result.historyEvent);
    prependSale(result.sale);
    replaceNegotiation(result.updatedNegotiation);
  }

  async function handleSaleTransition(
    saleId: string,
    action: "documents" | "contract" | "payment" | "complete" | "cancel",
  ) {
    const performedBy = authenticatedProfile?.id ?? null;
    const transitionFn =
      action === "documents"
        ? advanceSaleToDocuments
        : action === "contract"
          ? advanceSaleToContract
          : action === "payment"
            ? advanceSaleToPayment
            : action === "complete"
              ? completeSale
              : cancelSale;

    await transitionFn(saleId, performedBy);
  }

  function getHistoryEventLabel(event: (typeof events)[number]) {
    switch (event.action) {
      case NegotiationHistoryAction.NEGOTIATION_CREATED:
        return "Negociação criada";
      case NegotiationHistoryAction.NEGOTIATION_STARTED:
        return "Negociação iniciada";
      case NegotiationHistoryAction.NEGOTIATION_CANCELLED:
        return "Negociação cancelada";
      case NegotiationHistoryAction.PROPOSAL_CREATED:
        return "Proposta criada";
      case NegotiationHistoryAction.PROPOSAL_SENT:
        return "Proposta enviada";
      case NegotiationHistoryAction.PROPOSAL_UNDER_ANALYSIS:
        return "Proposta em analise";
      case NegotiationHistoryAction.PROPOSAL_ACCEPTED:
        return "Proposta aceita";
      case NegotiationHistoryAction.PROPOSAL_REJECTED:
        return "Proposta recusada";
      case NegotiationHistoryAction.QUEUE_ENTERED:
        return "Entrada na fila";
      case NegotiationHistoryAction.QUEUE_PROMOTED:
        return "Fila promovida";
      case NegotiationHistoryAction.RESERVATION_REQUESTED:
        return "Reserva solicitada";
      case NegotiationHistoryAction.RESERVATION_APPROVED:
        return "Solicitacao aprovada";
      case NegotiationHistoryAction.RESERVATION_REJECTED:
        return "Solicitacao recusada";
      case NegotiationHistoryAction.RESERVATION_CANCELLED:
        return "Reserva cancelada";
      case NegotiationHistoryAction.RESERVATION_EXPIRED:
        return "Reserva expirada";
      case NegotiationHistoryAction.SALE_CREATED:
        return "Venda criada";
      case NegotiationHistoryAction.RESERVATION_CONVERTED:
        return "Reserva convertida";
      case NegotiationHistoryAction.SALE_ADVANCED:
        return "Venda avancada";
      case NegotiationHistoryAction.SALE_COMPLETED:
        return "Venda concluida";
      case NegotiationHistoryAction.SALE_CANCELLED:
        return "Venda cancelada";
    }
  }

  function getHistoryEventEntity(event: (typeof events)[number]) {
    switch (event.action) {
      case NegotiationHistoryAction.PROPOSAL_CREATED:
      case NegotiationHistoryAction.PROPOSAL_SENT:
      case NegotiationHistoryAction.PROPOSAL_UNDER_ANALYSIS:
      case NegotiationHistoryAction.PROPOSAL_ACCEPTED:
      case NegotiationHistoryAction.PROPOSAL_REJECTED:
        return "Proposta";
      case NegotiationHistoryAction.QUEUE_ENTERED:
      case NegotiationHistoryAction.QUEUE_PROMOTED:
        return "Fila da unidade";
      case NegotiationHistoryAction.RESERVATION_REQUESTED:
      case NegotiationHistoryAction.RESERVATION_APPROVED:
      case NegotiationHistoryAction.RESERVATION_REJECTED:
      case NegotiationHistoryAction.RESERVATION_CANCELLED:
      case NegotiationHistoryAction.RESERVATION_EXPIRED:
        return "Reserva";
      case NegotiationHistoryAction.SALE_CREATED:
      case NegotiationHistoryAction.SALE_ADVANCED:
      case NegotiationHistoryAction.SALE_COMPLETED:
      case NegotiationHistoryAction.SALE_CANCELLED:
        return "Venda";
      case NegotiationHistoryAction.RESERVATION_CONVERTED:
        return "Reserva";
      default:
        return "Negociação";
    }
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--color-sprout)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: 12,
  };
  const btnPrimary: React.CSSProperties = {
    background: "var(--color-sprout)",
    color: "var(--color-ink)",
    border: "none",
    borderRadius: 8,
    padding: "0 14px",
    height: 32,
    fontSize: 12,
    fontWeight: 700,
  };
  const btnSecondary: React.CSSProperties = {
    background: "transparent",
    color: "var(--color-bone)",
    border: "1px solid var(--color-stone)",
    borderRadius: 8,
    padding: "0 14px",
    height: 32,
    fontSize: 12,
    fontWeight: 600,
  };
  const btnDanger: React.CSSProperties = {
    background: "transparent",
    color: "var(--color-red)",
    border: "1px solid var(--color-red-muted)",
    borderRadius: 8,
    padding: "0 14px",
    height: 32,
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-fog)", marginBottom: 12 }}>
          <Link to="/negociacoes" style={{ color: "var(--color-fog)" }}>Negociações</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          <span style={{ color: "var(--color-dust)" }}>{unit ? `Quadra ${unit.quadra} - Lote ${unit.lote}` : negotiation.id.slice(0, 8)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>
            {unit ? `Quadra ${unit.quadra} - Lote ${unit.lote}` : `Negociação`}
          </h1>
          <NexaBadge entity="negotiation" status={negotiation.status} label={getNegotiationStatusLabel(negotiation.status)} />
          {unit ? <NexaBadge entity="unit" status={unit.status} label={getUnidadeStatusLabel(unit.status)} /> : null}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-fog)" }}>
          {client?.name ?? "Sem cliente"} · {broker?.name ?? "Sem corretor"} · {unit ? `R$ ${unit.valor.toLocaleString("pt-BR")}` : "—"} · {getUserRoleLabel(actorRole)}
        </div>
      </div>

      {/* Summary card */}
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 13 }}>
          <div>
            <div className="nexa-label" style={{ marginBottom: 4 }}>Valor</div>
            <div style={{ color: "var(--color-bone)", fontWeight: 600 }}>{unit ? `R$ ${unit.valor.toLocaleString("pt-BR")}` : "—"}</div>
          </div>
          <div>
            <div className="nexa-label" style={{ marginBottom: 4 }}>Cliente</div>
            <div style={{ color: "var(--color-dust)" }}>{client?.name ?? "—"}</div>
          </div>
          <div>
            <div className="nexa-label" style={{ marginBottom: 4 }}>Corretor</div>
            <div style={{ color: "var(--color-dust)" }}>{broker?.name ?? "—"}{broker?.brokerageName ? ` · ${broker.brokerageName}` : ""}</div>
          </div>
          <div>
            <div className="nexa-label" style={{ marginBottom: 4 }}>Prazo de reserva</div>
            <div style={{ color: "var(--color-dust)" }}>{effectiveSettings?.reservationDurationHours ?? 0}h</div>
          </div>
          <div>
            <div className="nexa-label" style={{ marginBottom: 4 }}>Proposta aceita</div>
            <div style={{ color: "var(--color-dust)" }}>{effectiveSettings?.requireAcceptedProposalForReservationRequest ? "Obrigatória" : "Não obrigatória"}</div>
          </div>
          <div>
            <div className="nexa-label" style={{ marginBottom: 4 }}>Fila</div>
            <div style={{ color: "var(--color-dust)" }}>{effectiveSettings?.queueEnabled ? "Ativa" : "Inativa"}</div>
          </div>
        </div>
      </div>
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sectionTitle}>Histórico</div>
        {events.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhum evento registrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 0 }}>
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  gap: 12,
                  paddingBottom: 12,
                  paddingLeft: 4,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-sprout)", flexShrink: 0, marginTop: 4 }} />
                  <div style={{ width: 1, flex: 1, background: "var(--color-stone)", marginTop: 4 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--color-bone)", fontWeight: 600 }}>
                    {getHistoryEventLabel(event)}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--color-fog)" }}>{getHistoryEventEntity(event)}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-slate)" }}>{event.createdAt.toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sectionTitle}>Propostas</div>
        {proposals.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma proposta vinculada.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                style={{
                  background: "var(--color-ink)",
                  border: "1px solid var(--color-stone)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>{proposal.title}</span>
                  <span className="nexa-badge" style={{ color: "#60A5FA", background: "rgba(96,165,250,0.12)" }}>{getProposalStatusLabel(proposal.status)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-dust)", display: "flex", gap: 16 }}>
                  <span>R$ {proposal.amount.toLocaleString("pt-BR")}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{proposal.createdAt.toLocaleString("pt-BR")}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {canOperateProposalByRole ? (
                    <>
                      <button type="button" disabled={isUpdatingProposals || !ProposalService.podeEnviar(proposal)} onClick={() => void handleProposalTransition(proposal.id, "send")} style={btnSecondary}>Enviar</button>
                      <button type="button" disabled={isUpdatingProposals || !ProposalService.podeColocarEmAnalise(proposal)} onClick={() => void handleProposalTransition(proposal.id, "analyze")} style={btnSecondary}>Em análise</button>
                      <button type="button" disabled={isUpdatingProposals || !ProposalService.podeAceitar(proposal)} onClick={() => void handleProposalTransition(proposal.id, "accept")} style={btnPrimary}>Aceitar</button>
                      <button type="button" disabled={isUpdatingProposals || !ProposalService.podeRecusar(proposal)} onClick={() => void handleProposalTransition(proposal.id, "reject")} style={btnDanger}>Recusar</button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {proposalsErrorMessage ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{proposalsErrorMessage}</p> : null}
        <ProposalForm
          canCreate={
            canCreateProposalByRole &&
            !isCreating &&
            negotiation.status !== NegotiationStatus.CANCELLED
          }
          isCreating={isCreating}
          defaultAmount={unit?.valor ?? 0}
          unitLabel={unit ? `Quadra ${unit.quadra} - Lote ${unit.lote}` : undefined}
          onSubmit={(data) => void handleCreateProposal(data)}
        />
        {proposals.some((p) => p.status === "REJECTED") ? (
          <ProposalForm
            canCreate={canCreateProposalByRole && !isCreating && negotiation.status !== NegotiationStatus.CANCELLED}
            isCreating={isCreating}
            defaultAmount={unit?.valor ?? 0}
            unitLabel={unit ? `Quadra ${unit.quadra} - Lote ${unit.lote}` : undefined}
            tipo="contraproposta"
            onSubmit={(data) => void handleCreateProposal(data)}
          />
        ) : null}
      </div>
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sectionTitle}>Fila operacional</div>
        {!effectiveSettings?.queueEnabled ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Fila desativada para este contexto.</p>
        ) : visibleQueueEntries.length === 0 ? (
          <p>
            {canViewCompleteQueue
              ? "Nenhuma posição registrada na fila desta unidade."
              : currentActorEntry
                ? "Sua posição de fila não está mais disponível."
                : "Você ainda não possui posição registrada na fila desta unidade."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {visibleQueueEntries.map((entry) => (
              <div key={entry.id} style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 12, fontSize: 13, color: "var(--color-dust)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>Posição {entry.position}</span>
                  <span className="nexa-badge" style={{ color: "var(--color-fog)", background: "rgba(156,150,134,0.12)" }}>{getUnitQueueStatusLabel(entry.status)}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{entry.createdAt.toLocaleString("pt-BR")}</div>
                {canViewCompleteQueue ? (
                  <p>
                    Negociação vinculada:{" "}
                    <Link to={`/negociacoes/${entry.negotiationId}`}>
                      {entry.negotiationId}
                    </Link>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {effectiveSettings?.queueEnabled && queueRequired ? (
          <p style={{ color: "var(--color-terracotta)", fontSize: 12, marginTop: 12 }}>
            A unidade está indisponível. Entre na fila operacional.
          </p>
        ) : null}
        {unitQueueErrorMessage ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{unitQueueErrorMessage}</p> : null}
        {effectiveSettings?.queueEnabled && queueRequired ? (
          <button
            type="button"
            disabled={!canEnterQueueByRole || isCreatingQueueEntry || isUpdatingQueue || hasOpenQueueEntry}
            onClick={() => void handleCreateQueueEntry()}
            style={{ ...btnSecondary, marginTop: 12 }}
          >
            Entrar na fila
          </button>
        ) : null}
      </div>
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sectionTitle}>Solicitação de reserva</div>
        {reservationRequests.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma solicitação de reserva registrada.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {reservationRequests.map((request) => (
              <div key={request.id} style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--color-bone)", fontWeight: 600 }}>{getReservationStatusLabel(request.status)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{request.createdAt.toLocaleString("pt-BR")}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {canApproveReservationRequestByRole ? (
                    <button type="button" disabled={isUpdatingReservationRequest || request.status !== ReservationStatus.REQUESTED} onClick={() => void handleReservationRequestTransition(request.id, "approve")} style={btnPrimary}>
                      Aprovar
                    </button>
                  ) : null}
                  {canRejectReservationRequestByRole ? (
                    <button type="button" disabled={isUpdatingReservationRequest || request.status !== ReservationStatus.REQUESTED} onClick={() => void handleReservationRequestTransition(request.id, "reject")} style={btnDanger}>
                      Recusar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {reservationRequestsErrorMessage ? (
          <p>{reservationRequestsErrorMessage}</p>
        ) : null}
        <ReservationRequestForm
          canRequest={
            canRequestReservationByRole &&
            !isCreatingReservationRequest &&
            proposals.length > 0 &&
            !hasRequestedReservation &&
            !queueRequired
          }
          isCreating={isCreatingReservationRequest}
          onSubmit={() => void handleCreateReservationRequest()}
        />
      </div>
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sectionTitle}>Reserva</div>
        {reservations.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma reserva registrada.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {reservations.map((reservation) => (
              <div key={reservation.id} style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--color-bone)", fontWeight: 600 }}>{getReservationStatusLabel(reservation.status)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>Expira: {reservation.expiresAt.toLocaleString("pt-BR")}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-fog)" }}>Início: {reservation.startedAt.toLocaleString("pt-BR")}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {canCancelReservationByRole ? (
                    <button type="button" disabled={isUpdatingReservations || reservation.status !== ReservationStatus.ACTIVE} onClick={() => void handleReservationTransition(reservation.id, "cancel")} style={btnDanger}>Cancelar reserva</button>
                  ) : null}
                  {canExpireReservationByRole ? (
                    <button type="button" disabled={isUpdatingReservations || reservation.status !== ReservationStatus.ACTIVE} onClick={() => void handleReservationTransition(reservation.id, "expire")} style={btnSecondary}>Expirar reserva</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sectionTitle}>Venda</div>
        {sales.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma venda registrada.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sales.map((sale) => (
              <div key={sale.id} style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: "var(--color-bone)", fontWeight: 600 }}>R$ {sale.amount.toLocaleString("pt-BR")}</span>
                  <span className="nexa-badge" style={{ color: "var(--color-fog)", background: "rgba(156,150,134,0.12)" }}>{getSaleStatusLabel(sale.status)}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{sale.createdAt.toLocaleString("pt-BR")}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {canAdvanceSaleByRole ? (
                    <>
                      <button type="button" disabled={isTransitioningSale || !SaleService.podeAvancarParaDocumentos(sale)} onClick={() => void handleSaleTransition(sale.id, "documents")} style={btnSecondary}>Documentação</button>
                      <button type="button" disabled={isTransitioningSale || !SaleService.podeAvancarParaContrato(sale)} onClick={() => void handleSaleTransition(sale.id, "contract")} style={btnSecondary}>Contrato</button>
                      <button type="button" disabled={isTransitioningSale || !SaleService.podeAvancarParaPagamento(sale)} onClick={() => void handleSaleTransition(sale.id, "payment")} style={btnSecondary}>Pagamento</button>
                      <button type="button" disabled={isTransitioningSale || !SaleService.podeConcluir(sale)} onClick={() => void handleSaleTransition(sale.id, "complete")} style={btnPrimary}>Concluir</button>
                    </>
                  ) : null}
                  {canCancelSaleByRole ? (
                    <button type="button" disabled={isTransitioningSale || !SaleService.podeCancelar(sale)} onClick={() => void handleSaleTransition(sale.id, "cancel")} style={btnDanger}>Cancelar venda</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {salesErrorMessage ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{salesErrorMessage}</p> : null}
        <button type="button" disabled={!canConvertSaleByRole || isCreatingSale || !activeReservation || sales.length > 0} onClick={() => void handleCreateSale()} style={{ ...btnPrimary, marginTop: 12 }}>
          Converter em venda
        </button>
      </div>
      {negotiationErrorMessage ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{negotiationErrorMessage}</p> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" disabled={!canStartByRole || !canStart || isUpdating} onClick={() => void handleStartNegotiation()} style={btnPrimary}>
          Iniciar negociação
        </button>
        <button type="button" disabled={!canCancelByRole || !canCancel || isUpdating} onClick={() => void handleCancelNegotiation()} style={btnDanger}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ProposalForm(props: {
  canCreate: boolean;
  isCreating: boolean;
  defaultAmount: number;
  unitLabel?: string;
  tipo?: string;
  onSubmit: (data: {
    title: string; amount: number; tipo?: string;
    entradaTipo?: string; entradaValor?: number; entradaPercentual?: number;
    parcelasQuantidade?: number; parcelasValor?: number;
    balaoQuantidade?: number; balaoValor?: number;
    permutaValor?: number; permutaDescricao?: string; observacoes?: string;
  }) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(props.defaultAmount.toString());
  const [entradaPct, setEntradaPct] = useState(true);
  const [entradaVal, setEntradaVal] = useState("15");
  const [numParcelas, setNumParcelas] = useState("36");
  const [hasBalao, setHasBalao] = useState(false);
  const [balaoQtd, setBalaoQtd] = useState("6");
  const [balaoVal, setBalaoVal] = useState("");
  const [hasPermuta, setHasPermuta] = useState(false);
  const [permutaVal, setPermutaVal] = useState("");
  const [permutaDesc, setPermutaDesc] = useState("");
  const [obs, setObs] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  const amt = Number(amount) || 0;
  const entNum = Number(entradaVal) || 0;
  const entradaReais = entradaPct ? (amt * entNum / 100) : entNum;
  const financiado = Math.max(amt - entradaReais, 0);
  const nParcelas = Number(numParcelas) || 1;
  const parcelaVal = nParcelas > 0 ? financiado / nParcelas : 0;

  // Auto-focus on valor total when form opens
  useEffect(() => {
    if (showForm && amountRef.current) {
      amountRef.current.focus();
      amountRef.current.select();
    }
  }, [showForm]);

  // Auto-fill title when form opens
  useEffect(() => {
    if (showForm && !title) {
      const prefix = props.tipo === "contraproposta" ? "Contraproposta" : "Proposta";
      setTitle(props.unitLabel ? `${prefix} - ${props.unitLabel}` : "");
    }
  }, [showForm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-suggest balão values when toggled on
  const handleToggleBalao = useCallback(() => {
    if (!hasBalao) {
      setBalaoQtd("6");
      const suggestedVal = amt > 0 ? Math.round((amt * 0.05) / 6) : 0;
      setBalaoVal(suggestedVal > 0 ? suggestedVal.toString() : "");
    }
    setHasBalao(!hasBalao);
  }, [hasBalao, amt]);

  // Recalculate balão when amount changes (if balão is active)
  useEffect(() => {
    if (hasBalao && amt > 0) {
      const qty = Number(balaoQtd) || 6;
      const suggestedVal = Math.round((amt * 0.05) / qty);
      setBalaoVal(suggestedVal > 0 ? suggestedVal.toString() : "");
    }
  }, [amt, hasBalao]); // eslint-disable-line react-hooks/exhaustive-deps

  function fmt(v: number) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  const isValid = title.trim().length > 0 && amt > 0;
  const missingFields: string[] = [];
  if (!title.trim()) missingFields.push("título");
  if (amt <= 0) missingFields.push("valor total");

  if (!showForm) {
    return (
      <button type="button" disabled={!props.canCreate} onClick={() => setShowForm(true)}
        style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 700, marginTop: 12 }}>
        {props.tipo === "contraproposta" ? "Fazer contraproposta" : "Nova proposta"}
      </button>
    );
  }

  function handleSubmit() {
    if (!isValid) return;
    props.onSubmit({
      title: title.trim(), amount: amt, tipo: props.tipo ?? "proposta",
      entradaTipo: entradaPct ? "percentual" : "valor",
      entradaValor: entradaReais,
      entradaPercentual: entradaPct ? entNum : (amt > 0 ? (entradaReais / amt) * 100 : 0),
      parcelasQuantidade: nParcelas, parcelasValor: parcelaVal,
      balaoQuantidade: hasBalao ? Number(balaoQtd) || 0 : undefined,
      balaoValor: hasBalao ? Number(balaoVal) || 0 : undefined,
      permutaValor: hasPermuta ? Number(permutaVal) || 0 : undefined,
      permutaDescricao: hasPermuta ? permutaDesc.trim() || undefined : undefined,
      observacoes: obs.trim() || undefined,
    });
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setShowForm(false);
      setTitle(""); setAmount(props.defaultAmount.toString());
      setEntradaVal("15"); setNumParcelas("36");
      setHasBalao(false); setHasPermuta(false); setObs("");
    }, 1200);
  }

  const L = (props2: { children: React.ReactNode; label: string }) => (
    <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>{props2.label}</span>{props2.children}</label>
  );

  if (showSuccess) {
    return (
      <div style={{
        background: "var(--color-ink)", border: "2px solid var(--color-sprout)", borderRadius: 8, padding: 24, marginTop: 12,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        animation: "fadeIn 300ms ease",
      }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-sprout)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7.5L5.5 11L12 3" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-sprout)" }}>Proposta criada com sucesso</span>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div className="nexa-label" style={{ marginBottom: 16 }}>{props.tipo === "contraproposta" ? "Contraproposta" : "Nova proposta"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 600 }}>
        <L label="Título *"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Proposta comercial" /></L>
        <div>
          <L label="Valor total (R$) *"><input ref={amountRef} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="1000" /></L>
          {amt > 0 ? <div style={{ fontSize: 11, color: "var(--color-sprout)", marginTop: 4, fontWeight: 600 }}>R$ {fmt(amt)}</div> : null}
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="nexa-label">Entrada</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["R$", "%"] as const).map((m) => {
                const active = m === "%" ? entradaPct : !entradaPct;
                return (<button key={m} type="button" onClick={() => setEntradaPct(m === "%")} style={{ background: active ? "var(--color-sprout-muted)" : "transparent", color: active ? "var(--color-sprout)" : "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{m}</button>);
              })}
            </div>
          </div>
          <input type="number" value={entradaVal} onChange={(e) => setEntradaVal(e.target.value)} min="0" placeholder={entradaPct ? "15" : "36000"} />
          {amt > 0 ? <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>= R$ {fmt(entradaReais)}</div> : null}
        </div>
        <div>
          <L label="Parcelas">
            <select value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)}>
              {[12, 24, 36, 48, 60].map((n) => <option key={n} value={n}>{n}x</option>)}
              <option value="0">Personalizado</option>
            </select>
          </L>
          {numParcelas === "0" ? <input type="number" value="" onChange={(e) => setNumParcelas(e.target.value)} min="1" placeholder="Nº parcelas" style={{ marginTop: 6 }} /> : null}
          {financiado > 0 && nParcelas > 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-sprout)", marginTop: 6, fontWeight: 700, background: "var(--color-sprout-muted)", borderRadius: 4, padding: "4px 8px", display: "inline-block" }}>
              Parcela: R$ {fmt(parcelaVal)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Balão */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={handleToggleBalao} style={{ width: 36, height: 20, borderRadius: 10, background: hasBalao ? "var(--color-sprout)" : "var(--color-stone)", border: "none", position: "relative", flexShrink: 0 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: hasBalao ? 19 : 3, transition: "left 150ms" }} />
        </button>
        <span style={{ fontSize: 13, color: "var(--color-dust)" }}>Balão</span>
        {hasBalao && amt > 0 ? <span style={{ fontSize: 11, color: "var(--color-fog)" }}>(5% do valor total sugerido)</span> : null}
      </div>
      {hasBalao ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8, maxWidth: 600 }}>
          <div>
            <L label="Qtd. balões"><input type="number" value={balaoQtd} onChange={(e) => setBalaoQtd(e.target.value)} min="1" /></L>
          </div>
          <div>
            <L label="Valor de cada balão (R$)"><input type="number" value={balaoVal} onChange={(e) => setBalaoVal(e.target.value)} min="0" step="1000" /></L>
            {Number(balaoQtd) > 0 && Number(balaoVal) > 0 ? (
              <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Total balões: R$ {fmt(Number(balaoQtd) * Number(balaoVal))}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Permuta */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => setHasPermuta(!hasPermuta)} style={{ width: 36, height: 20, borderRadius: 10, background: hasPermuta ? "var(--color-sprout)" : "var(--color-stone)", border: "none", position: "relative", flexShrink: 0 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: hasPermuta ? 19 : 3, transition: "left 150ms" }} />
        </button>
        <span style={{ fontSize: 13, color: "var(--color-dust)" }}>Permuta</span>
      </div>
      {hasPermuta ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8, maxWidth: 600 }}>
          <L label="Valor da permuta (R$)"><input type="number" value={permutaVal} onChange={(e) => setPermutaVal(e.target.value)} min="0" /></L>
          <L label="Descrição da permuta"><input type="text" value={permutaDesc} onChange={(e) => setPermutaDesc(e.target.value)} placeholder="Ex: Veículo, terreno..." /></L>
        </div>
      ) : null}

      {/* Observações */}
      <div style={{ marginTop: 12, maxWidth: 600 }}>
        <L label="Observações"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Condições especiais, prazos..." /></L>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <button type="button" disabled={props.isCreating || !isValid} onClick={handleSubmit}
            style={{ background: isValid ? "var(--color-sprout)" : "var(--color-stone)", color: isValid ? "var(--color-ink)" : "var(--color-fog)", border: "none", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed" }}>
            {props.isCreating ? "Criando..." : "Criar proposta"}
          </button>
          {!isValid && missingFields.length > 0 ? (
            <div style={{ fontSize: 10, color: "var(--color-fog)", marginTop: 4 }}>Preencha: {missingFields.join(", ")}</div>
          ) : null}
        </div>
        <button type="button" onClick={() => setShowForm(false)}
          style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ReservationRequestForm(props: {
  canRequest: boolean;
  isCreating: boolean;
  onSubmit: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <button
        type="button"
        disabled={!props.canRequest}
        onClick={() => setShowForm(true)}
        style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 700, marginTop: 12 }}
      >
        Solicitar reserva
      </button>
    );
  }

  function handleSubmit() {
    props.onSubmit();
    setShowForm(false);
  }

  return (
    <div
      style={{
        background: "var(--color-ink)",
        border: "1px solid var(--color-stone)",
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
      }}
    >
      <div className="nexa-label" style={{ marginBottom: 12 }}>Solicitar reserva</div>
      <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <label>
          <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Observação (opcional)</span>
          <textarea
            rows={3}
            placeholder="Observações adicionais sobre a solicitação..."
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={props.isCreating}
            onClick={handleSubmit}
            style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 700 }}
          >
            {props.isCreating ? "Solicitando..." : "Confirmar solicitação"}
          </button>
          <button type="button" onClick={() => setShowForm(false)} style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
