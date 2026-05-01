import type { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import type { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { SaleStatus } from "../../domain/venda/SaleStatus";
import type { UnidadeStatus } from "../../domain/unidade/UnidadeStatus";

type BadgeColor = { color: string; bg: string; border?: string };

const unitColors: Record<string, BadgeColor> = {
  DISPONIVEL: { color: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)" },
  EM_NEGOCIACAO: { color: "#60A5FA", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)" },
  RESERVADO: { color: "#D97706", bg: "rgba(217,119,6,0.1)", border: "rgba(217,119,6,0.2)" },
  VENDIDO: { color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
};

const negotiationColors: Record<string, BadgeColor> = {
  OPEN: { color: "var(--text-muted)", bg: "rgba(156,150,134,0.12)" },
  IN_PROGRESS: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  WON: { color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  LOST: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  CANCELLED: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
};

const proposalColors: Record<string, BadgeColor> = {
  DRAFT: { color: "var(--text-muted)", bg: "rgba(156,150,134,0.12)" },
  SENT: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  UNDER_ANALYSIS: { color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  ACCEPTED: { color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  REJECTED: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  EXPIRED: { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
};

const reservationColors: Record<string, BadgeColor> = {
  REQUESTED: { color: "var(--text-muted)", bg: "rgba(156,150,134,0.12)" },
  APPROVED: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  REJECTED: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  ACTIVE: { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  CANCELLED: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  EXPIRED: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
  CONVERTED: { color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
};

const saleColors: Record<string, BadgeColor> = {
  CREATED: { color: "var(--text-muted)", bg: "rgba(156,150,134,0.12)" },
  AWAITING_DOCUMENTS: { color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  AWAITING_CONTRACT: { color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  AWAITING_PAYMENT: { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  COMPLETED: { color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  CANCELLED: { color: "#F87171", bg: "rgba(248,113,113,0.12)" },
};

const fallback: BadgeColor = { color: "var(--text-muted)", bg: "rgba(156,150,134,0.12)" };

type BadgeProps = {
  label: string;
} & (
  | { entity: "unit"; status: UnidadeStatus }
  | { entity: "negotiation"; status: NegotiationStatus }
  | { entity: "proposal"; status: ProposalStatus }
  | { entity: "reservation"; status: ReservationStatus }
  | { entity: "sale"; status: SaleStatus }
);

function getColors(entity: string, status: string): BadgeColor {
  switch (entity) {
    case "unit":
      return unitColors[status] ?? fallback;
    case "negotiation":
      return negotiationColors[status] ?? fallback;
    case "proposal":
      return proposalColors[status] ?? fallback;
    case "reservation":
      return reservationColors[status] ?? fallback;
    case "sale":
      return saleColors[status] ?? fallback;
    default:
      return fallback;
  }
}

export default function NexaBadge(props: BadgeProps) {
  const colors = getColors(props.entity, props.status);

  return (
    <span
      className="nexa-badge"
      style={{
        color: colors.color,
        background: colors.bg,
        border: colors.border ? `1px solid ${colors.border}` : undefined,
        fontSize: props.entity === "unit" ? 9 : undefined,
        padding: props.entity === "unit" ? "4px 10px" : undefined,
        borderRadius: props.entity === "unit" ? 5 : undefined,
      }}
    >
      {props.label}
    </span>
  );
}
