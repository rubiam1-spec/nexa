// Frescor do briefing IA — PURO e testável. Regra de honestidade: acima de 48h
// o conteúdo é considerado desatualizado e NÃO deve ser renderizado (mostra-se
// um estado honesto). A regeneração é do Motor de Inteligência (fora daqui).
const STALE_MS = 48 * 60 * 60 * 1000;

export type BriefingFreshness = { isStale: boolean; relative: string };

export function briefingFreshness(createdAtIso: string, nowMs: number): BriefingFreshness {
  const t = Date.parse(createdAtIso);
  if (Number.isNaN(t)) return { isStale: true, relative: "—" };
  const age = nowMs - t;
  return { isStale: age > STALE_MS, relative: relativeLabel(age) };
}

function relativeLabel(ageMs: number): string {
  if (ageMs < 60_000) return "agora";
  const min = Math.floor(ageMs / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
