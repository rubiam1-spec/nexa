import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { supabase } from "../../../infra/supabase/supabaseClient";
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
import NexaBadge from "../../../shared/components/NexaBadge";
import { SaleService } from "../../../domain/venda/SaleService";
import { getSaleStatusLabel } from "../../../domain/venda/SaleStatusLabel";
import { getUserRoleLabel } from "../../../shared/types/role";
import { useNegotiationDetail } from "../hooks/useNegotiationDetail";
import { formatDateTimeBRT } from "../../../shared/utils/dateUtils";
import LostReasonModal from "../../../shared/components/LostReasonModal";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useNegotiationSimulations } from "../hooks/useNegotiationSimulations";
import type { PipelineSimulation } from "../../../shared/types/simulation";

type ThirdPartyPropertySummary = { id: string; titulo: string; tipo: string; status: string; valorVenda: number | null; endereco: string | null };

// Engrenagem Comercial v1 — adapta PipelineSimulation para o shape esperado por ProposalForm.prefillData
function simulationToPrefill(sim: PipelineSimulation): ProposalPrefillData {
  const entradaTipo: "percentual" | "valor" =
    sim.entradaValor != null && sim.entradaValor > 0 ? "valor" : "percentual";
  return {
    simulationId: sim.id,
    values: {
      amount: sim.valorTotal,
      entradaTipo,
      entradaValor: sim.entradaValor ?? undefined,
      entradaPercentual: sim.entradaPercentual ?? undefined,
      parcelasQuantidade: sim.parcelasQuantidade ?? undefined,
      balaoQuantidade: sim.balaoQuantidade ?? undefined,
      balaoValor: sim.balaoValor ?? undefined,
      permutaValor: sim.permutaValor ?? undefined,
      permutaDescricao: sim.permutaDescricao ?? undefined,
      observacoes: sim.observacoes ?? undefined,
    },
  };
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `há ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 14) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks}sem`;
  const months = Math.floor(days / 30);
  return `há ${months}m`;
}

