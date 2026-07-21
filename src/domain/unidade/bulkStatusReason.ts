// Fonte ÚNICA das mensagens PT-BR do RPC bulk_update_unit_status.
// PURA e testável — nenhum componente traduz razão/erro por conta própria.
//
// Contrato do RPC:
//   retorno { updated, blocked: [{ unit_id, reason }] }
//   razões de bloqueio (por unidade): not_found | forbidden | already_in_status
//     | active_reservation | sale_recorded | live_negotiation | won_negotiation_linked
//   exceptions (throw): not_authenticated | invalid_status | reason_required | invalid_batch_size

export type BulkBlockReason =
  | "not_found"
  | "forbidden"
  | "already_in_status"
  | "active_reservation"
  | "sale_recorded"
  | "live_negotiation"
  | "won_negotiation_linked";

const BLOCK_LABELS: Record<string, string> = {
  active_reservation: "Reserva ativa — trate pela reserva",
  sale_recorded: "Venda registrada — trate pela venda",
  live_negotiation: "Negociação viva — trate pela negociação",
  won_negotiation_linked: "Vinculada a negociação vendida — ajuste pela negociação para manter a consistência",
  already_in_status: "Já está neste status",
  forbidden: "Sem permissão para esta unidade",
  not_found: "Unidade não encontrada",
};

/** Razão de bloqueio (por unidade) → mensagem PT-BR. */
export function bulkBlockReasonLabel(reason: string): string {
  return BLOCK_LABELS[reason] ?? reason;
}

const ERROR_LABELS: Array<[string, string]> = [
  ["reason_required", "Informe um motivo (mínimo 5 caracteres)."],
  ["invalid_batch_size", "Seleção acima do limite de 200 unidades."],
  ["invalid_status", "Status de destino inválido."],
  ["not_authenticated", "Sessão expirada. Faça login novamente."],
];

/** Exception do RPC (message) → mensagem PT-BR; fallback genérico. */
export function bulkStatusErrorLabel(message: string): string {
  const m = (message ?? "").toLowerCase();
  for (const [code, label] of ERROR_LABELS) {
    if (m.includes(code)) return label;
  }
  return "Não foi possível alterar o status. Tente novamente.";
}
