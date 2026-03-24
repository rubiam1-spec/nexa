import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import NexaBadge from "../../../shared/components/NexaBadge";
import { useNegotiationsOverview } from "../hooks/useNegotiationsOverview";

const btnPrimary: React.CSSProperties = {
  background: "var(--color-sprout)",
  color: "var(--color-ink)",
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-bone)",
  border: "1px solid var(--color-stone)",
  borderRadius: 8,
  padding: "0 16px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

export default function NegotiationsPage() {
  const [searchParams] = useSearchParams();
  const preselectedUnitId = searchParams.get("unitId");
  const { authenticatedProfile } = useAuth();
  const {
    accountContext: {
      account,
      errorMessage: accountErrorMessage,
      status: accountStatus,
    },
    developmentContext: {
      development,
      errorMessage: developmentErrorMessage,
      status: developmentStatus,
    },
    negotiationsState: {
      createNegotiation,
      errorMessage: negotiationErrorMessage,
      isLoading: isLoadingNegotiations,
      isUpdating,
      negotiations,
      status: negotiationStatus,
    },
    clientsState: { clients, isLoading: isLoadingClients },
    brokersState: { brokers, isLoading: isLoadingBrokers },
    unitsState: {
      errorMessage: unitsErrorMessage,
      isLoading: isLoadingUnits,
      status: unitsStatus,
      units,
    },
  } = useNegotiationsOverview();

  const [showForm, setShowForm] = useState(!!preselectedUnitId);
  const [selectedUnitId, setSelectedUnitId] = useState(preselectedUnitId ?? "");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);

  const isLoading =
    isLoadingNegotiations || isLoadingUnits || isLoadingClients || isLoadingBrokers;
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const brokersById = new Map(brokers.map((b) => [b.id, b]));
  const availableUnits = units.filter(
    (unit) => unit.status === UnidadeStatus.DISPONIVEL,
  );

  async function handleCreateNegotiation() {
    if (!account || !development || !selectedUnitId || !selectedClientId) return;
    const result = await createNegotiation({
      accountId: account.accountId,
      developmentId: development.developmentId,
      unitId: selectedUnitId,
      clientId: selectedClientId,
      brokerId: selectedBrokerId || null,
      performedBy: authenticatedProfile?.id ?? null,
    });
    if (result) {
      setShowForm(false);
      setSelectedUnitId("");
      setSelectedClientId("");
      setSelectedBrokerId("");
      setSuccessMsg("Negociação criada com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  if (isLoading) {
    return <p style={{ color: "var(--color-fog)" }}>Carregando negociações...</p>;
  }

  if (accountStatus === "no_access" || accountStatus === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{accountErrorMessage ?? "Conta indisponível."}</p>;
  }

  if (developmentStatus === "empty" || developmentStatus === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{developmentErrorMessage ?? "Empreendimento indisponível."}</p>;
  }

  if (negotiationStatus === "idle") {
    return <p style={{ color: "var(--color-fog)" }}>Selecione conta e empreendimento para continuar.</p>;
  }

  if (negotiationStatus === "error") {
    return <p style={{ color: "var(--color-red)" }}>{negotiationErrorMessage}</p>;
  }

  if (unitsStatus === "error") {
    return <p style={{ color: "var(--color-red)" }}>{unitsErrorMessage}</p>;
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>
            Negociações
          </h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>
            {negotiations.length} registros
          </div>
        </div>
        <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnSecondary : btnPrimary}>
          {showForm ? "Cancelar" : "Nova negociação"}
        </button>
      </div>

      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#10003;</span> {successMsg}
        </div>
      ) : null}

      {/* Form */}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Criar nova negociação</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Unidade *</span>
              <select ref={firstInputRef} value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                <option value="">{availableUnits.length === 0 ? "Nenhuma disponível" : "Selecione"}</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>Q{u.quadra} L{u.lote} — R$ {u.valor.toLocaleString("pt-BR")}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cliente *</span>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                <option value="">Selecione</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Corretor</span>
              <select value={selectedBrokerId} onChange={(e) => setSelectedBrokerId(e.target.value)}>
                <option value="">Opcional</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="button" disabled={!selectedUnitId || !selectedClientId || isUpdating} onClick={() => void handleCreateNegotiation()} style={btnPrimary}>
              {isUpdating ? "Criando..." : "Criar negociação"}
            </button>
          </div>
          {negotiationErrorMessage ? <p style={{ color: "var(--color-red)", marginTop: 8, fontSize: 12 }}>{negotiationErrorMessage}</p> : null}
        </div>
      ) : null}

      {/* Table */}
      {!negotiations || negotiations.length === 0 ? (
        <div className="nexa-card">
          <p style={{ color: "var(--color-fog)" }}>Nenhuma negociação encontrada.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="nexa-table">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Cliente</th>
                <th>Corretor</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {negotiations.map((negotiation) => {
                const unit = unitsById.get(negotiation.unitId);
                const cl = negotiation.clientId ? clientsById.get(negotiation.clientId) : null;
                const br = negotiation.brokerId ? brokersById.get(negotiation.brokerId) : null;
                return (
                  <tr key={negotiation.id}>
                    <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>
                      {unit ? `Q${unit.quadra} L${unit.lote}` : negotiation.unitId.slice(0, 8)}
                    </td>
                    <td>{cl?.name ?? "—"}</td>
                    <td>{br?.name ?? "—"}</td>
                    <td>{unit ? `R$ ${unit.valor.toLocaleString("pt-BR")}` : "—"}</td>
                    <td>
                      <NexaBadge entity="negotiation" status={negotiation.status} label={getNegotiationStatusLabel(negotiation.status)} />
                    </td>
                    <td>
                      <Link to={`/negociacoes/${negotiation.id}`} style={{ fontSize: 12, fontWeight: 600 }}>
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
