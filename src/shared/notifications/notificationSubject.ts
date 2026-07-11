// Rótulo de ASSUNTO de notificação — helper único e reutilizável.
// Regra dura (Governança, cap. A / 2026-07-11): PROIBIDO "()" ou string vazia em
// qualquer template de notificação. Cliente ausente → cai para a unidade
// ("Sem cliente · Q4·L14") ou, na falta desta, para o código da negociação.

export type NotificationSubjectInput = {
  clientName?: string | null;
  quadra?: string | number | null;
  lote?: string | number | null;
  negotiationId?: string | null;
};

function clean(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Rótulo da unidade ("Q4·L14"), ou null se não há quadra/lote. */
export function unitLabel(quadra?: string | number | null, lote?: string | number | null): string | null {
  const q = clean(quadra);
  const l = clean(lote);
  if (q && l) return `Q${q}·L${l}`;
  if (q) return `Q${q}`;
  if (l) return `L${l}`;
  return null;
}

/**
 * Assunto que NUNCA é vazio e NUNCA vira "()":
 *  cliente + unidade → "Fulano · Q4·L14"
 *  só cliente        → "Fulano"
 *  só unidade        → "Sem cliente · Q4·L14"
 *  nada + negId      → "Negociação #1a2b3c4d"
 *  nada              → "Sem cliente"
 */
export function notificationSubject(i: NotificationSubjectInput): string {
  const client = clean(i.clientName);
  const unit = unitLabel(i.quadra, i.lote);
  if (client && unit) return `${client} · ${unit}`;
  if (client) return client;
  if (unit) return `Sem cliente · ${unit}`;
  const negId = clean(i.negotiationId);
  if (negId) return `Negociação #${negId.slice(0, 8)}`;
  return "Sem cliente";
}
