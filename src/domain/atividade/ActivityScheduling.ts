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

// ── Quadro (Kanban) ──
// Mapeamento bidirecional entre coluna do quadro e status persistido.
// "expired" é apenas UI (scheduled + data passada) — nunca persistido.
// skipped/missed/cancelled NÃO entram no quadro (retornam null).

export type BoardColumn = "todo" | "doing" | "done";
export type BoardStatus = "scheduled" | "in_progress" | "completed";

export function nextStatusForColumn(column: BoardColumn): BoardStatus {
  if (column === "todo") return "scheduled";
  if (column === "doing") return "in_progress";
  return "completed";
}

export function columnForStatus(status: string | null | undefined): BoardColumn | null {
  if (status === "scheduled" || status === "expired") return "todo";
  if (status === "in_progress") return "doing";
  if (status === "completed") return "done";
  return null;
}

// ── Ordenação híbrida (horário = ordem) ──
// Arrastar para reordenar dentro de uma coluna reescreve o start_time do
// cartão para caber entre os vizinhos do ponto de soltura. Toda a regra de
// cálculo de slot vive aqui (domínio), NUNCA no componente.

type Slot = { activity_date: string; start_time: string | null };
export type ComputedSlot = { activity_date: string; start_time: string };

function parseMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const [h, m] = time.slice(0, 5).split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function formatMinutes(min: number): string {
  const norm = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function round15(min: number): number {
  return Math.round(min / 15) * 15;
}

function todayLocal(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Calcula (activity_date, start_time) para um cartão solto entre `prev`
 * (vizinho de cima) e `next` (vizinho de baixo) numa coluna de planejamento.
 *
 *   - prev && next  → ponto médio arredondado para 15 min (dia do prev).
 *   - só next (topo) → next − 30 min.
 *   - só prev (fim)  → prev + 30 min.
 *   - coluna vazia   → próximo slot de 15 min a partir de agora (hoje).
 *
 * Se o horário calculado colidir com um já ocupado (`opts.taken`, "HH:MM"),
 * empurra +15 min até achar um livre.
 */
export function computeSlotDateTime(
  prev: Slot | null,
  next: Slot | null,
  opts: { now?: Date; taken?: string[] } = {},
): ComputedSlot {
  const now = opts.now ?? new Date();
  const taken = new Set((opts.taken ?? []).map((t) => t.slice(0, 5)));

  let date: string;
  let min: number;

  if (prev && next) {
    date = prev.activity_date;
    const sameDay = prev.activity_date === next.activity_date;
    if (sameDay && prev.start_time && next.start_time) {
      const a = parseMinutes(prev.start_time);
      const b = parseMinutes(next.start_time);
      min = round15((a + b) / 2);
      // Garante que fique estritamente entre os vizinhos quando possível.
      if (min <= a) min = a + 15;
      if (min >= b && b - a > 15) min = b - 15;
    } else {
      // Vizinhos em dias diferentes: assume o dia do vizinho de cima.
      min = round15(parseMinutes(prev.start_time) + 30);
    }
  } else if (next && !prev) {
    date = next.activity_date;
    min = round15(parseMinutes(next.start_time ?? "00:30") - 30);
  } else if (prev && !next) {
    date = prev.activity_date;
    min = round15(parseMinutes(prev.start_time) + 30);
  } else {
    date = todayLocal(now);
    min = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
  }

  let guard = 0;
  while (taken.has(formatMinutes(min)) && guard < 200) {
    min += 15;
    guard++;
  }

  return { activity_date: date, start_time: formatMinutes(min) };
}

// ── Card aging ──
// Mede há quanto tempo o card não é tocado (updated_at). 100% client-side,
// nada persistido — a UI só lê o nível e estiliza.

export type AgingLevel = "none" | "soft" | "stale";

export function daysSinceUpdate(
  updatedAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!updatedAt) return 0;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/**
 * none (<3d) | soft (3–6d) | stale (≥7d). O caller decide a quem aplicar
 * (ex.: nunca a cards concluídos ou cards-sugestão).
 */
export function agingLevel(
  updatedAt: string | null | undefined,
  now: Date = new Date(),
): AgingLevel {
  const days = daysSinceUpdate(updatedAt, now);
  if (days >= 7) return "stale";
  if (days >= 3) return "soft";
  return "none";
}

// ── Parser heurístico de data/hora (PT-BR, sem IA) ──
// Reconhece "hoje/amanhã/depois de amanhã", dias da semana (próxima
// ocorrência) e horários ("10h", "às 14:30", "15h45"). Tudo client-side.

export type DateHint = { date?: string; time?: string };

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function fmtLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysLocal(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function parseDateHint(text: string, now: Date = new Date()): DateHint {
  const t = (text || "").toLowerCase();
  const hint: DateHint = {};

  // Horário: "14:30" / "14h30" / "às 9h" / "10 h"
  const hm = t.match(/\b(\d{1,2})[:h](\d{2})\b/);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (h < 24 && m < 60) hint.time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } else {
    const hOnly = t.match(/\b(\d{1,2})\s*h\b/);
    if (hOnly) {
      const h = Number(hOnly[1]);
      if (h < 24) hint.time = `${String(h).padStart(2, "0")}:00`;
    }
  }

  // Data relativa por palavra.
  if (/depois de amanh[aã]/.test(t)) {
    hint.date = fmtLocalDate(addDaysLocal(now, 2));
  } else if (/\bamanh[aã]\b/.test(t)) {
    hint.date = fmtLocalDate(addDaysLocal(now, 1));
  } else if (/\bhoje\b/.test(t)) {
    hint.date = fmtLocalDate(now);
  } else {
    for (const [name, dow] of Object.entries(WEEKDAYS)) {
      if (new RegExp(`\\b${name}(?:\\b|-feira)`).test(t)) {
        const delta = ((dow - now.getDay() + 7) % 7) || 7; // próxima ocorrência (nunca hoje)
        hint.date = fmtLocalDate(addDaysLocal(now, delta));
        break;
      }
    }
  }

  return hint;
}
