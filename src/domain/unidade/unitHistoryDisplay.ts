// Exibição PT-BR da trilha de unit_history na Ficha da Unidade. PURA e testável.
// TOLERANTE por design (a trilha é imutável e mistura vocabulário): nunca lança.
//
// Fatos do banco (confirmados na RPC bulk_update_unit_status):
//   • from_status/to_status = strings de banco (available/reserved/in_negotiation/sold)
//     ou enum legado (DISPONIVEL…);
//   • o MOTIVO da alteração manual vem embutido em `action` como
//     "manual_status_change: <motivo>" (não há coluna reason).
import { UnidadeStatus } from "./UnidadeStatus";
import { getUnidadeStatusLabel } from "./UnidadeStatusLabel";

const DB_TO_ENUM: Record<string, string> = {
  available: UnidadeStatus.DISPONIVEL,
  reserved: UnidadeStatus.RESERVADO,
  in_negotiation: UnidadeStatus.EM_NEGOCIACAO,
  sold: UnidadeStatus.VENDIDO,
};

/** Rótulo PT-BR tolerante de um status de unidade (banco OU enum). "—" se vazio. */
export function unitStatusLabelTolerant(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const enumVal = DB_TO_ENUM[raw] ?? raw; // string de banco → enum; senão mantém
  return getUnidadeStatusLabel(enumVal as UnidadeStatus) ?? raw;
}

const ACTION_LABELS: Record<string, string> = {
  manual_status_change: "Alteração manual de status",
  imported: "Importada",
  NEGOTIATION_STARTED: "Negociação iniciada",
  NEGOTIATION_CANCELLED: "Negociação cancelada",
  QUEUE_PROMOTED: "Promovido da fila",
  RESERVATION_ACTIVATED: "Reserva ativada",
  RESERVATION_CANCELLED: "Reserva cancelada",
  RESERVATION_EXPIRED: "Reserva expirada",
  SALE_CREATED: "Venda registrada",
  historical_sale_registered: "Venda histórica registrada",
};

export type UnitHistoryActionDisplay = { label: string; reason: string | null };

/**
 * Interpreta o campo `action` cru → { label PT-BR, motivo }. A alteração manual
 * traz o motivo embutido ("manual_status_change: <motivo>") — extraído em destaque.
 * Ações desconhecidas caem num humanize seguro (nunca quebra).
 */
export function parseUnitHistoryAction(actionRaw: string | null | undefined): UnitHistoryActionDisplay {
  const raw = (actionRaw ?? "").trim();
  if (!raw) return { label: "—", reason: null };

  // Alteração manual: "manual_status_change: <motivo>" (ou sem motivo).
  const sep = raw.indexOf(":");
  if (sep >= 0) {
    const code = raw.slice(0, sep).trim();
    const rest = raw.slice(sep + 1).trim();
    if (code === "manual_status_change") {
      return { label: ACTION_LABELS.manual_status_change, reason: rest || null };
    }
  }

  if (ACTION_LABELS[raw]) return { label: ACTION_LABELS[raw], reason: null };

  // Fallback humanizado: "some_action" → "Some action".
  const human = raw.replace(/[_:]+/g, " ").trim();
  return { label: human ? human.charAt(0).toUpperCase() + human.slice(1) : raw, reason: null };
}
