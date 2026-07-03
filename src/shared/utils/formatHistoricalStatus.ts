// Tradutor de EXIBIÇÃO de status para trilha de auditoria imutável.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ Uso EXCLUSIVO para renderizar trilha de auditoria imutável                 │
// │ (negotiation_history, unit_history). PROIBIDO em lógica, filtro, gate ou   │
// │ transição — para isso use src/domain/status/ (comparação estrita).         │
// └──────────────────────────────────────────────────────────────────────────┘
//
// O histórico contém vocabulário LEGADO não-canônico e imutável (por decisão de
// produto, NÃO normalizamos via UPDATE): valores UPPER de proposta/reserva da era
// antiga (DRAFT, SENT, UNDER_ANALYSIS, REQUESTED, APPROVED, IN_PROGRESS, ...) + PT.
// Este tradutor é TOLERANTE por design (UPPER/lower/PT/EN) e nunca quebra a timeline:
// valor desconhecido cai no fallback (exibe o valor cru).

const HISTORICAL_LABELS: Record<string, string> = {
  // Negociação
  open: "Aberta",
  in_progress: "Em andamento",
  proposal: "Proposta",
  reservation: "Reserva",
  won: "Ganha",
  lost: "Perdida",
  cancelled: "Cancelada",
  // Proposta
  draft: "Rascunho",
  sent: "Enviada",
  under_analysis: "Em análise",
  accepted: "Aceita",
  rejected: "Rejeitada",
  expired: "Expirada",
  counter_proposal: "Contraproposta",
  // Reserva / solicitação
  requested: "Solicitada",
  approved: "Aprovada",
  active: "Ativa",
  converted: "Convertida",
  // Venda
  created: "Criada",
  awaiting_documents: "Aguardando documentos",
  awaiting_contract: "Aguardando contrato",
  awaiting_payment: "Aguardando pagamento",
  completed: "Concluída",
  // Fila
  promoted: "Promovida",
  waiting: "Na fila",
  removed: "Removida",
  // Aliases PT legados
  em_andamento: "Em andamento",
  vendida: "Ganha",
  perdida: "Perdida",
  cancelada: "Cancelada",
  ativa: "Ativa",
  convertida: "Convertida",
  expirada: "Expirada",
};

/**
 * Rótulo PT-BR de exibição para um valor histórico de status (qualquer vocabulário
 * legado). Fallback seguro: retorna o valor cru se desconhecido; "—" para null/vazio.
 * NÃO usar para lógica — apenas apresentação de auditoria.
 */
export function formatHistoricalStatus(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  return HISTORICAL_LABELS[raw.toLowerCase()] ?? raw;
}
