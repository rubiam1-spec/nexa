import { useState, useRef, useEffect, useCallback, useMemo, useReducer } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
import { SaleStatus } from "../../../domain/venda/SaleStatus";
import { createClient, getClientWithSpouse } from "../../../infra/repositories/clientsSupabaseRepository";
import { addParty as addPartyRepo } from "../../../infra/repositories/negotiationPartiesSupabaseRepository";
import { formatPhone } from "../../../shared/utils/masks";
import { useNegotiationDetail } from "../hooks/useNegotiationDetail";
import { formatDateTimeBRT } from "../../../shared/utils/dateUtils";
import LostReasonModal from "../../../shared/components/LostReasonModal";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useNegotiationSimulations } from "../hooks/useNegotiationSimulations";
import type { PipelineSimulation } from "../../../shared/types/simulation";
import { useNegotiationParties } from "../hooks/useNegotiationParties";
import { usePartyMutations } from "../hooks/usePartyMutations";
import {
  LEGAL_REGIME_LABELS,
  PARTY_ROLE_LABELS,
  SIGNING_CAPACITY_LABELS,
} from "../../../shared/types/negotiationParty";
import type { LegalRegime, NegotiationParty, SigningCapacity, UpdatePartyInput } from "../../../shared/types/negotiationParty";

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

// Engrenagem de Partes v1 — formata CPF nu (11 dígitos) ou já mascarado.
function formatCPF(cpf: string | null): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
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

