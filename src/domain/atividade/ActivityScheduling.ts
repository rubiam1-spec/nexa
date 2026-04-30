// Domínio: agendamento de atividade
// ---
// A decisão scheduled vs completed é regra de domínio — não de UI.
// Se um dia o fuso-BRT voltar a ter DST, trocar a implementação de
// toActivityMomentBRT aqui SEM propagar mudança pra chamadores.

const BRT_OFFSET = "-03:00"; // Brasil sem DST desde 2019; isolado para trocar se voltar.

export type ActivityInitialStatus = "scheduled" | "completed";

/**
 * Monta o instante absoluto de uma atividade a partir de (activity_date,
 * start_time) interpretados em America/Sao_Paulo.
 *
 *   - activity_date: "YYYY-MM-DD"
 *   - start_time:    "HH:MM" | "HH:MM:SS" | null (null => 00:00 do dia)
 *
 * Retorna um Date nativo representando o instante absoluto. Usar apenas
 * .getTime() para comparações — o instante já carrega o offset.
 */
export function toActivityMomentBRT(
  activity_date: string,
  start_time: string | null,
): Date {
  const time = (start_time ?? "00:00").slice(0, 8);
  // Aceita "HH:MM" ou "HH:MM:SS". Se vier só "HH:MM", promove a "HH:MM:00".
  const timeWithSeconds = time.length === 5 ? `${time}:00` : time;
  const iso = `${activity_date}T${timeWithSeconds}${BRT_OFFSET}`;
  return new Date(iso);
}

/**
 * Decide scheduled/completed a partir do instante da atividade e de "agora".
 * Regra: estritamente futuro => scheduled. Mesmo instante ou passado =>
 * completed.
 *
 * NÃO usar para valores terminais explícitos (skipped/missed/cancelled) —
 * esses são escolha do usuário e não passam por esta função.
 */
export function decideInitialActivityStatus(
  moment: Date,
  now: Date = new Date(),
): ActivityInitialStatus {
  return moment.getTime() > now.getTime() ? "scheduled" : "completed";
}