function CollapsibleSection({
  label, isEmpty, defaultOpen, children, actionButton,
}: {
  label: string;
  isEmpty: boolean;
  defaultOpen: boolean;
  children: React.ReactNode;
  actionButton?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{
      marginBottom: 8,
      background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
      border: "1px solid var(--border-default)",
      borderRadius: 10, overflow: "hidden",
    }}>
      <div
        onClick={() => setIsOpen((p) => !p)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", transition: "background 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(42,40,34,0.2)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
            <path d="M4 2L8 6L4 10" stroke="#706B5F" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: isEmpty ? "#706B5F" : "#9C9686",
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
          }}>
            {label}
          </span>
          {isEmpty && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#3D3A30", fontStyle: "italic" }}>
              vazio
            </span>
          )}
        </div>
        {actionButton ? <div onClick={(e) => e.stopPropagation()}>{actionButton}</div> : null}
      </div>
      {isOpen && (
        <div style={{ padding: "14px 20px 18px", borderTop: "1px solid rgba(42,40,34,0.3)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function NegotiationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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

  // Engrenagem Comercial v1 — simulações vinculadas e query param de pré-preenchimento
  const {
    simulations,
    isLoading: isLoadingSimulations,
    errorMessage: simulationsErrorMessage,
  } = useNegotiationSimulations(id ?? null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingPrefillSimId, setPendingPrefillSimId] = useState<string | null>(null);
  const [expandAllSimulations, setExpandAllSimulations] = useState(false);

  // Ao mount, se a URL tem ?createProposalFrom=SIM_ID, guarda e remove da URL
  // (evita reentrada caso o usuário navegue e volte).
  useEffect(() => {
    const sid = searchParams.get("createProposalFrom");
    if (sid) {
      setPendingPrefillSimId(sid);
      const next = new URLSearchParams(searchParams);
      next.delete("createProposalFrom");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch third-party property summary when negotiation links to one
  const [thirdPartyProperty, setThirdPartyProperty] = useState<ThirdPartyPropertySummary | null>(null);
  useEffect(() => {
    const tppId = negotiation?.thirdPartyPropertyId;
    if (!tppId || !supabase) { setThirdPartyProperty(null); return; }
    supabase.from("third_party_properties").select("id, titulo, tipo, status, valor_venda, endereco_completo").eq("id", tppId).maybeSingle().then(({ data }) => {
      if (data) setThirdPartyProperty({ id: data.id, titulo: data.titulo, tipo: data.tipo, status: data.status, valorVenda: data.valor_venda ? Number(data.valor_venda) : null, endereco: data.endereco_completo ?? null });
    });
  }, [negotiation?.thirdPartyPropertyId]);
  const isThirdParty = !!negotiation?.thirdPartyPropertyId;

  // Lost modal + broker change state
  const [showLostModal, setShowLostModal] = useState(false);
  const [showBrokerSelect, setShowBrokerSelect] = useState(false);
  const [brokersList, setBrokersList] = useState<{ id: string; name: string }[]>([]);
  const [actionSaving, setActionSaving] = useState(false);
  const { account: accountCtx } = useAccount();
  const accountId = accountCtx?.accountId ?? null;

  useEffect(() => {
    if (!showBrokerSelect || !supabase || !accountId) return;
    supabase.from("brokers").select("id, name").eq("account_id", accountId).eq("is_active", true).order("name").then(({ data }) => {
      setBrokersList((data ?? []).map((b: Record<string, unknown>) => ({ id: b.id as string, name: b.name as string })));
    });
  }, [showBrokerSelect, accountId]);

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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 16px" }}>Detalhe da negociação</h1>
        <div className="nexa-card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 14, color: "var(--color-fog)", marginBottom: 16 }}>
            Negociação não encontrada.
          </div>
          <Link to="/pipeline" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-sprout)" }}>← Voltar ao pipeline</Link>
        </div>
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
    simulationId?: string | null;
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
      simulationId: data.simulationId ?? null,
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

    // Auto-create reservation request when proposal is accepted
    if (action === "accept" && !activeReservation && !hasRequestedReservation) {
      try {
        const reqResult = await createRequest(authenticatedProfile?.id ?? null);
        if (reqResult) prependEvent(reqResult.historyEvent);
      } catch (err) {
        console.error("[NEXA] Auto reservation request after accept:", err);
      }
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

  const btnPrimary: React.CSSProperties = {
    background: "rgba(74,222,128,0.1)",
    color: "#4ADE80",
    border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: 8,
    padding: "0 14px",
    height: 32,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 150ms ease",
  };
  const btnSecondary: React.CSSProperties = {
    background: "transparent",
    color: "#C4BFB3",
    border: "1px solid rgba(61,58,48,0.2)",
    borderRadius: 8,
    padding: "0 14px",
    height: 32,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 150ms ease",
  };
  const btnDanger: React.CSSProperties = {
    background: "transparent",
    color: "#EF4444",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 8,
    padding: "0 14px",
    height: 32,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 150ms ease",
  };

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#5C5647", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Link to="/pipeline" style={{ color: "#706B5F", textDecoration: "none" }}>Pipeline</Link>
          <span style={{ color: "#3D3A30" }}>›</span>
          <Link to="/negociacoes" style={{ color: "#706B5F", textDecoration: "none" }}>Negociações</Link>
          <span style={{ color: "#3D3A30" }}>›</span>
          <span>{isThirdParty ? (thirdPartyProperty?.titulo || "Imóvel") : unit ? `Q${unit.quadra} · L${unit.lote}` : negotiation.id.slice(0, 8)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: "italic", fontSize: 28, color: "#FAF9F6",
              fontWeight: 400, margin: 0, lineHeight: 1.1,
            }}>
              {isThirdParty ? (thirdPartyProperty?.titulo || "Imóvel de terceiro") : unit ? `Quadra ${unit.quadra} – Lote ${unit.lote}` : `Negociação`}
            </h1>
            <NexaBadge entity="negotiation" status={negotiation.status} label={getNegotiationStatusLabel(negotiation.status)} />
            {isThirdParty ? <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "3px 8px", borderRadius: 4, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>IMÓVEL</span> : null}
          </div>

          {/* Action bar — moved to top */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canStart && canStartByRole && (
              <button type="button" disabled={isUpdating} onClick={() => void handleStartNegotiation()} style={{ ...btnPrimary, height: 34, fontSize: 11, padding: "0 12px" }}>Iniciar negociação</button>
            )}
            {canCancel && canCancelByRole && (
              <button type="button" disabled={isUpdating || actionSaving} onClick={() => setShowLostModal(true)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid rgba(248,113,113,0.3)", background: "transparent", color: "#F87171", cursor: "pointer" }}>Marcar como perdida</button>
            )}
            {canCancel && canCancelByRole && (
              <button type="button" disabled={isUpdating} onClick={() => void handleCancelNegotiation()} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid rgba(112,107,95,0.3)", background: "transparent", color: "#9C9686", cursor: "pointer" }}>Cancelar</button>
            )}
            {["owner", "director", "manager"].includes(actorRole ?? "") && negotiation.status !== NegotiationStatus.LOST && negotiation.status !== NegotiationStatus.CANCELLED && (
              <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setShowBrokerSelect(!showBrokerSelect)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid rgba(42,40,34,0.5)", background: "transparent", color: "#C4BFB3", cursor: "pointer" }}>Trocar corretor</button>
                {showBrokerSelect && (
                  <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, marginTop: 4, background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--border-default)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 220, maxHeight: 240, overflowY: "auto", padding: "4px 0" }}>
                    <div style={{ padding: "6px 12px", fontSize: 10, color: "#5C5647", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Selecionar corretor</div>
                    <div onClick={async () => { if (!supabase || !id || actionSaving) return; setActionSaving(true); try { await supabase.from("negotiations").update({ broker_id: null }).eq("id", id); setShowBrokerSelect(false); replaceNegotiation({ ...negotiation, brokerId: null }); } catch { /* ignore */ } finally { setActionSaving(false); } }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#5C5647", fontStyle: "italic", borderBottom: "1px solid rgba(61,58,48,0.1)" }}>— Nenhum</div>
                    {brokersList.map((b) => (
                      <div key={b.id} onClick={async () => { if (!supabase || !id || actionSaving) return; setActionSaving(true); try { await supabase.from("negotiations").update({ broker_id: b.id }).eq("id", id); setShowBrokerSelect(false); replaceNegotiation({ ...negotiation, brokerId: b.id }); } catch { /* ignore */ } finally { setActionSaving(false); } }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#C4BFB3", borderBottom: "1px solid rgba(61,58,48,0.06)" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,222,128,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>{b.name}{broker?.id === b.id ? <span style={{ fontSize: 10, color: "#4ADE80", marginLeft: 8 }}>atual</span> : null}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9C9686", marginTop: 4, letterSpacing: "0.03em" }}>
          {client?.name ?? "Sem cliente"} · {broker?.name ?? "Sem corretor"} · {isThirdParty && thirdPartyProperty?.valorVenda ? `R$ ${thirdPartyProperty.valorVenda.toLocaleString("pt-BR")}` : unit ? `R$ ${unit.valor.toLocaleString("pt-BR")}` : "—"} · {getUserRoleLabel(actorRole)}
        </div>
      </div>

      {/* Stepper do fluxo comercial */}
      {(() => {
        const hasAcceptedProposal = proposals.some((p) => p.status === "ACCEPTED");
        const hasReservation = reservations.length > 0;
        const hasSale = sales.length > 0;
        const steps = [
          { label: "Negociação", done: true },
          { label: "Proposta", done: hasAcceptedProposal },
          { label: "Reserva", done: hasReservation },
          { label: "Venda", done: hasSale },
        ];
        const currentStep = hasSale ? 3 : hasReservation ? 2 : hasAcceptedProposal ? 1 : 0;
        return (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 20, padding: "20px 24px", background: "linear-gradient(168deg, rgba(34,33,28,0.5), rgba(18,17,14,0.15))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 12 }}>
            {steps.map((step, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              const dotColor = isCompleted || isCurrent ? "#4ADE80" : "#2A2822";
              return (
                <div key={step.label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isCompleted ? "rgba(74,222,128,0.15)" : isCurrent ? "rgba(74,222,128,0.1)" : "rgba(42,40,34,0.5)", border: `2px solid ${dotColor}`, fontSize: 10, fontWeight: 700, color: isCompleted || isCurrent ? "#4ADE80" : "#3D3A30", fontFamily: "var(--font-mono)", transition: "all 200ms ease" }}>
                      {step.done ? "✓" : (i + 1)}
                    </div>
                    <span style={{ fontSize: 8.5, fontFamily: "var(--font-mono)", color: isCurrent ? "#E8E5DE" : isCompleted ? "#5C5647" : "#3D3A30", fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 ? (
                    <div style={{ flex: 1, height: 2, borderRadius: 1, background: isCompleted ? "rgba(74,222,128,0.4)" : "rgba(61,58,48,0.15)", margin: "0 8px", marginBottom: 20 }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Summary card */}
      <div style={{ marginBottom: 16, padding: 20, background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid var(--border-default)", borderRadius: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: "16px 24px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Valor</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "#4ADE80" }}>{isThirdParty && thirdPartyProperty?.valorVenda ? `R$ ${thirdPartyProperty.valorVenda.toLocaleString("pt-BR")}` : unit ? `R$ ${unit.valor.toLocaleString("pt-BR")}` : "—"}</div>
          </div>
          {isThirdParty && thirdPartyProperty ? (
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Imóvel</div>
              <div style={{ fontSize: 14, color: "#E8E5DE", fontWeight: 500, cursor: "pointer", borderBottom: "1px dashed rgba(92,86,71,0.3)", display: "inline" }} onClick={() => navigate(`/imoveis/${thirdPartyProperty.id}`)}>{thirdPartyProperty.titulo} · {thirdPartyProperty.tipo}</div>
            </div>
          ) : null}
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Cliente</div>
            <div style={{ fontSize: 14, color: "#E8E5DE", fontWeight: 500 }}>{client?.name ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Corretor</div>
            <div style={{ fontSize: 14, color: "#E8E5DE", fontWeight: 500 }}>{broker?.name ?? "—"}{broker?.brokerageName ? ` · ${broker.brokerageName}` : ""}</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Prazo de reserva</div>
            <div style={{ fontSize: 14, color: "#E8E5DE", fontWeight: 500 }}>{effectiveSettings?.reservationDurationHours ?? 0}h</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Proposta aceita</div>
            <div style={{ fontSize: 14, color: "#E8E5DE", fontWeight: 500 }}>{effectiveSettings?.requireAcceptedProposalForReservationRequest ? "Reserva automática" : "Reserva via solicitação"}</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Fila</div>
            <div style={{ fontSize: 14, color: "#E8E5DE", fontWeight: 500 }}>{effectiveSettings?.queueEnabled ? "Ativa" : "Inativa"}</div>
          </div>
        </div>
      </div>
      {(() => {
        const hasProposals = proposals.length > 0;
        const hasAcceptedProp = proposals.some((p) => p.status === "ACCEPTED");
        const hasReservationRequest = reservationRequests.length > 0;
        const hasReservation = reservations.length > 0;
        const hasSale = sales.length > 0;
        const queueEnabled = Boolean(effectiveSettings?.queueEnabled);
        const hasQueue = visibleQueueEntries.length > 0;
        const hasHistory = events.length > 0;

        const showQueue = queueEnabled && (hasQueue || queueRequired);
        const showReservationRequest = hasProposals || hasReservationRequest;
        const showReservation = hasReservationRequest || hasReservation;
        const showSale = hasReservation || hasSale;

        return (
          <>
            {/* Primary CTA by stage */}
            {!hasProposals && negotiation.status !== NegotiationStatus.CANCELLED && negotiation.status !== NegotiationStatus.LOST && negotiation.status !== NegotiationStatus.WON ? (
              <div style={{ marginBottom: 12, padding: "12px 16px", background: "linear-gradient(145deg, rgba(74,222,128,0.08), rgba(74,222,128,0.02))", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#4ADE80", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Próximo passo</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>Criar a primeira proposta para esta negociação</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#706B5F" }}>↓ veja a seção Propostas</div>
              </div>
            ) : hasAcceptedProp && !hasReservationRequest && !hasReservation ? (
              <div style={{ marginBottom: 12, padding: "12px 16px", background: "linear-gradient(145deg, rgba(74,222,128,0.08), rgba(74,222,128,0.02))", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#4ADE80", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Próximo passo</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>Proposta aceita — solicitar reserva da unidade</div>
                </div>
                <button type="button" disabled={!canRequestReservationByRole || isCreatingReservationRequest} onClick={() => void handleCreateReservationRequest()} style={{ padding: "8px 14px", borderRadius: 8, background: "#4ADE80", color: "#12110F", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "0.05em" }}>SOLICITAR RESERVA</button>
              </div>
            ) : hasReservation && !hasSale ? (
              <div style={{ marginBottom: 12, padding: "12px 16px", background: "linear-gradient(145deg, rgba(96,165,250,0.08), rgba(96,165,250,0.02))", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#60A5FA", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Próximo passo</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>Reserva ativa — converter em venda</div>
                </div>
                <button type="button" disabled={!canConvertSaleByRole || isCreatingSale || !activeReservation} onClick={() => void handleCreateSale()} style={{ padding: "8px 14px", borderRadius: 8, background: "#60A5FA", color: "#12110F", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "0.05em" }}>CONVERTER EM VENDA</button>
              </div>
            ) : null}

      <CollapsibleSection label="Histórico" isEmpty={!hasHistory} defaultOpen={hasHistory}>
        {events.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Nenhum registro</p>
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
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-slate)" }}>{formatDateTimeBRT(event.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Engrenagem Comercial v1 — Simulações vinculadas à negociação */}
      <CollapsibleSection label="Simulações" isEmpty={simulations.length === 0} defaultOpen={simulations.length > 0 || !!pendingPrefillSimId}>
        {isLoadingSimulations ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Carregando simulações...</p>
        ) : simulations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
            <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Nenhuma simulação vinculada.</p>
            <button
              type="button"
              onClick={() => navigate(`/simulador?negotiation_id=${id}`)}
              style={{ background: "transparent", color: "var(--color-sprout)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Abrir simulador
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => navigate(`/simulador?negotiation_id=${id}`)}
                style={{ background: "transparent", color: "var(--color-sprout)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Nova simulação
              </button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {(expandAllSimulations || simulations.length <= 5 ? simulations : simulations.slice(0, 3)).map((sim) => {
                const isSelectedForPrefill = pendingPrefillSimId === sim.id;
                return (
                  <div
                    key={sim.id}
                    style={{
                      background: "var(--color-ink)",
                      border: `1px solid ${isSelectedForPrefill ? "rgba(74,222,128,0.4)" : "var(--color-stone)"}`,
                      borderRadius: 8,
                      padding: 16,
                      transition: "border-color 150ms ease",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>
                      {formatBRL(sim.valorTotal)}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-dust)", marginBottom: 4 }}>
                      {sim.entradaValor != null || sim.entradaPercentual != null ? (
                        <>
                          Entrada {sim.entradaValor != null ? formatBRL(sim.entradaValor) : "—"}
                          {sim.entradaPercentual != null ? ` (${Math.round(sim.entradaPercentual)}%)` : ""}
                          {sim.parcelasQuantidade ? ` · ${sim.parcelasQuantidade}x` : ""}
                          {sim.parcelasValor ? ` de ${formatBRL(sim.parcelasValor)}` : ""}
                        </>
                      ) : (
                        sim.parcelasQuantidade ? `${sim.parcelasQuantidade}x` : null
                      )}
                    </div>
                    {sim.balaoQuantidade && sim.balaoValor ? (
                      <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 2 }}>
                        Balão: {formatBRL(sim.balaoValor)} × {sim.balaoQuantidade}
                      </div>
                    ) : null}
                    {sim.permutaValor ? (
                      <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 2 }}>
                        Permuta: {formatBRL(sim.permutaValor)}
                        {sim.permutaDescricao ? ` · ${sim.permutaDescricao}` : ""}
                      </div>
                    ) : null}
                    {sim.observacoes ? (
                      <div style={{ fontSize: 12, color: "var(--color-fog)", marginTop: 4, fontStyle: "italic" }}>
                        {sim.observacoes.length > 120 ? `${sim.observacoes.slice(0, 120)}…` : sim.observacoes}
                      </div>
                    ) : null}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-slate)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 10 }}>
                      {formatRelativeDate(sim.createdAt)}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => setPendingPrefillSimId(sim.id)}
                        disabled={!canCreateProposalByRole || isCreating || negotiation.status === NegotiationStatus.CANCELLED}
                        style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: (!canCreateProposalByRole || isCreating) ? "not-allowed" : "pointer", opacity: (!canCreateProposalByRole || isCreating) ? 0.55 : 1 }}
                      >
                        Criar proposta a partir desta
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/simulador?simulationId=${sim.id}&negotiation_id=${id}`)}
                        style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        Abrir no simulador
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {!expandAllSimulations && simulations.length > 5 ? (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setExpandAllSimulations(true)}
                  style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}
                >
                  Ver mais {simulations.length - 3} simulações
                </button>
              </div>
            ) : null}
          </>
        )}
        {simulationsErrorMessage ? (
          <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{simulationsErrorMessage}</p>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection label="Propostas" isEmpty={!hasProposals} defaultOpen={true}>
        {proposals.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: "0 0 12px" }}>Nenhuma proposta vinculada.</p>
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
                  <span className="nexa-badge" style={{ color: proposal.status === "COUNTER_PROPOSAL" ? "#A78BFA" : proposal.status === "ACCEPTED" ? "#4ADE80" : proposal.status === "REJECTED" ? "#F87171" : "#60A5FA", background: proposal.status === "COUNTER_PROPOSAL" ? "rgba(167,139,250,0.12)" : proposal.status === "ACCEPTED" ? "rgba(74,222,128,0.12)" : proposal.status === "REJECTED" ? "rgba(248,113,113,0.12)" : "rgba(96,165,250,0.12)" }}>{getProposalStatusLabel(proposal.status)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-dust)", display: "flex", gap: 16 }}>
                  <span>R$ {proposal.amount.toLocaleString("pt-BR")}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{formatDateTimeBRT(proposal.createdAt)}</span>
                </div>
                {ProposalService.isActionable(proposal) ? (
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
                ) : null}
                {/* Counter proposal badge */}
                {proposal.status === "COUNTER_PROPOSAL" ? (
                  <div style={{ marginTop: 8, fontSize: 12, fontStyle: "italic", color: "#A78BFA" }}>Devolvida com contraproposta</div>
                ) : null}
                {/* Contraproposta justificativa */}
                {proposal.observacoes && proposal.tipo === "contraproposta" ? (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, fontSize: 12, color: "var(--color-dust)" }}>
                    <span style={{ color: "#A78BFA", fontWeight: 500 }}>Justificativa: </span>{proposal.observacoes}
                  </div>
                ) : null}
                {proposal.status === "ACCEPTED" && !activeReservation && !hasRequestedReservation ? (
                  <div style={{ marginTop: 12, padding: "12px 16px", background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--color-sprout)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.5L3.5 7.5L8.5 2.5" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-sprout)" }}>Proposta aceita! Deseja solicitar a reserva agora?</span>
                    </div>
                    <button type="button"
                      disabled={!canRequestReservationByRole || isCreatingReservationRequest}
                      onClick={() => void handleCreateReservationRequest()}
                      style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 6, padding: "0 12px", height: 28, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      Solicitar reserva
                    </button>
                  </div>
                ) : null}
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
          prefillData={(() => {
            if (!pendingPrefillSimId) return null;
            const sim = simulations.find((s) => s.id === pendingPrefillSimId);
            return sim ? simulationToPrefill(sim) : null;
          })()}
          onPrefillConsumed={() => setPendingPrefillSimId(null)}
          onSubmit={(data) => void handleCreateProposal(data)}
        />
        {(() => {
          const hasProposalToCounter = proposals.some((p) => ["SENT", "UNDER_ANALYSIS"].includes(p.status));
          const hasActiveCounterProposal = proposals.some((p) => p.tipo === "contraproposta" && ["DRAFT", "SENT", "UNDER_ANALYSIS"].includes(p.status));
          return canOperateProposalByRole && hasProposalToCounter && !hasActiveCounterProposal ? (
            <ProposalForm
              canCreate={canOperateProposalByRole && !isCreating && negotiation.status !== NegotiationStatus.CANCELLED}
              isCreating={isCreating}
              defaultAmount={unit?.valor ?? 0}
              unitLabel={unit ? `Quadra ${unit.quadra} - Lote ${unit.lote}` : undefined}
              tipo="contraproposta"
              onSubmit={(data) => void handleCreateProposal(data)}
            />
          ) : null;
        })()}
      </CollapsibleSection>

      {showQueue && (
      <CollapsibleSection label="Fila operacional" isEmpty={!hasQueue} defaultOpen={hasQueue || queueRequired}>
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
              <div key={entry.id} style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.35), rgba(18,17,14,0.1))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 8, padding: 12, fontSize: 13, color: "var(--color-dust)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>Posição {entry.position}</span>
                  <span className="nexa-badge" style={{ color: "var(--color-fog)", background: "rgba(156,150,134,0.12)" }}>{getUnitQueueStatusLabel(entry.status)}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{formatDateTimeBRT(entry.createdAt)}</div>
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
      </CollapsibleSection>
      )}

      {showReservationRequest && (
      <CollapsibleSection label="Solicitação de reserva" isEmpty={!hasReservationRequest} defaultOpen={hasReservationRequest}>
        {reservationRequests.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma solicitação de reserva registrada.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {reservationRequests.map((request) => (
              <div key={request.id} style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.35), rgba(18,17,14,0.1))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--color-bone)", fontWeight: 600 }}>{getReservationStatusLabel(request.status)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{formatDateTimeBRT(request.createdAt)}</span>
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
            !hasRequestedReservation &&
            !activeReservation &&
            !queueRequired
          }
          isCreating={isCreatingReservationRequest}
          onSubmit={() => void handleCreateReservationRequest()}
        />
      </CollapsibleSection>
      )}

      {showReservation && (
      <CollapsibleSection label="Reserva" isEmpty={!hasReservation} defaultOpen={hasReservation}>
        {reservations.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma reserva registrada.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {reservations.map((reservation) => (
              <div key={reservation.id} style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.35), rgba(18,17,14,0.1))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--color-bone)", fontWeight: 600 }}>{getReservationStatusLabel(reservation.status)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>Expira: {formatDateTimeBRT(reservation.expiresAt)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-fog)" }}>Início: {formatDateTimeBRT(reservation.startedAt)}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {canCancelReservationByRole ? (
                    <button type="button" disabled={isUpdatingReservations || reservation.status !== ReservationStatus.ACTIVE} onClick={() => void handleReservationTransition(reservation.id, "cancel")} style={btnDanger}>Cancelar reserva</button>
                  ) : null}
                  {canExpireReservationByRole ? (
                    <button type="button" disabled={isUpdatingReservations || reservation.status !== ReservationStatus.ACTIVE} onClick={() => void handleReservationTransition(reservation.id, "expire")} style={btnSecondary}>Expirar reserva</button>
                  ) : null}
                </div>
                {reservation.status === "ACTIVE" && sales.length === 0 && canConvertSaleByRole ? (
                  <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#60A5FA" }}>Reserva ativa! Deseja converter em venda?</span>
                    <button type="button"
                      disabled={isCreatingSale}
                      onClick={() => void handleCreateSale()}
                      style={{ background: "#60A5FA", color: "var(--color-ink)", border: "none", borderRadius: 6, padding: "0 12px", height: 28, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {isCreatingSale ? "Convertendo..." : "Converter em venda"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
      )}

      {showSale && (
      <CollapsibleSection label="Venda" isEmpty={!hasSale} defaultOpen={hasSale}>
        {sales.length === 0 ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma venda registrada.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sales.map((sale) => (
              <div key={sale.id} style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.35), rgba(18,17,14,0.1))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: "var(--color-bone)", fontWeight: 600 }}>R$ {sale.amount.toLocaleString("pt-BR")}</span>
                  <span className="nexa-badge" style={{ color: "var(--color-fog)", background: "rgba(156,150,134,0.12)" }}>{getSaleStatusLabel(sale.status)}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-slate)" }}>{formatDateTimeBRT(sale.createdAt)}</div>
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
      </CollapsibleSection>
      )}
          </>
        );
      })()}
      {negotiationErrorMessage ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{negotiationErrorMessage}</p> : null}


      {/* Lost modal */}
      <LostReasonModal
        isOpen={showLostModal}
        onClose={() => setShowLostModal(false)}
        showCascadeOption={false}
        entityLabel="negociação"
        onConfirm={async ({ reason, detail }) => {
          if (!supabase || !id || !accountId) return;
          setActionSaving(true);
          try {
            await supabase.from("negotiations").update({
              status: "LOST",
              lost_reason: reason,
              lost_at: new Date().toISOString(),
              lost_at_stage: negotiation.status,
              updated_at: new Date().toISOString(),
            }).eq("id", id);
            // Log activity
            if (authenticatedProfile?.id) {
              await supabase.from("activity_logs").insert({
                account_id: accountId,
                entity: "negotiation",
                entity_id: id,
                action: "lost",
                previous_value: { status: negotiation.status },
                new_value: { status: "LOST", lost_reason: reason, detail },
                user_id: authenticatedProfile.id,
                user_role: actorRole ?? "unknown",
              }).then(() => {}, () => {});
            }
            replaceNegotiation(NegotiationService.alterarStatus(negotiation, NegotiationStatus.LOST));
          } catch (err) { console.error("Erro ao marcar como perdida:", err); }
          finally { setActionSaving(false); }
        }}
      />
    </div>
  );
}

// Stable label wrapper — defined at module scope to prevent focus loss on children
function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>{label}</span>{children}</label>;
}

export type ProposalPrefillData = {
  simulationId: string;
  values: {
    title?: string;
    amount?: number;
    entradaTipo?: "percentual" | "valor";
    entradaValor?: number;
    entradaPercentual?: number;
    parcelasQuantidade?: number;
    balaoQuantidade?: number;
    balaoValor?: number;
    permutaValor?: number;
    permutaDescricao?: string;
    observacoes?: string;
  };
};

function ProposalForm(props: {
  canCreate: boolean;
  isCreating: boolean;
  defaultAmount: number;
  unitLabel?: string;
  tipo?: string;
  /** Engrenagem Comercial v1 — pré-preenche form + armazena simulationId para persistir vínculo. */
  prefillData?: ProposalPrefillData | null;
  /** Chamado após o form ser dispensado (sucesso ou cancelar) para o pai limpar o prefillData. */
  onPrefillConsumed?: () => void;
  onSubmit: (data: {
    title: string; amount: number; tipo?: string;
    entradaTipo?: string; entradaValor?: number; entradaPercentual?: number;
    parcelasQuantidade?: number; parcelasValor?: number;
    balaoQuantidade?: number; balaoValor?: number;
    permutaValor?: number; permutaDescricao?: string; observacoes?: string;
    simulationId?: string | null;
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
  // Engrenagem v1 — simulationId mantido internamente durante a edição.
  const [prefillSimulationId, setPrefillSimulationId] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // Engrenagem v1 — quando chega prefillData (via card "Criar proposta a partir
  // desta" ou via ?createProposalFrom= na URL), hidratamos o form e abrimos.
  useEffect(() => {
    if (!props.prefillData) return;
    const v = props.prefillData.values;
    if (v.title !== undefined) setTitle(v.title);
    if (v.amount !== undefined) setAmount(String(Math.round(v.amount)));
    if (v.entradaTipo !== undefined) setEntradaPct(v.entradaTipo === "percentual");
    if (v.entradaTipo === "valor" && v.entradaValor !== undefined) {
      setEntradaVal(String(Math.round(v.entradaValor)));
    } else if (v.entradaPercentual !== undefined) {
      setEntradaVal(String(Math.round(v.entradaPercentual * 100) / 100));
    }
    if (v.parcelasQuantidade !== undefined) setNumParcelas(String(v.parcelasQuantidade));
    if (v.balaoQuantidade && v.balaoValor) {
      setHasBalao(true);
      setBalaoQtd(String(v.balaoQuantidade));
      setBalaoVal(String(Math.round(v.balaoValor)));
    }
    if (v.permutaValor && v.permutaValor > 0) {
      setHasPermuta(true);
      setPermutaVal(String(Math.round(v.permutaValor)));
      setPermutaDesc(v.permutaDescricao ?? "");
    }
    if (v.observacoes !== undefined) setObs(v.observacoes);
    setPrefillSimulationId(props.prefillData.simulationId);
    setShowForm(true);
  }, [props.prefillData]);

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
      simulationId: prefillSimulationId,
    });
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setShowForm(false);
      setTitle(""); setAmount(props.defaultAmount.toString());
      setEntradaVal("15"); setNumParcelas("36");
      setHasBalao(false); setHasPermuta(false); setObs("");
      setPrefillSimulationId(null);
      props.onPrefillConsumed?.();
    }, 1200);
  }

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
    <div style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.35), rgba(18,17,14,0.1))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div className="nexa-label" style={{ marginBottom: 16 }}>{props.tipo === "contraproposta" ? "Contraproposta" : "Nova proposta"}</div>
      {prefillSimulationId ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#4ADE80", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12, padding: "6px 10px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, display: "inline-block" }}>
          A partir da simulação
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 600 }}>
        <FormLabel label="Título *"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Proposta comercial" /></FormLabel>
        <div>
          <FormLabel label="Valor total (R$) *"><input ref={amountRef} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="1000" /></FormLabel>
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
          <FormLabel label="Parcelas">
            <select value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)}>
              {[12, 24, 36, 48, 60].map((n) => <option key={n} value={n}>{n}x</option>)}
              <option value="0">Personalizado</option>
            </select>
          </FormLabel>
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
            <FormLabel label="Qtd. balões"><input type="number" value={balaoQtd} onChange={(e) => setBalaoQtd(e.target.value)} min="1" /></FormLabel>
          </div>
          <div>
            <FormLabel label="Valor de cada balão (R$)"><input type="number" value={balaoVal} onChange={(e) => setBalaoVal(e.target.value)} min="0" step="1000" /></FormLabel>
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
          <FormLabel label="Valor da permuta (R$)"><input type="number" value={permutaVal} onChange={(e) => setPermutaVal(e.target.value)} min="0" /></FormLabel>
          <FormLabel label="Descrição da permuta"><input type="text" value={permutaDesc} onChange={(e) => setPermutaDesc(e.target.value)} placeholder="Ex: Veículo, terreno..." /></FormLabel>
        </div>
      ) : null}

      {/* Observações */}
      <div style={{ marginTop: 12, maxWidth: 600 }}>
        <label>
          <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Observações</span>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Condições especiais, prazos..." />
        </label>
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
        <button type="button" onClick={() => { setShowForm(false); setPrefillSimulationId(null); props.onPrefillConsumed?.(); }}
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
