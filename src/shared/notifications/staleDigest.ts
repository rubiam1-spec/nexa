// DIGEST diário de negociações paradas + regra de supressão (fim da metralhadora).
// Antes: o produtor (useCadenceAlerts) reinseria um LOTE de negotiation_stale por
// conta/dia → 170 notificações em ~90 dias, enterrando as urgentes. Agora:
//  - UMA notificação consolidada por destinatário (digest);
//  - supressão: não recriar enquanto houver um NÃO LIDO do mesmo tipo, e cooldown
//    de STALE_COOLDOWN_DAYS após a última (âncora created_at — a tabela não tem
//    read_at; ver AUDITORIA cap. A).
import { notificationSubject } from "./notificationSubject";

/** Tipo canônico da notificação de negociações paradas (digest). */
export const STALE_TYPE = "negotiation_stale";
/** Título fixo do digest. */
export const STALE_DIGEST_TITLE = "Negociações paradas";
/** Após a última notificação de stale, não re-notificar por N dias. */
export const STALE_COOLDOWN_DAYS = 7;
/** Destino do digest: Kanban, onde os cards parados já vêm sinalizados. */
export const STALE_DIGEST_ACTION_URL = "/negociacoes?view=kanban";

export type StaleNegotiation = {
  id: string;
  updatedAt: string;
  clientName?: string | null;
  quadra?: string | number | null;
  lote?: string | number | null;
};

export type StaleDigest = { count: number; oldestDays: number; title: string; message: string };

const DAY_MS = 86_400_000;

/**
 * Monta o digest a partir das negociações paradas. Retorna null se não houver
 * nenhuma. Mensagem: "N negociações paradas — a mais antiga há Xd (assunto)."
 * `now` é injetado (testável/determinístico).
 */
export function buildStaleDigest(negs: StaleNegotiation[], now: number): StaleDigest | null {
  if (!negs || negs.length === 0) return null;

  let oldest = negs[0];
  for (const n of negs) {
    if (new Date(n.updatedAt).getTime() < new Date(oldest.updatedAt).getTime()) oldest = n;
  }
  const oldestDays = Math.max(0, Math.floor((now - new Date(oldest.updatedAt).getTime()) / DAY_MS));
  const subject = notificationSubject({
    clientName: oldest.clientName,
    quadra: oldest.quadra,
    lote: oldest.lote,
    negotiationId: oldest.id,
  });
  const noun = negs.length === 1 ? "negociação parada" : "negociações paradas";
  const message = `${negs.length} ${noun} — a mais antiga há ${oldestDays}d (${subject}).`;
  return { count: negs.length, oldestDays, title: STALE_DIGEST_TITLE, message };
}

/**
 * Decide se devemos SUPRIMIR a criação de um novo digest, dado o último registro
 * do tipo para o destinatário. Sem `last` → não suprime. Não lido → suprime.
 * Lido mas dentro do cooldown → suprime.
 */
export function shouldSuppressStale(
  last: { read: boolean | null; created_at: string } | null | undefined,
  now: number,
  cooldownDays: number = STALE_COOLDOWN_DAYS,
): boolean {
  if (!last) return false;
  if (!last.read) return true;
  const ageDays = (now - new Date(last.created_at).getTime()) / DAY_MS;
  return ageDays < cooldownDays;
}
