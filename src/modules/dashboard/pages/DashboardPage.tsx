import { ProposalStatus } from "../../../domain/proposta/ProposalStatus";
import { SaleStatus } from "../../../domain/venda/SaleStatus";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
import UnitsPanel from "../../units/components/UnitsPanel";

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--color-carbon)",
        border: "1px solid var(--color-stone)",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <div className="nexa-label" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-bone)" }}>
        {value}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--color-dust)" }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-bone)",
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--color-stone)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--color-sprout)",
            opacity: 0.4,
            borderRadius: 3,
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid var(--color-stone)",
      }}
    >
      <span className="nexa-label">{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-bone)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const {
    accountContext,
    developmentContext,
    errorMessage,
    isLoading,
    metrics,
    status,
  } = useDashboardMetrics();

  if (isLoading) {
    return (
      <p style={{ color: "var(--color-fog)" }}>
        Carregando leitura gerencial da operação...
      </p>
    );
  }

  if (accountContext.status === "no_access" || accountContext.status === "error") {
    return (
      <p style={{ color: "var(--color-fog)" }}>
        {accountContext.errorMessage ?? "Conta ativa indisponível."}
      </p>
    );
  }

  if (developmentContext.status === "empty" || developmentContext.status === "error") {
    return (
      <p style={{ color: "var(--color-fog)" }}>
        {developmentContext.errorMessage ??
          "Empreendimento ativo indisponível para carregar dashboard."}
      </p>
    );
  }

  if (status === "error") {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)" }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--color-red)", marginTop: 8 }}>
          Falha ao carregar indicadores gerenciais.
        </p>
        <p style={{ color: "var(--color-fog)", fontSize: 12 }}>{errorMessage}</p>
      </div>
    );
  }

  if (status === "idle") {
    return (
      <p style={{ color: "var(--color-fog)" }}>
        Selecione uma conta e um empreendimento ativos para carregar a operação.
      </p>
    );
  }

  if (!metrics) {
    return (
      <p style={{ color: "var(--color-fog)" }}>
        Nenhum dado operacional encontrado para o contexto ativo.
      </p>
    );
  }

  const funnelMax = Math.max(
    metrics.funnel.negotiation,
    metrics.funnel.proposal,
    metrics.funnel.reservation,
    metrics.funnel.sale,
    1,
  );

  return (
    <div>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <KpiCard label="Negociações ativas" value={metrics.negotiationsActive} />
        <KpiCard label="Reservas ativas" value={metrics.activeReservations} />
        <KpiCard label="Vendas concluídas" value={metrics.completedSales} />
        <KpiCard
          label="VGV em negociação"
          value={`R$ ${metrics.vgv.emNegociacao.toLocaleString("pt-BR")}`}
        />
      </div>

      {/* VGV row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          marginTop: 12,
        }}
      >
        <KpiCard
          label="VGV reservado"
          value={`R$ ${metrics.vgv.reservado.toLocaleString("pt-BR")}`}
        />
        <KpiCard
          label="VGV vendido"
          value={`R$ ${metrics.vgv.vendido.toLocaleString("pt-BR")}`}
        />
      </div>

      {/* Funnel + Status sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 24,
        }}
      >
        {/* Funnel */}
        <div className="nexa-card">
          <div className="nexa-label" style={{ marginBottom: 16 }}>
            Funil operacional
          </div>
          <FunnelBar label="Negociação" value={metrics.funnel.negotiation} max={funnelMax} />
          <FunnelBar label="Proposta" value={metrics.funnel.proposal} max={funnelMax} />
          <FunnelBar label="Reserva" value={metrics.funnel.reservation} max={funnelMax} />
          <FunnelBar label="Venda" value={metrics.funnel.sale} max={funnelMax} />
        </div>

        {/* Alerts */}
        <div className="nexa-card">
          <div className="nexa-label" style={{ marginBottom: 16 }}>
            Alertas operacionais
          </div>
          <StatusRow label="Reservas expiradas" value={metrics.alerts.expiredReservations.length} />
          <StatusRow
            label="Próximas do vencimento"
            value={metrics.alerts.reservationsExpiringSoon.length}
          />
          <StatusRow label="Negociações paradas" value={metrics.alerts.staleNegotiations.length} />
        </div>
      </div>

      {/* Status breakdowns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div className="nexa-card">
          <div className="nexa-label" style={{ marginBottom: 12 }}>
            Propostas por status
          </div>
          <StatusRow label="Rascunho" value={metrics.proposalsByStatus[ProposalStatus.DRAFT]} />
          <StatusRow label="Enviada" value={metrics.proposalsByStatus[ProposalStatus.SENT]} />
          <StatusRow label="Em analise" value={metrics.proposalsByStatus[ProposalStatus.UNDER_ANALYSIS]} />
          <StatusRow label="Aceita" value={metrics.proposalsByStatus[ProposalStatus.ACCEPTED]} />
          <StatusRow label="Recusada" value={metrics.proposalsByStatus[ProposalStatus.REJECTED]} />
          <StatusRow label="Expirada" value={metrics.proposalsByStatus[ProposalStatus.EXPIRED]} />
        </div>

        <div className="nexa-card">
          <div className="nexa-label" style={{ marginBottom: 12 }}>
            Vendas por status
          </div>
          <StatusRow label="Criada" value={metrics.salesByStatus[SaleStatus.CREATED]} />
          <StatusRow label="Aguardando docs" value={metrics.salesByStatus[SaleStatus.AWAITING_DOCUMENTS]} />
          <StatusRow label="Aguardando contrato" value={metrics.salesByStatus[SaleStatus.AWAITING_CONTRACT]} />
          <StatusRow label="Aguardando pagamento" value={metrics.salesByStatus[SaleStatus.AWAITING_PAYMENT]} />
          <StatusRow label="Concluída" value={metrics.salesByStatus[SaleStatus.COMPLETED]} />
          <StatusRow label="Cancelada" value={metrics.salesByStatus[SaleStatus.CANCELLED]} />
        </div>

        <div className="nexa-card">
          <div className="nexa-label" style={{ marginBottom: 12 }}>
            Unidades por status
          </div>
          <StatusRow label="Disponíveis" value={metrics.unitsByStatus[UnidadeStatus.DISPONIVEL]} />
          <StatusRow label="Em negociação" value={metrics.unitsByStatus[UnidadeStatus.EM_NEGOCIACAO]} />
          <StatusRow label="Reservadas" value={metrics.unitsByStatus[UnidadeStatus.RESERVADO]} />
          <StatusRow label="Vendidas" value={metrics.unitsByStatus[UnidadeStatus.VENDIDO]} />
        </div>
      </div>

      {/* Units Panel */}
      <div style={{ marginTop: 24 }}>
        <UnitsPanel />
      </div>
    </div>
  );
}
