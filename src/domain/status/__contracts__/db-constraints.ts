// CONTRATO enum × banco — projeção estática das CHECK constraints de status.
//
// FONTE DE VERDADE do schema = as migrations em supabase/migrations/ (governança 3).
// Este manifesto espelha, por tabela, o conjunto de valores aceito pela respectiva
// CHECK constraint. O teste de contrato (check:contracts) compara este manifesto
// com os valores canônicos de src/domain/status/ — SEM acesso a banco no CI.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ REGRA DE MANUTENÇÃO OBRIGATÓRIA                                            │
// │ Toda migration que criar/alterar um *_status_check DEVE atualizar o array  │
// │ correspondente aqui NO MESMO COMMIT. Caso contrário, check:contracts falha │
// │ (o enum da fonte única e este manifesto divergem).                         │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Abordagem = manifesto estático (não parsing de migration): a CHECK de negotiations
// é resultado de múltiplas migrations e o formato varia (IN(...)/ANY(ARRAY[...])),
// então um parser seria frágil. Um manifesto revisado + esta regra é mais robusto.
//
// Valores confirmados no banco de produção (convalidated=true) em 2026-07-03.

export const DB_STATUS_CONSTRAINTS: Record<string, readonly string[]> = {
  // migration: 20260411150408_normalize_negotiation_status_uppercase
  negotiations: ["OPEN", "IN_PROGRESS", "PROPOSAL", "RESERVATION", "WON", "LOST", "CANCELLED"],
  // migration: 20260702120000_status_checks_add_not_valid
  proposals: ["draft", "sent", "under_analysis", "accepted", "rejected", "expired", "counter_proposal"],
  // migration: 20260702120000_status_checks_add_not_valid
  reservations: ["requested", "approved", "rejected", "active", "cancelled", "expired", "converted"],
  // migration: 20260702120000_status_checks_add_not_valid
  reservation_requests: ["requested", "approved", "rejected", "cancelled"],
  // migration: 20260702120000_status_checks_add_not_valid
  sales: ["created", "awaiting_documents", "awaiting_contract", "awaiting_payment", "completed", "cancelled"],
  // migration: 20260702120000_status_checks_add_not_valid
  pipeline_simulations: ["ativa", "convertida", "expirada", "cancelada"],
  // migration: 20260413134807_create_simulation_groups
  simulation_groups: ["active", "converted", "expired", "cancelled"],
};
