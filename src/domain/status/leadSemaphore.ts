// Semáforo de PRIMEIRA RESPOSTA do lead (Leads L1) — PURO e testável.
// Regra: verde < 30min · âmbar < 2h · vermelho >= 2h desde a chegada
// (created_at). Lead JÁ ATENDIDO não pisca (a primeira transição/atendimento
// é a "primeira resposta"). PENDÊNCIA registrada: "SLA de primeira resposta
// CONFIGURÁVEL por conta" (hoje fixo 30min/2h).
export type LeadSemaphoreLevel = "green" | "amber" | "red" | "attended";
export type LeadSemaphore = { level: LeadSemaphoreLevel; label: string };

const MIN = 60_000;
const GREEN_MAX = 30 * MIN;
const AMBER_MAX = 120 * MIN;

function human(ms: number): string {
  const mins = Math.floor(ms / MIN);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  return `${h}h`;
}

/**
 * @param createdAt chegada do lead (ISO).
 * @param attended true se o lead já teve primeira resposta (saiu de NEW / foi atendido).
 * @param nowMs relógio injetável (testes).
 */
export function firstResponseSemaphore(
  createdAt: string,
  attended: boolean,
  nowMs: number = Date.now(),
): LeadSemaphore {
  if (attended) return { level: "attended", label: "Atendido" };

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return { level: "amber", label: "Sem data" };

  const elapsed = Math.max(0, nowMs - created);
  if (elapsed < GREEN_MAX) return { level: "green", label: `Novo · ${human(elapsed)}` };
  if (elapsed < AMBER_MAX) return { level: "amber", label: `Aguardando · ${human(elapsed)}` };
  return { level: "red", label: `Sem resposta · ${human(elapsed)}` };
}
