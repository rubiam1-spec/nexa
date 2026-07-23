// N3-UI · exibição do score (PURO/testável). O front NUNCA recalcula — só lê
// clients.score / score_breakdown / score_updated_at (motor N3 roda no banco via
// pg_cron, dias úteis às 07:05). Aqui: faixa (cor), rótulos PT-BR dos 5 fatores
// e as linhas do breakdown para as barras.

export type ScoreBand = "high" | "mid" | "low" | "none";

/** ≥70 alta · 40–69 média · <40 baixa · null = sem avaliação. */
export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null || !Number.isFinite(score)) return "none";
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

/** Badge do card/lista aparece só na faixa alta/média (≥40). <40 não polui. */
export function showScoreBadge(score: number | null | undefined): boolean {
  const b = scoreBand(score);
  return b === "high" || b === "mid";
}

export type ScoreFactor = { key: string; label: string; max: number };

// Ordem canônica + rótulos PT-BR + máximos (fonte única da exibição).
export const SCORE_FACTORS: ScoreFactor[] = [
  { key: "recencia_toque", label: "Recência do toque", max: 30 },
  { key: "temperatura", label: "Temperatura", max: 20 },
  { key: "progresso", label: "Progresso na jornada", max: 20 },
  { key: "engajamento", label: "Engajamento comercial", max: 15 },
  { key: "followup", label: "Follow-up", max: 15 },
];

export type BreakdownRow = { key: string; label: string; value: number; max: number; pct: number };

/** As 5 linhas do breakdown, na ordem canônica, com valor clampado em [0,máx]
 *  e pct proporcional (para a barra). Fator ausente → 0. */
export function scoreBreakdownRows(breakdown: Record<string, unknown> | null | undefined): BreakdownRow[] {
  return SCORE_FACTORS.map((f) => {
    const raw = Number(breakdown?.[f.key] ?? 0);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(f.max, raw)) : 0;
    return { key: f.key, label: f.label, value, max: f.max, pct: f.max > 0 ? value / f.max : 0 };
  });
}
