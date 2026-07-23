// N2 · TOQUE canônico (lastTouch), PURO e testável.
//   lastTouch = max(última interação, última atividade COMPLETED do cliente)
// Fonte de produção = coluna `clients.last_interaction_at` (mantida por trigger;
// a LISTA lê a coluna, barato). Este serviço centraliza a leitura e o cálculo
// LOCAL na ficha (conferência/teste), espelhando o momento do trigger:
//   momento da atividade = LEAST(activity_date + coalesce(start_time,'12:00'), now)
//   só status='completed' conta; pendente/scheduled NÃO conta; GREATEST não retrocede.

export type TouchInteraction = { performedAt: string | null };
export type TouchActivity = { status: string; activityDate: string | null; startTime?: string | null };

const COMPLETED = "completed";

/** Momento (ms) de uma atividade — só se CONCLUÍDA — clampado em now (não inventa
 *  futuro). null quando não conta (pendente/scheduled/sem data). */
export function activityTouchMs(a: TouchActivity, nowMs: number): number | null {
  if (a.status !== COMPLETED || !a.activityDate) return null;
  const time = a.startTime && a.startTime.length >= 5 ? a.startTime.slice(0, 5) : "12:00";
  const t = new Date(`${a.activityDate}T${time}:00`).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.min(t, nowMs); // clamp em now
}

function interactionMs(i: TouchInteraction): number | null {
  if (!i.performedAt) return null;
  const t = new Date(i.performedAt).getTime();
  return Number.isFinite(t) ? t : null;
}

/** lastTouch LOCAL (ISO) = max de todas as interações e atividades CONCLUÍDAS.
 *  null se não há toque. Usado na ficha como conferência do canônico. */
export function computeLastTouch(
  interactions: TouchInteraction[],
  activities: TouchActivity[],
  nowMs: number = Date.now(),
): string | null {
  let best: number | null = null;
  for (const i of interactions) { const m = interactionMs(i); if (m != null && (best == null || m > best)) best = m; }
  for (const a of activities) { const m = activityTouchMs(a, nowMs); if (m != null && (best == null || m > best)) best = m; }
  return best == null ? null : new Date(best).toISOString();
}

/** Toque canônico a consumir: GREATEST(coluna canônica, cálculo local). A coluna
 *  é a verdade de produção; o local garante que a ficha reflita na HORA um toque
 *  recém-concluído mesmo antes do refetch — e nunca retrocede. */
export function resolveLastTouch(columnValue: string | null | undefined, local: string | null): string | null {
  const col = columnValue ? new Date(columnValue).getTime() : null;
  const loc = local ? new Date(local).getTime() : null;
  if (col == null) return local;
  if (loc == null) return columnValue ?? null;
  return col >= loc ? (columnValue ?? null) : local;
}