export default function NegotiationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Toast de confirmação quando chega da criação (flag passada via navigate state).
  const [showCreatedToast, setShowCreatedToast] = useState(Boolean((location.state as { justCreated?: boolean } | null)?.justCreated));
  useEffect(() => {
    if (!showCreatedToast) return;
    window.history.replaceState({}, ""); // evita reaparecer no refresh/voltar
    const t = setTimeout(() => setShowCreatedToast(false), 3500);
    return () => clearTimeout(t);
  }, [showCreatedToast]);
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
      documentsGate,
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

  // Engrenagem de Partes v1 — lista de partes + mutations
  const {
    parties,
    isLoading: isLoadingParties,
    errorMessage: partiesErrorMessage,
    refresh: refreshParties,
  } = useNegotiationParties(id ?? null);
  const {
    addParty,
    updateParty,
    removeParty,
    isMutating: isMutatingParty,
    errorMessage: partyMutationError,
  } = usePartyMutations();
  const [partyToRemove, setPartyToRemove] = useState<{ id: string; name: string } | null>(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingPrefillSimId, setPendingPrefillSimId] = useState<string | null>(null);
  const [expandAllSimulations, setExpandAllSimulations] = useState(false);

  // Sprint B.2.2 — IDs de clientes já vinculados como party (evita aparecer
  // novamente na busca do AddPartyModal).
  const alreadyLinkedClientIds = useMemo(
    () => parties.map(({ client }) => client.id),
    [parties],
  );

  // Sprint B.1 — buscar cônjuge se houver, para compor título do casal
  // Sprint B.2 — expandido com cpf/phone/email para card de cônjuge pendente
  type SpouseSummary = {
    id: string;
    name: string;
    fullName: string | null;
    cpf: string | null;
    phone: string | null;
    email: string | null;
  };
  const [spouseClient, setSpouseClient] = useState<SpouseSummary | null>(null);
  type ActiveTab = "resumo" | "partes" | "documentos" | "proposta" | "reserva" | "historico";
  const [activeTab, setActiveTab] = useState<ActiveTab>("resumo");

  useEffect(() => {
    if (!client?.id) {
      setSpouseClient(null);
      return;
    }
    let cancelled = false;
    getClientWithSpouse(client.id)
      .then((result) => {
        if (cancelled) return;
        if (result?.spouse) {
          setSpouseClient({
            id: result.spouse.id,
            name: result.spouse.name,
            fullName: result.spouse.fullName ?? null,
            cpf: result.spouse.cpf ?? null,
            phone: result.spouse.phone || null,
            email: result.spouse.email || null,
          });
        } else {
          setSpouseClient(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSpouseClient(null);
      });
    return () => { cancelled = true; };
  }, [client?.id]);

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
          <Link to="/negociacoes" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-sprout)" }}>← Voltar às negociações</Link>
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

  // Sprint B.2 — vincula spouse cadastrado mas ainda não em
  // negotiation_parties (caso real: casal vinculado depois da
  // negociação; trigger auto-link não disparou).
  async function handleAddSpouseToNegotiation() {
    if (!spouseClient || !id) return;
    const result = await addParty({
      negotiationId: id,
      clientId: spouseClient.id,
      role: "spouse",
      legalRegime: null,
      signingCapacity: null,
    });
    if (result) {
      await refreshParties();
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

  // Sprint B.1 — vars lifted da IIFE antiga para acesso compartilhado entre
  // banner (acima das tabs) e tab content (abaixo).
  const hasProposals = proposals.length > 0;
  const hasAcceptedProp = proposals.some((p) => p.status === "ACCEPTED");
  const hasReservationRequest = reservationRequests.length > 0;
  const hasReservation = reservations.length > 0;
  const hasSale = sales.length > 0;
  const queueEnabled = Boolean(effectiveSettings?.queueEnabled);
  const hasQueue = visibleQueueEntries.length > 0;
  const showQueue = queueEnabled && (hasQueue || queueRequired);
  const showReservationRequest = hasProposals || hasReservationRequest;
  const showReservation = hasReservationRequest || hasReservation;
  const showSale = hasReservation || hasSale;

  // Sprint B.1 — título do casal/cliente
  const principalNome = client?.fullName || client?.name || null;
  const conjugeNome = spouseClient?.fullName || spouseClient?.name || null;
  const tituloPrincipal = principalNome
    ? (conjugeNome ? `${principalNome} + ${conjugeNome}` : principalNome)
    : (isThirdParty
        ? (thirdPartyProperty?.titulo || "Imóvel de terceiro")
        : unit
          ? `Quadra ${unit.quadra} – Lote ${unit.lote}`
          : "Negociação");
  const subtituloUnidade = isThirdParty && thirdPartyProperty
    ? `${thirdPartyProperty.titulo} · ${thirdPartyProperty.tipo}`
    : unit
      ? `Quadra ${unit.quadra} · Lote ${unit.lote}`
      : null;
  const subtituloValor = isThirdParty && thirdPartyProperty?.valorVenda
    ? `R$ ${thirdPartyProperty.valorVenda.toLocaleString("pt-BR")}`
    : unit
      ? `R$ ${unit.valor.toLocaleString("pt-BR")}`
      : null;

  return (
    <div>
      {showCreatedToast ? (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 10000, background: "var(--surface-raised)", border: "1px solid rgba(74,222,128,0.4)", borderRadius: 12, padding: "12px 18px", boxShadow: "0 0 24px rgba(74,222,128,0.15)", display: "flex", alignItems: "center", gap: 10, color: "#4ADE80", fontSize: 14, fontWeight: 700 }}>
          <span>✓</span> Salvo com sucesso
        </div>
      ) : null}
      {/* Breadcrumb + Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#5C5647", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Link to="/negociacoes" style={{ color: "#706B5F", textDecoration: "none" }}>Negociações</Link>
          <span style={{ color: "#3D3A30" }}>›</span>
          <span>{negotiation.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
              <h1 style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: "italic", fontSize: 28, color: "#FAF9F6",
                fontWeight: 400, margin: 0, lineHeight: 1.1,
              }}>
                {tituloPrincipal}
              </h1>
              <NexaBadge entity="negotiation" status={negotiation.status} label={getNegotiationStatusLabel(negotiation.status)} />
              {isThirdParty ? <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "3px 8px", borderRadius: 4, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>IMÓVEL</span> : null}
            </div>
            {/* Subtítulo: unidade · valor · corretor */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9C9686", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {subtituloUnidade ? <span>{subtituloUnidade}</span> : null}
              {subtituloUnidade && subtituloValor ? <span style={{ color: "#3D3A30" }}>·</span> : null}
              {subtituloValor ? <span style={{ color: "#4ADE80", fontWeight: 600 }}>{subtituloValor}</span> : null}
              {(subtituloUnidade || subtituloValor) && broker?.name ? <span style={{ color: "#3D3A30" }}>·</span> : null}
              {broker?.name ? <span>{broker.name}</span> : null}
            </div>
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
                    <div onClick={async () => { if (!supabase || !id || actionSaving) return; setActionSaving(true); try { await supabase.from("negotiations").update({ broker_id: null }).eq("id", id); setShowBrokerSelect(false); replaceNegotiation({ ...negotiation, brokerId: null }); } catch (e) { console.error("[Ficha] trocar corretor:", e); } finally { setActionSaving(false); } }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#5C5647", fontStyle: "italic", borderBottom: "1px solid rgba(61,58,48,0.1)" }}>— Nenhum</div>
                    {brokersList.map((b) => (
                      <div key={b.id} onClick={async () => { if (!supabase || !id || actionSaving) return; setActionSaving(true); try { await supabase.from("negotiations").update({ broker_id: b.id }).eq("id", id); setShowBrokerSelect(false); replaceNegotiation({ ...negotiation, brokerId: b.id }); } catch (e) { console.error("[Ficha] trocar corretor:", e); } finally { setActionSaving(false); } }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#C4BFB3", borderBottom: "1px solid rgba(61,58,48,0.06)" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,222,128,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>{b.name}{broker?.id === b.id ? <span style={{ fontSize: 10, color: "#4ADE80", marginLeft: 8 }}>atual</span> : null}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sprint B.1 — Banner "Próximo passo" acima das tabs (sempre visível) */}
      {!hasProposals && negotiation.status !== NegotiationStatus.CANCELLED && negotiation.status !== NegotiationStatus.LOST && negotiation.status !== NegotiationStatus.WON ? (
        <div style={{ marginBottom: 12, padding: "12px 16px", background: "linear-gradient(145deg, rgba(74,222,128,0.08), rgba(74,222,128,0.02))", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#4ADE80", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Próximo passo</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>Criar a primeira proposta para esta negociação</div>
          </div>
          <button type="button" onClick={() => setActiveTab("proposta")} style={{ padding: "8px 14px", borderRadius: 8, background: "#4ADE80", color: "#12110F", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "0.05em" }}>IR PARA PROPOSTA</button>
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

      {/* Sprint B.1 — Tabs */}
      <nav style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {([
          { id: "resumo" as ActiveTab, label: "Resumo", count: undefined as number | undefined },
          { id: "partes" as ActiveTab, label: "Partes", count: parties.length },
          { id: "documentos" as ActiveTab, label: "Documentos", count: undefined },
          { id: "proposta" as ActiveTab, label: "Proposta", count: proposals.length },
          { id: "reserva" as ActiveTab, label: "Reserva", count: reservations.length + sales.length },
          { id: "historico" as ActiveTab, label: "Histórico", count: events.length },
        ]).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                borderBottom: isActive ? "2px solid #4ADE80" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "#4ADE80" : "#9C9686",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 150ms ease",
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 ? (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isActive ? "#4ADE80" : "#5C5647",
                  background: isActive ? "rgba(74,222,128,0.12)" : "rgba(61,58,48,0.3)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  minWidth: 16,
                  textAlign: "center",
                }}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Tab: Resumo (Stepper + Summary card) */}
      {activeTab === "resumo" && (
      <>
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
      </>
      )}

      {/* Tab: Partes (Sprint B.2 — cards lado a lado) */}
      {activeTab === "partes" && (() => {
        const primaryParty = parties.find((p) => p.party.role === "primary_buyer") ?? null;
        const spouseLinkedParty = parties.find((p) => p.party.role === "spouse") ?? null;
        const spousePending =
          client?.id && spouseClient && !spouseLinkedParty && spouseClient.id !== client.id
            ? spouseClient
            : null;
        const otherParties = parties.filter(
          (p) => p.party.role !== "primary_buyer" && p.party.role !== "spouse",
        );
        const showCoupleGrid = Boolean(spouseLinkedParty || spousePending);

        return (
        <div>
          {/* Sprint B.2.2 — header com botão "+ Adicionar parte" */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowAddPartyModal(true)}
              style={{
                background: "transparent",
                color: "var(--color-sprout)",
                border: "1px solid var(--color-sprout)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Adicionar parte
            </button>
          </div>

          {isLoadingParties ? (
            <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Carregando partes...</p>
          ) : !primaryParty && parties.length === 0 ? (
            <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>
              Comprador não identificado. Vincule um cliente à negociação.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : (showCoupleGrid ? "1fr 1fr" : "1fr"),
              gap: 16,
              alignItems: "start",
            }}>
              {primaryParty && (
                <PartyCard
                  party={primaryParty.party}
                  clientName={primaryParty.client.fullName || primaryParty.client.name || "—"}
                  clientCpf={primaryParty.client.cpf}
                  clientPhone={primaryParty.client.phone || null}
                  clientEmail={primaryParty.client.email || null}
                  variant="primary"
                  isMutating={isMutatingParty}
                  onRemove={null}
                  updateParty={updateParty}
                  onSaved={() => void refreshParties()}
                />
              )}
              {spouseLinkedParty && (
                <PartyCard
                  party={spouseLinkedParty.party}
                  clientName={spouseLinkedParty.client.fullName || spouseLinkedParty.client.name || "—"}
                  clientCpf={spouseLinkedParty.client.cpf}
                  clientPhone={spouseLinkedParty.client.phone || null}
                  clientEmail={spouseLinkedParty.client.email || null}
                  variant="spouse_linked"
                  isMutating={isMutatingParty}
                  onRemove={() => setPartyToRemove({
                    id: spouseLinkedParty.party.id,
                    name: spouseLinkedParty.client.fullName || spouseLinkedParty.client.name || "—",
                  })}
                  updateParty={updateParty}
                  onSaved={() => void refreshParties()}
                />
              )}
              {spousePending && !spouseLinkedParty && (
                <SpousePendingCard
                  spouseClient={spousePending}
                  isMutating={isMutatingParty}
                  onAdd={() => void handleAddSpouseToNegotiation()}
                />
              )}
            </div>
          )}

          {/* Outras partes (coobrigado, fiador, procurador) — listadas abaixo */}
          {otherParties.length > 0 && (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {otherParties.map(({ party, client }) => (
                <PartyCard
                  key={party.id}
                  party={party}
                  clientName={client.fullName || client.name || "—"}
                  clientCpf={client.cpf}
                  clientPhone={client.phone || null}
                  clientEmail={client.email || null}
                  variant="other"
                  isMutating={isMutatingParty}
                  onRemove={() => setPartyToRemove({
                    id: party.id,
                    name: client.fullName || client.name || "—",
                  })}
                  updateParty={updateParty}
                  onSaved={() => void refreshParties()}
                />
              ))}
            </div>
          )}

          {/* Sprint B.2.2 — card vazio dashed que convida a adicionar */}
          {primaryParty && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowAddPartyModal(true)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setShowAddPartyModal(true); }}
              style={{
                marginTop: 16,
                background: "transparent",
                border: "1px dashed rgba(74,222,128,0.3)",
                borderRadius: 10,
                padding: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(74,222,128,0.04)";
                e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)";
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-sprout)",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}>
                + Adicionar parte
              </span>
            </div>
          )}

          {partiesErrorMessage ? (
            <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{partiesErrorMessage}</p>
          ) : null}
          {partyMutationError ? (
            <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{partyMutationError}</p>
          ) : null}
        </div>
        );
      })()}

      {/* Tab: Documentos (placeholder para Sprint B.3) */}
      {activeTab === "documentos" && (
      <div style={{ background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid var(--border-default)", borderRadius: 10, padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600 }}>Documentos da negociação</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>Esta seção vai centralizar a documentação necessária para esta venda — RG, CPF, comprovantes e certidões de cada parte.</div>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "#5C5647", padding: "6px 12px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 6, display: "inline-block" }}>Em breve · Sprint B.3</div>
      </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === "historico" && (
      <div>
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
      {/* Sprint B.1 — Fila operacional dentro de Histórico, quando aplicável */}
      {showQueue && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9C9686", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 12px" }}>Fila operacional</h3>
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
        </div>
      )}
      </div>
      )}

      {/* Tab: Proposta (Simulações + Propostas + Solicitação de reserva) */}
      {activeTab === "proposta" && (
      <div>
      {/* Engrenagem Comercial v1 — Simulações vinculadas à negociação */}
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9C9686", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 12px" }}>Simulações</h3>
      <div style={{ marginBottom: 24 }}>
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
      </div>

      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9C9686", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 12px" }}>Propostas</h3>
      <div style={{ marginBottom: 24 }}>
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
      </div>

      {showReservationRequest && (
      <>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9C9686", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 12px" }}>Solicitação de reserva</h3>
      <div style={{ marginBottom: 24 }}>
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
      </div>
      </>
      )}
      </div>
      )}

      {/* Tab: Reserva (Reserva ativa + Venda) */}
      {activeTab === "reserva" && (
      <div>
      {showReservation && (
      <>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9C9686", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 12px" }}>Reserva</h3>
      <div style={{ marginBottom: 24 }}>
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
      </div>
      </>
      )}

      {showSale && (
      <>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#9C9686", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 12px" }}>Venda</h3>
      <div style={{ marginBottom: 24 }}>
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
                {sale.status === SaleStatus.AWAITING_DOCUMENTS && documentsGate ? (
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: documentsGate.complete ? "rgba(74,222,128,0.08)" : "rgba(217,119,6,0.08)", border: `1px solid ${documentsGate.complete ? "rgba(74,222,128,0.25)" : "rgba(217,119,6,0.25)"}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: documentsGate.complete ? "var(--color-sprout)" : "#D97706" }}>Documentos: {documentsGate.requiredApproved}/{documentsGate.requiredTotal} obrigatórios aprovados</div>
                    {!documentsGate.complete && documentsGate.pendingLabels.length > 0 ? (
                      <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Pendentes: {documentsGate.pendingLabels.join(", ")}</div>
                    ) : null}
                    {negotiation?.clientId ? (
                      <button type="button" onClick={() => navigate(`/contatos/${negotiation.clientId}?tab=documentos`)} style={{ marginTop: 6, background: "none", border: "none", color: "var(--color-sprout)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Abrir documentos do comprador</button>
                    ) : null}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {canAdvanceSaleByRole ? (
                    <>
                      <button type="button" disabled={isTransitioningSale || !SaleService.podeAvancarParaDocumentos(sale)} onClick={() => void handleSaleTransition(sale.id, "documents")} style={btnSecondary}>Documentação</button>
                      {(() => {
                        const atDocs = sale.status === SaleStatus.AWAITING_DOCUMENTS;
                        const blocked = Boolean(atDocs && documentsGate && !documentsGate.complete);
                        const role = actorRole as string | null;
                        const canOverrideDocs = role === "director" || role === "owner";
                        const baseDisabled = isTransitioningSale || !SaleService.podeAvancarParaContrato(sale);
                        const missing = documentsGate ? documentsGate.requiredTotal - documentsGate.requiredApproved : 0;
                        if (blocked && canOverrideDocs) {
                          return <button type="button" disabled={baseDisabled} title={`${missing} documento(s) obrigatório(s) pendente(s)`} onClick={() => void handleSaleTransition(sale.id, "contract")} style={btnSecondary}>Avançar mesmo assim</button>;
                        }
                        return <button type="button" disabled={baseDisabled || blocked} title={blocked ? `Faltam ${missing} documento(s) obrigatório(s)` : undefined} onClick={() => void handleSaleTransition(sale.id, "contract")} style={btnSecondary}>Contrato</button>;
                      })()}
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
      </>
      )}
      </div>
      )}
      {negotiationErrorMessage ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{negotiationErrorMessage}</p> : null}


      {/* Engrenagem de Partes v1 — confirmação de remoção de parte (simples overlay) */}
      {partyToRemove ? (
        <div
          onClick={() => setPartyToRemove(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 14, padding: 24, width: 420, maxWidth: "95vw", zIndex: 9999, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
              Remover {partyToRemove.name} desta negociação?
            </div>
            <div style={{ fontSize: 12, color: "var(--text-disabled)", marginBottom: 20, lineHeight: 1.5 }}>
              A pessoa será desvinculada como parte desta negociação. O cadastro do cliente não é afetado — ele continua existindo.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPartyToRemove(null)}
                style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isMutatingParty}
                onClick={async () => {
                  const target = partyToRemove;
                  if (!target) return;
                  const ok = await removeParty(target.id);
                  if (ok) {
                    await refreshParties();
                    setPartyToRemove(null);
                  }
                }}
                style={{ background: "#F87171", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: isMutatingParty ? "not-allowed" : "pointer", opacity: isMutatingParty ? 0.55 : 1, WebkitAppearance: "none", appearance: "none" }}
              >
                {isMutatingParty ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sprint B.2.2 — modal para adicionar parte (coobrigado, procurador, beneficiário) */}
      {accountId ? (
        <AddPartyModal
          open={showAddPartyModal}
          negotiationId={negotiation.id}
          accountId={accountId}
          alreadyLinkedClientIds={alreadyLinkedClientIds}
          performedBy={authenticatedProfile?.id ?? null}
          onClose={() => setShowAddPartyModal(false)}
          onAdded={() => void refreshParties()}
        />
      ) : null}

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

// Etapa 1.4 — estado do ProposalForm consolidado em useReducer.
// Evita cascata de setStates no hydrate de prefillData (set-state-in-effect).
type ProposalFormState = {
  title: string;
  amount: string;
  entradaPct: boolean;
  entradaVal: string;
  numParcelas: string;
  hasBalao: boolean;
  balaoQtd: string;
  balaoVal: string;
  balaoEditadoManualmente: boolean;
  hasPermuta: boolean;
  permutaVal: string;
  permutaDesc: string;
  obs: string;
  prefillSimulationId: string | null;
  showForm: boolean;
};

type ProposalFormAction =
  | { type: "HYDRATE_FROM_PREFILL"; payload: ProposalPrefillData }
  | { type: "SET_FIELD"; field: keyof ProposalFormState; value: ProposalFormState[keyof ProposalFormState] }
  | { type: "OPEN_FORM" }
  | { type: "CLOSE_FORM" }
  | { type: "RESET"; defaultAmount: string };

function proposalFormReducer(state: ProposalFormState, action: ProposalFormAction): ProposalFormState {
  switch (action.type) {
    case "HYDRATE_FROM_PREFILL": {
      const v = action.payload.values;
      return {
        ...state,
        title: v.title ?? state.title,
        amount: v.amount !== undefined ? String(Math.round(v.amount)) : state.amount,
        entradaPct: v.entradaTipo !== undefined ? v.entradaTipo === "percentual" : state.entradaPct,
        entradaVal:
          v.entradaTipo === "valor" && v.entradaValor !== undefined
            ? String(Math.round(v.entradaValor))
            : v.entradaPercentual !== undefined
            ? String(Math.round(v.entradaPercentual * 100) / 100)
            : state.entradaVal,
        numParcelas: v.parcelasQuantidade !== undefined ? String(v.parcelasQuantidade) : state.numParcelas,
        hasBalao: Boolean(v.balaoQuantidade && v.balaoValor) || state.hasBalao,
        balaoQtd: v.balaoQuantidade ? String(v.balaoQuantidade) : state.balaoQtd,
        balaoVal: v.balaoValor ? String(Math.round(v.balaoValor)) : state.balaoVal,
        hasPermuta: Boolean(v.permutaValor && v.permutaValor > 0) || state.hasPermuta,
        permutaVal: v.permutaValor && v.permutaValor > 0 ? String(Math.round(v.permutaValor)) : state.permutaVal,
        permutaDesc: v.permutaDescricao ?? state.permutaDesc,
        obs: v.observacoes ?? state.obs,
        prefillSimulationId: action.payload.simulationId,
        showForm: true,
      };
    }
    case "SET_FIELD":
      return { ...state, [action.field]: action.value } as ProposalFormState;
    case "OPEN_FORM":
      return { ...state, showForm: true };
    case "CLOSE_FORM":
      return { ...state, showForm: false, prefillSimulationId: null };
    case "RESET":
      return {
        ...INITIAL_PROPOSAL_FORM_STATE,
        amount: action.defaultAmount,
      };
    default:
      return state;
  }
}

const INITIAL_PROPOSAL_FORM_STATE: ProposalFormState = {
  title: "",
  amount: "",
  entradaPct: true,
  entradaVal: "15",
  numParcelas: "36",
  hasBalao: false,
  balaoQtd: "6",
  balaoVal: "",
  balaoEditadoManualmente: false,
  hasPermuta: false,
  permutaVal: "",
  permutaDesc: "",
  obs: "",
  prefillSimulationId: null,
  showForm: false,
};

function calcularValorBalaoSugerido(amountStr: string, qtyStr: string): string {
  const amt = Number(amountStr) || 0;
  const qty = Number(qtyStr) || 6;
  if (amt <= 0) return "";
  const suggestedVal = Math.round((amt * 0.05) / qty);
  return suggestedVal > 0 ? suggestedVal.toString() : "";
}

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
  const [state, dispatch] = useReducer(proposalFormReducer, INITIAL_PROPOSAL_FORM_STATE, (s) => ({
    ...s,
    amount: props.defaultAmount.toString(),
  }));
  const {
    title, amount, entradaPct, entradaVal, numParcelas,
    hasBalao, balaoQtd, balaoVal,
    hasPermuta, permutaVal, permutaDesc, obs, prefillSimulationId, showForm,
  } = state;
  const [showSuccess, setShowSuccess] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  const setField = useCallback(<K extends keyof ProposalFormState>(field: K, value: ProposalFormState[K]) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  // Engrenagem v1 — quando chega prefillData (via card "Criar proposta a partir
  // desta" ou via ?createProposalFrom= na URL), hidratamos via reducer single dispatch.
  useEffect(() => {
    if (!props.prefillData) return;
    dispatch({ type: "HYDRATE_FROM_PREFILL", payload: props.prefillData });
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

  // Recalcular balão só quando amount muda E usuário NÃO editou manualmente.
  const handleAmountChange = useCallback((newAmount: string) => {
    dispatch({ type: "SET_FIELD", field: "amount", value: newAmount });
    if (state.hasBalao && !state.balaoEditadoManualmente) {
      const suggested = calcularValorBalaoSugerido(newAmount, state.balaoQtd);
      dispatch({ type: "SET_FIELD", field: "balaoVal", value: suggested });
    }
  }, [state.hasBalao, state.balaoEditadoManualmente, state.balaoQtd]);

  const handleToggleBalao = useCallback(() => {
    const novoEstado = !state.hasBalao;
    dispatch({ type: "SET_FIELD", field: "hasBalao", value: novoEstado });
    if (novoEstado && !state.balaoVal) {
      dispatch({ type: "SET_FIELD", field: "balaoQtd", value: "6" });
      const suggested = calcularValorBalaoSugerido(state.amount, "6");
      dispatch({ type: "SET_FIELD", field: "balaoVal", value: suggested });
      dispatch({ type: "SET_FIELD", field: "balaoEditadoManualmente", value: false });
    }
    if (!novoEstado) {
      // Ao desligar, reseta flag de edição manual para próxima ativação.
      dispatch({ type: "SET_FIELD", field: "balaoEditadoManualmente", value: false });
    }
  }, [state.hasBalao, state.balaoVal, state.amount]);

  const handleBalaoValChange = useCallback((v: string) => {
    dispatch({ type: "SET_FIELD", field: "balaoVal", value: v });
    dispatch({ type: "SET_FIELD", field: "balaoEditadoManualmente", value: true });
  }, []);

  function fmt(v: number) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  const isValid = title.trim().length > 0 && amt > 0;
  const missingFields: string[] = [];
  if (!title.trim()) missingFields.push("título");
  if (amt <= 0) missingFields.push("valor total");

  if (!showForm) {
    return (
      <button type="button" disabled={!props.canCreate} onClick={() => {
        if (!title) {
          const prefix = props.tipo === "contraproposta" ? "Contraproposta" : "Proposta";
          dispatch({ type: "SET_FIELD", field: "title", value: props.unitLabel ? `${prefix} - ${props.unitLabel}` : "" });
        }
        dispatch({ type: "OPEN_FORM" });
      }}
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
      dispatch({ type: "RESET", defaultAmount: props.defaultAmount.toString() });
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
        <FormLabel label="Título *"><input type="text" value={title} onChange={(e) => setField("title", e.target.value)} placeholder="Proposta comercial" /></FormLabel>
        <div>
          <FormLabel label="Valor total (R$) *"><input ref={amountRef} type="number" value={amount} onChange={(e) => handleAmountChange(e.target.value)} min="0" step="1000" /></FormLabel>
          {amt > 0 ? <div style={{ fontSize: 11, color: "var(--color-sprout)", marginTop: 4, fontWeight: 600 }}>R$ {fmt(amt)}</div> : null}
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="nexa-label">Entrada</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["R$", "%"] as const).map((m) => {
                const active = m === "%" ? entradaPct : !entradaPct;
                return (<button key={m} type="button" onClick={() => setField("entradaPct", m === "%")} style={{ background: active ? "var(--color-sprout-muted)" : "transparent", color: active ? "var(--color-sprout)" : "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{m}</button>);
              })}
            </div>
          </div>
          <input type="number" value={entradaVal} onChange={(e) => setField("entradaVal", e.target.value)} min="0" placeholder={entradaPct ? "15" : "36000"} />
          {amt > 0 ? <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>= R$ {fmt(entradaReais)}</div> : null}
        </div>
        <div>
          <FormLabel label="Parcelas">
            <select value={["12", "24", "36", "48", "60"].includes(numParcelas) ? numParcelas : "0"} onChange={(e) => setField("numParcelas", e.target.value)}>
              {[12, 24, 36, 48, 60].map((n) => <option key={n} value={n}>{n}x</option>)}
              <option value="0">Personalizado</option>
            </select>
          </FormLabel>
          {!["12", "24", "36", "48", "60"].includes(numParcelas) ? <input type="number" value={numParcelas === "0" ? "" : numParcelas} onChange={(e) => setField("numParcelas", e.target.value)} min="1" placeholder="Nº parcelas" style={{ marginTop: 6 }} autoFocus /> : null}
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
            <FormLabel label="Qtd. balões"><input type="number" value={balaoQtd} onChange={(e) => setField("balaoQtd", e.target.value)} min="1" /></FormLabel>
          </div>
          <div>
            <FormLabel label="Valor de cada balão (R$)"><input type="number" value={balaoVal} onChange={(e) => handleBalaoValChange(e.target.value)} min="0" step="1000" /></FormLabel>
            {Number(balaoQtd) > 0 && Number(balaoVal) > 0 ? (
              <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Total balões: R$ {fmt(Number(balaoQtd) * Number(balaoVal))}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Permuta */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => setField("hasPermuta", !hasPermuta)} style={{ width: 36, height: 20, borderRadius: 10, background: hasPermuta ? "var(--color-sprout)" : "var(--color-stone)", border: "none", position: "relative", flexShrink: 0 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: hasPermuta ? 19 : 3, transition: "left 150ms" }} />
        </button>
        <span style={{ fontSize: 13, color: "var(--color-dust)" }}>Permuta</span>
      </div>
      {hasPermuta ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8, maxWidth: 600 }}>
          <FormLabel label="Valor da permuta (R$)"><input type="number" value={permutaVal} onChange={(e) => setField("permutaVal", e.target.value)} min="0" /></FormLabel>
          <FormLabel label="Descrição da permuta"><input type="text" value={permutaDesc} onChange={(e) => setField("permutaDesc", e.target.value)} placeholder="Ex: Veículo, terreno..." /></FormLabel>
        </div>
      ) : null}

      {/* Observações */}
      <div style={{ marginTop: 12, maxWidth: 600 }}>
        <label>
          <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Observações</span>
          <textarea value={obs} onChange={(e) => setField("obs", e.target.value)} rows={2} placeholder="Condições especiais, prazos..." />
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
        <button type="button" onClick={() => { dispatch({ type: "CLOSE_FORM" }); props.onPrefillConsumed?.(); }}
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

// Sprint B.2 — helpers para a aba Partes (cards do casal + spouse pendente).
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#5C5647",
        marginBottom: 2,
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#E8E5DE", wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

// Sprint B.2.1 — modo edição inline para regime/capacidade/notes.
const SELECT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--color-ink)",
  border: "1px solid var(--color-stone)",
  color: "#E8E5DE",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
};
const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--color-ink)",
  border: "1px solid var(--color-stone)",
  color: "#E8E5DE",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const EDIT_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#5C5647",
  marginBottom: 4,
  fontWeight: 600,
};

function PartyCard({
  party,
  clientName,
  clientCpf,
  clientPhone,
  clientEmail,
  variant,
  isMutating,
  onRemove,
  updateParty,
  onSaved,
}: {
  party: NegotiationParty;
  clientName: string;
  clientCpf: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  variant: "primary" | "spouse_linked" | "other";
  isMutating: boolean;
  onRemove: (() => void) | null;
  updateParty?: (partyId: string, input: UpdatePartyInput) => Promise<NegotiationParty | null>;
  onSaved?: () => void;
}) {
  const pillStyle =
    variant === "primary" || variant === "spouse_linked"
      ? { color: "var(--color-sprout)", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }
      : { color: "#9C9686", background: "rgba(156,150,134,0.12)", border: "1px solid rgba(156,150,134,0.2)" };

  const pillLabel = PARTY_ROLE_LABELS[party.role] || party.role;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editRegime, setEditRegime] = useState<LegalRegime | null>(party.legalRegime);
  const [editCapacity, setEditCapacity] = useState<SigningCapacity | null>(party.signingCapacity);
  const [editNotes, setEditNotes] = useState<string>(party.notes ?? "");

  // Reset form quando entra em modo edição (pega valores frescos do server)
  useEffect(() => {
    if (isEditing) {
      setEditRegime(party.legalRegime);
      setEditCapacity(party.signingCapacity);
      setEditNotes(party.notes ?? "");
      setEditError(null);
    }
  }, [isEditing, party.legalRegime, party.signingCapacity, party.notes]);

  // Limpar feedback "justSaved" após 1s
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1000);
    return () => clearTimeout(t);
  }, [justSaved]);

  async function handleSave() {
    if (!updateParty) {
      setEditError("Função de atualização indisponível.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const result = await updateParty(party.id, {
        legalRegime: editRegime,
        signingCapacity: editCapacity,
        notes: editNotes.trim() || null,
      });
      if (result) {
        setIsEditing(false);
        setJustSaved(true);
        onSaved?.();
      } else {
        setEditError("Falha ao salvar. Tente novamente.");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "linear-gradient(168deg, rgba(34,33,28,0.5), rgba(18,17,14,0.15))",
      border: justSaved ? "1px solid #4ADE80" : "1px solid rgba(61,58,48,0.2)",
      transition: "border-color 300ms ease",
      borderRadius: 10,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 600,
          padding: "4px 8px",
          borderRadius: 4,
          ...pillStyle,
        }}>
          {pillLabel}
        </span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: "#FAF9F6", lineHeight: 1.2 }}>
        {clientName}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="CPF" value={clientCpf ? formatCPF(clientCpf) : "—"} />
        <Field label="Telefone" value={clientPhone ? formatPhone(clientPhone) : "—"} />
        <Field label="Email" value={clientEmail || "—"} />
      </div>

      {/* Regime + Capacidade + Notes — leitura ou edição */}
      <div style={{ paddingTop: 12, borderTop: "1px solid rgba(61,58,48,0.2)" }}>
        {!isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Field
              label="Regime de bens"
              value={party.legalRegime ? LEGAL_REGIME_LABELS[party.legalRegime] : "—"}
            />
            <Field
              label="Capacidade de assinatura"
              value={party.signingCapacity ? SIGNING_CAPACITY_LABELS[party.signingCapacity] : "—"}
            />
            {party.notes ? (
              <Field label="Observações" value={party.notes} />
            ) : null}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={EDIT_LABEL_STYLE}>Regime de bens</label>
              <select
                value={editRegime ?? ""}
                onChange={(e) => setEditRegime((e.target.value || null) as LegalRegime | null)}
                disabled={saving}
                style={SELECT_STYLE}
              >
                <option value="">— Não definido</option>
                <option value="comunhao_parcial">Comunhão parcial de bens</option>
                <option value="comunhao_universal">Comunhão universal de bens</option>
                <option value="separacao_total">Separação total de bens</option>
                <option value="participacao_final_aquestos">Participação final nos aquestos</option>
              </select>
            </div>
            <div>
              <label style={EDIT_LABEL_STYLE}>Capacidade de assinatura</label>
              <select
                value={editCapacity ?? ""}
                onChange={(e) => setEditCapacity((e.target.value || null) as SigningCapacity | null)}
                disabled={saving}
                style={SELECT_STYLE}
              >
                <option value="">— Não definido</option>
                <option value="signs_alone">Assina sozinho</option>
                <option value="signs_jointly">Assina em conjunto</option>
                <option value="no_sign">Não assina</option>
              </select>
            </div>
            <div>
              <label style={EDIT_LABEL_STYLE}>Observações</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Ex: cônjuge prefere assinatura digital..."
                disabled={saving}
                style={TEXTAREA_STYLE}
              />
            </div>
            {editError ? (
              <div style={{
                fontSize: 12,
                color: "#F87171",
                padding: "6px 10px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 6,
              }}>
                {editError}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer: ações */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        {!isEditing ? (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isMutating}
              style={{
                background: "transparent",
                color: "#9C9686",
                border: "1px solid var(--color-stone)",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: isMutating ? "not-allowed" : "pointer",
                opacity: isMutating ? 0.55 : 1,
              }}
            >
              Editar
            </button>
            {/* Defense in depth: primary nunca tem Remover, mesmo se onRemove vier não-null. */}
            {onRemove && variant !== "primary" ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={isMutating}
                style={{
                  background: "transparent",
                  color: "#9C9686",
                  border: "1px solid var(--color-stone)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: isMutating ? "not-allowed" : "pointer",
                  opacity: isMutating ? 0.55 : 1,
                }}
              >
                Remover
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={saving}
              style={{
                background: "transparent",
                color: "#9C9686",
                border: "1px solid var(--color-stone)",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.55 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                background: "var(--color-sprout)",
                color: "var(--color-ink)",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.55 : 1,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SpousePendingCard({
  spouseClient,
  isMutating,
  onAdd,
}: {
  spouseClient: {
    id: string;
    name: string;
    fullName: string | null;
    cpf: string | null;
    phone: string | null;
    email: string | null;
  };
  isMutating: boolean;
  onAdd: () => void;
}) {
  const displayName = spouseClient.fullName || spouseClient.name || "—";

  return (
    <div style={{
      background: "linear-gradient(168deg, rgba(251,191,36,0.06), rgba(18,17,14,0.15))",
      border: "1px solid rgba(251,191,36,0.25)",
      borderRadius: 10,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "#FBBF24",
          background: "rgba(251,191,36,0.12)",
          border: "1px solid rgba(251,191,36,0.2)",
          padding: "4px 8px",
          borderRadius: 4,
        }}>
          Cônjuge · Pendente de vínculo
        </span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: "#FAF9F6", lineHeight: 1.2 }}>
        {displayName}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="CPF" value={spouseClient.cpf ? formatCPF(spouseClient.cpf) : "—"} />
        <Field label="Telefone" value={spouseClient.phone ? formatPhone(spouseClient.phone) : "—"} />
        <Field label="Email" value={spouseClient.email || "—"} />
      </div>

      <div style={{
        fontSize: 12,
        color: "#9C9686",
        background: "rgba(251,191,36,0.04)",
        border: "1px solid rgba(251,191,36,0.15)",
        borderRadius: 6,
        padding: "8px 12px",
        lineHeight: 1.5,
      }}>
        Cônjuge cadastrado mas ainda não vinculado a esta negociação. Adicione para incluir na documentação da venda.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
        <button
          type="button"
          onClick={onAdd}
          disabled={isMutating}
          style={{
            background: "var(--color-sprout)",
            color: "var(--color-ink)",
            border: "none",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: isMutating ? "not-allowed" : "pointer",
            opacity: isMutating ? 0.55 : 1,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {isMutating ? "Adicionando..." : "Adicionar à negociação"}
        </button>
      </div>
    </div>
  );
}

// Sprint B.2.2 — modal completo para adicionar parte adicional
// (coobrigado, procurador, beneficiário final). 3 estados sequenciais:
// search → (opcional create_new) → define_role → addParty no banco.

type ModalStep = "search" | "create_new" | "define_role";

type ClientSearchResult = {
  id: string;
  name: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
};

const MODAL_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--color-ink)",
  border: "1px solid var(--color-stone)",
  color: "#E8E5DE",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
const MODAL_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#5C5647",
  marginBottom: 4,
  fontWeight: 600,
};
const MODAL_BTN_PRIMARY: React.CSSProperties = {
  background: "var(--color-sprout)",
  color: "var(--color-ink)",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const MODAL_BTN_SECONDARY: React.CSSProperties = {
  background: "transparent",
  color: "#9C9686",
  border: "1px solid var(--color-stone)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

function AddPartyModal({
  open,
  negotiationId,
  accountId,
  alreadyLinkedClientIds,
  performedBy,
  onClose,
  onAdded,
}: {
  open: boolean;
  negotiationId: string;
  accountId: string;
  alreadyLinkedClientIds: string[];
  performedBy: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [step, setStep] = useState<ModalStep>("search");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", cpf: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);

  const [role, setRole] = useState<"co_obligor" | "attorney_in_fact" | "beneficial_owner">("co_obligor");
  const [signingCapacity, setSigningCapacity] = useState<SigningCapacity | null>(null);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStep("search");
      setSearchQuery("");
      setSearchResults([]);
      setNewClient({ name: "", email: "", phone: "", cpf: "" });
      setSelectedClient(null);
      setRole("co_obligor");
      setSigningCapacity(null);
      setNotes("");
      setCreateError(null);
      setAddError(null);
    }
  }, [open]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Busca com debounce 300ms (cancelable)
  useEffect(() => {
    if (!open || step !== "search" || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        if (!supabase) return;
        const queryDigits = searchQuery.replace(/\D/g, "");
        const looksLikeCpf = queryDigits.length >= 3 && queryDigits.length === searchQuery.replace(/[\s.-]/g, "").length;

        let qb = supabase
          .from("clients")
          .select("id, name, full_name, cpf, phone, email")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .order("name")
          .limit(10);

        if (looksLikeCpf) {
          qb = qb.ilike("cpf", `%${queryDigits}%`);
        } else {
          qb = qb.or(`name.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);
        }

        if (alreadyLinkedClientIds.length > 0) {
          const idList = alreadyLinkedClientIds.map((id) => `"${id}"`).join(",");
          qb = qb.not("id", "in", `(${idList})`);
        }

        const { data, error } = await qb;
        if (cancelled) return;
        if (error) {
          console.error("[AddPartyModal] search error:", error);
          setSearchResults([]);
        } else {
          setSearchResults((data ?? []) as ClientSearchResult[]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, searchQuery, step, accountId, alreadyLinkedClientIds]);

  function handleSelectClient(c: ClientSearchResult) {
    setSelectedClient(c);
    setStep("define_role");
  }

  async function handleCreateNew() {
    if (!newClient.name.trim() || !newClient.email.trim() || !newClient.phone.trim()) {
      setCreateError("Nome, email e telefone são obrigatórios.");
      return;
    }
    const cpfDigits = newClient.cpf.replace(/\D/g, "");
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      setCreateError("CPF inválido. Deixe em branco ou preencha 11 dígitos.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createClient({
        accountId,
        name: newClient.name.trim(),
        email: newClient.email.trim(),
        phone: newClient.phone.trim(),
        cpf: cpfDigits || undefined,
        createdBy: performedBy ?? undefined,
      });
      setSelectedClient({
        id: created.id,
        name: created.name,
        full_name: created.fullName ?? null,
        cpf: created.cpf ?? null,
        phone: created.phone || null,
        email: created.email || null,
      });
      setStep("define_role");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Falha ao cadastrar.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddParty() {
    if (!selectedClient || !performedBy) {
      setAddError("Sessão sem perfil autenticado. Entre novamente.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await addPartyRepo(
        {
          negotiationId,
          clientId: selectedClient.id,
          role,
          legalRegime: null,
          signingCapacity,
          notes: notes.trim() || null,
        },
        accountId,
        performedBy,
      );
      onAdded();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao adicionar.";
      if (msg.includes("uniq_party_per_role") || msg.toLowerCase().includes("duplicate")) {
        setAddError("Esta pessoa já está vinculada nesta função.");
      } else {
        setAddError(msg);
      }
    } finally {
      setAdding(false);
    }
  }

  if (!open) return null;

  const headerTitle =
    step === "search"
      ? "Adicionar parte"
      : step === "create_new"
        ? "Cadastrar nova pessoa"
        : `Adicionar ${selectedClient?.full_name || selectedClient?.name || "parte"}`;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--color-stone)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>
            {headerTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-fog)",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {step === "search" && (
          <>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              autoFocus
              style={MODAL_INPUT_STYLE}
            />

            <div style={{ marginTop: 12, minHeight: 180 }}>
              {searching ? (
                <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Buscando...</p>
              ) : searchQuery && searchResults.length === 0 ? (
                <p style={{ color: "var(--color-fog)", fontSize: 13, margin: 0 }}>
                  Nenhuma pessoa encontrada com essa busca.
                </p>
              ) : !searchQuery ? (
                <p style={{ color: "var(--color-fog)", fontSize: 12, fontStyle: "italic", margin: 0 }}>
                  Digite ao menos 3 caracteres do nome ou CPF.
                </p>
              ) : (
                searchResults.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    style={{
                      padding: "10px 12px",
                      background: "var(--color-ink)",
                      border: "1px solid var(--color-stone)",
                      borderRadius: 6,
                      marginBottom: 6,
                      cursor: "pointer",
                      transition: "border-color 150ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-stone)"; }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>
                      {c.full_name || c.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      {c.cpf ? `CPF ${formatCPF(c.cpf)}` : "(sem CPF)"} · {c.email || "(sem email)"}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-stone)" }}>
              <button
                type="button"
                onClick={() => setStep("create_new")}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "var(--color-sprout)",
                  border: "1px dashed var(--color-sprout)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Cadastrar nova pessoa
              </button>
            </div>
          </>
        )}

        {step === "create_new" && (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              <FormField
                label="Nome *"
                value={newClient.name}
                onChange={(v) => setNewClient({ ...newClient, name: v })}
                placeholder="Nome completo"
              />
              <FormField
                label="Email *"
                value={newClient.email}
                onChange={(v) => setNewClient({ ...newClient, email: v })}
                placeholder="email@exemplo.com"
                type="email"
              />
              <FormField
                label="Telefone *"
                value={newClient.phone}
                onChange={(v) => setNewClient({ ...newClient, phone: v })}
                placeholder="(45) 99999-0000"
              />
              <FormField
                label="CPF (opcional)"
                value={newClient.cpf}
                onChange={(v) => setNewClient({ ...newClient, cpf: v })}
                placeholder="000.000.000-00"
              />
            </div>

            {createError ? (
              <div style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 6,
                fontSize: 12,
                color: "#F87171",
              }}>
                {createError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
              <button type="button" onClick={() => setStep("search")} disabled={creating} style={MODAL_BTN_SECONDARY}>
                ← Voltar
              </button>
              <button type="button" onClick={() => void handleCreateNew()} disabled={creating} style={{ ...MODAL_BTN_PRIMARY, opacity: creating ? 0.55 : 1, cursor: creating ? "not-allowed" : "pointer" }}>
                {creating ? "Cadastrando..." : "Cadastrar e continuar"}
              </button>
            </div>
          </>
        )}

        {step === "define_role" && selectedClient && (
          <>
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: "var(--color-ink)",
              border: "1px solid var(--color-stone)",
              borderRadius: 8,
            }}>
              <div style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-fog)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 4,
                fontWeight: 600,
              }}>
                Pessoa selecionada
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>
                {selectedClient.full_name || selectedClient.name}
              </div>
              {selectedClient.cpf ? (
                <div style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  CPF {formatCPF(selectedClient.cpf)}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={MODAL_LABEL_STYLE}>Função na negociação *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  style={MODAL_INPUT_STYLE}
                >
                  <option value="co_obligor">Coobrigado</option>
                  <option value="attorney_in_fact">Procurador</option>
                  <option value="beneficial_owner">Beneficiário final</option>
                </select>
              </div>
              <div>
                <label style={MODAL_LABEL_STYLE}>Capacidade de assinatura</label>
                <select
                  value={signingCapacity ?? ""}
                  onChange={(e) => setSigningCapacity((e.target.value || null) as SigningCapacity | null)}
                  style={MODAL_INPUT_STYLE}
                >
                  <option value="">— Não definido</option>
                  <option value="signs_alone">Assina sozinho</option>
                  <option value="signs_jointly">Assina em conjunto</option>
                  <option value="no_sign">Não assina</option>
                </select>
              </div>
              <div>
                <label style={MODAL_LABEL_STYLE}>Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: parente do comprador, autorizado pela diretoria..."
                  style={{ ...MODAL_INPUT_STYLE, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            </div>

            {addError ? (
              <div style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 6,
                fontSize: 12,
                color: "#F87171",
              }}>
                {addError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
              <button type="button" onClick={() => setStep("search")} disabled={adding} style={MODAL_BTN_SECONDARY}>
                ← Voltar
              </button>
              <button type="button" onClick={() => void handleAddParty()} disabled={adding} style={{ ...MODAL_BTN_PRIMARY, opacity: adding ? 0.55 : 1, cursor: adding ? "not-allowed" : "pointer" }}>
                {adding ? "Adicionando..." : "Adicionar à negociação"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={MODAL_LABEL_STYLE}>{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={MODAL_INPUT_STYLE}
      />
    </div>
  );
}
