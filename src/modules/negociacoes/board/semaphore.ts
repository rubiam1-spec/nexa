// Fase B do Funil — semáforo de situação do card (PURO, testável).
// Regra (decisão de produto): próxima ação agendada = verde · sem próxima ação
// = âmbar · parada há Xd OU prazo (reserva) vencido = vermelho.
// Usa apenas o que já existe (next_action_at/follow_up_at, last_activity_at,
// stage_changed_at, expires_at da reserva). NÃO inventa dado: sem base de tempo,
// degrada para âmbar "sem próxima ação".
//
// Coerência de estado (Etapa 0c) — quando o chamador informa `status`:
//   • WON/LOST/CANCELLED nunca são alerta → "neutral" (encerrada, sem atenção);
//   • o alerta "Sem próxima ação" só vale em status VIVO E com dono
//     (owner_profile_id) OU atividade registrada — senão "neutral" (não nag).
// Chamadas SEM `status` mantêm o comportamento legado (retrocompatível).
export type SemaphoreLevel = "green" | "amber" | "red" | "neutral";

export type SemaphoreInput = {
  nextActionAt?: string | null;
  followUpAt?: string | null;
  lastActivityAt?: string | null;
  updatedAt?: string | null;
  stageChangedAt?: string | null;
  reservaExpiresAt?: string | null;
  /** Reserva ativa (não terminal) — só então o prazo vale como vermelho. */
  reservaAtiva?: boolean;
  /** Status da negociação — ativa as regras de coerência (c) quando presente. */
  status?: string | null;
  /** Dono interno — parte do gate do alerta "sem próxima ação". */
  ownerProfileId?: string | null;
};

export type Semaphore = { level: SemaphoreLevel; label: string };

const TERMINAL = new Set(["WON", "LOST", "CANCELLED"]);
const TERMINAL_LABEL: Record<string, string> = { WON: "Concluída", LOST: "Perdida", CANCELLED: "Cancelada" };

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function ddmm(iso: string): string {
  // UTC para ser determinístico (independe do fuso do ambiente/CI).
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param thresholdDays limite de "parada" (dias sem atividade) — vem de cadence_settings.
 * @param nowMs relógio (injetável para testes).
 */
export function semaphoreOf(
  input: SemaphoreInput,
  thresholdDays: number,
  nowMs: number = Date.now(),
): Semaphore {
  const day = 86_400_000;

  const statusUp = (input.status ?? "").trim().toUpperCase();
  const statusAware = statusUp !== "";

  // 0. Coerência (c): status terminal nunca é alerta — encerrado, sem atenção.
  if (statusAware && TERMINAL.has(statusUp)) {
    return { level: "neutral", label: TERMINAL_LABEL[statusUp] };
  }

  // 1. Prazo de reserva vencido (só se a reserva está ativa).
  if (input.reservaAtiva) {
    const exp = ms(input.reservaExpiresAt);
    if (exp != null && exp <= nowMs) {
      return { level: "red", label: "Prazo vencido" };
    }
  }

  // 2. Próxima ação agendada (next_action_at tem prioridade sobre follow_up_at).
  const nextIso = input.nextActionAt ?? input.followUpAt ?? null;
  const next = ms(nextIso);
  if (next != null && nextIso) {
    if (next >= nowMs) return { level: "green", label: `Ação ${ddmm(nextIso)}` };
    return { level: "red", label: "Ação atrasada" };
  }

  // 3. Sem próxima ação: âmbar, a menos que esteja parada além do limite.
  const base = ms(input.lastActivityAt) ?? ms(input.updatedAt) ?? ms(input.stageChangedAt);
  if (base != null) {
    const idleDays = Math.floor((nowMs - base) / day);
    if (idleDays >= thresholdDays) {
      return { level: "red", label: `Parada há ${idleDays}d` };
    }
  }

  // 4. Alerta "Sem próxima ação": com contexto de status, só nag quando VIVO e
  //    com dono OU atividade; caso contrário, neutro (não polui o board).
  if (statusAware) {
    const hasOwner = !!input.ownerProfileId;
    const hasActivity = !!input.lastActivityAt;
    if (!hasOwner && !hasActivity) return { level: "neutral", label: "—" };
  }
  return { level: "amber", label: "Sem próxima ação" };
}
