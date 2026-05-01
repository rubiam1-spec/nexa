import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { UnidadeStatus, type UnidadeStatus as UnidadeStatusType } from "../../../domain/unidade/UnidadeStatus";
import { getUnidadeStatusLabel } from "../../../domain/unidade/UnidadeStatusLabel";
import NexaBadge from "../../../shared/components/NexaBadge";
import { useNegotiations } from "../../negociacoes/hooks/useNegotiations";
import { useUnitHistory } from "../hooks/useUnitHistory";
import { useUnits } from "../hooks/useUnits";
import { formatDateTimeBRT } from "../../../shared/utils/dateUtils";

export default function UnitsPanel() {
  const { account, isUsingMock: isUsingMockAccount, status: accountStatus, errorMessage: accountErrorMessage } = useAccount();
  const { development, isUsingMock: isUsingMockDevelopment, status: developmentStatus, errorMessage: developmentErrorMessage } = useDevelopment();
  const useMockFallback = isUsingMockAccount || isUsingMockDevelopment;
  const unitsState = useUnits(account?.accountId ?? null, development?.developmentId ?? null, useMockFallback);
  const { units, errorMessage, isLoading, status } = unitsState;
  const negotiationsState = useNegotiations(account?.accountId ?? null, development?.developmentId ?? null, useMockFallback, account?.role ?? null, unitsState);
  const { historyEvents, isLoading: isLoadingHistory, status: historyStatus, errorMessage: historyErrorMessage } = useUnitHistory(units.map((u) => u.id), useMockFallback);
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<UnidadeStatusType | null>(null);

  const filteredUnits = statusFilter ? units.filter((u) => u.status === statusFilter) : units;

  if (isLoading || negotiationsState.isLoading || isLoadingHistory) {
    return <p style={{ color: "var(--color-fog)" }}>Carregando unidades...</p>;
  }

  if (accountStatus === "no_access" || accountStatus === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{accountErrorMessage ?? "Conta indisponível."}</p>;
  }

  if (developmentStatus === "empty" || developmentStatus === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{developmentErrorMessage ?? "Empreendimento indisponível."}</p>;
  }

  if (status === "error" || negotiationsState.status === "error" || historyStatus === "error") {
    return <p style={{ color: "var(--color-red)" }}>{errorMessage ?? negotiationsState.errorMessage ?? historyErrorMessage}</p>;
  }

  if (status === "idle" || !units || units.length === 0) {
    return (
      <div className="nexa-card">
        <div className="nexa-label" style={{ marginBottom: 8 }}>Unidades</div>
        <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma unidade encontrada.</p>
      </div>
    );
  }

  function getUnitHistoryActionLabel(action: string) {
    switch (action) {
      case "NEGOTIATION_STARTED": return "Negociação iniciada";
      case "NEGOTIATION_CANCELLED": return "Negociação cancelada";
      case "QUEUE_PROMOTED": return "Fila promovida";
      case "RESERVATION_ACTIVATED": return "Reserva ativada";
      case "RESERVATION_CANCELLED": return "Reserva cancelada";
      case "RESERVATION_EXPIRED": return "Reserva expirada";
      case "SALE_CREATED": return "Venda criada";
      default: return action;
    }
  }

  const filterOptions: Array<{ label: string; value: UnidadeStatusType | null }> = [
    { label: `Todos (${units.length})`, value: null },
    { label: `Disponível (${units.filter((u) => u.status === UnidadeStatus.DISPONIVEL).length})`, value: UnidadeStatus.DISPONIVEL },
    { label: `Em negociação (${units.filter((u) => u.status === UnidadeStatus.EM_NEGOCIACAO).length})`, value: UnidadeStatus.EM_NEGOCIACAO },
    { label: `Reservado (${units.filter((u) => u.status === UnidadeStatus.RESERVADO).length})`, value: UnidadeStatus.RESERVADO },
    { label: `Vendido (${units.filter((u) => u.status === UnidadeStatus.VENDIDO).length})`, value: UnidadeStatus.VENDIDO },
  ];

  return (
    <section>
      <div className="nexa-label" style={{ marginBottom: 12 }}>Unidades do empreendimento</div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {filterOptions.map((opt) => (
          <button
            key={opt.value ?? "all"}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid var(--color-stone)",
              background: statusFilter === opt.value ? "var(--color-sprout-muted)" : "transparent",
              color: statusFilter === opt.value ? "var(--color-sprout)" : "var(--color-dust)",
              fontSize: 12,
              fontWeight: statusFilter === opt.value ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Units grid */}
      <div style={{ display: "grid", gap: 12 }}>
        {filteredUnits.map((unit) => {
          const neg = negotiationsState.negotiations.find((n) => n.unitId === unit.id) ?? null;
          const lastEvent = historyEvents.find((e) => e.unitId === unit.id) ?? null;

          return (
            <article key={unit.id} className="nexa-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-bone)" }}>
                  Quadra {unit.quadra} - Lote {unit.lote}
                </h3>
                <NexaBadge entity="unit" status={unit.status} label={getUnidadeStatusLabel(unit.status)} />
              </div>
              <div style={{ fontSize: 13, color: "var(--color-dust)", display: "grid", gap: 4 }}>
                <div>Valor: <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>R$ {unit.valor.toLocaleString("pt-BR")}</span></div>
                <div>
                  Negociação:{" "}
                  {neg ? (
                    <Link to={`/negociacoes/${neg.id}`}>Abrir detalhe</Link>
                  ) : (
                    <span style={{ color: "var(--color-fog)" }}>Nenhuma</span>
                  )}
                </div>
                {lastEvent ? (
                  <div style={{ fontSize: 11, color: "var(--color-fog)" }}>
                    Ultimo evento: {getUnitHistoryActionLabel(lastEvent.action)} — {getUnidadeStatusLabel(lastEvent.toStatus)} em {formatDateTimeBRT(lastEvent.createdAt)}
                  </div>
                ) : null}
              </div>
              {unit.status === UnidadeStatus.DISPONIVEL && !neg ? (
                <button
                  type="button"
                  onClick={() => void navigate(`/negociacoes?unitId=${unit.id}`)}
                  style={{
                    marginTop: 12,
                    background: "transparent",
                    color: "var(--color-sprout)",
                    border: "1px solid var(--color-sprout-muted)",
                    borderRadius: 6,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Iniciar negociação
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
