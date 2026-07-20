// NexaViz — formatters ÚNICOS do sistema. PUROS (sem React/IO).
// Regra global de honestidade: "—" quando não há valor conhecido — NUNCA "R$ 0".
// Números sempre pt-BR; VGV/moeda compacta (R$ 1,2M).

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Moeda compacta pt-BR. null/NaN → "—". (0 é um valor válido aqui; use vgvOrDash p/ VGV.) */
export function compactBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1e3) return `R$ ${Math.round(v / 1e3)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

/** VGV/valor de venda: 0 ou ausente = desconhecido → "—" (nunca "R$ 0"). */
export function vgvOrDash(v: number | null | undefined): string {
  if (v == null || v === 0 || !Number.isFinite(v)) return "—";
  return compactBRL(v);
}

/** Percentual pt-BR. Aceita fração (0..1). null/NaN → "—". */
export function percent(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Genérico: aplica fmt só quando o valor é conhecido; senão "—". */
export function valueOrDash(v: number | null | undefined, fmt: (n: number) => string = (n) => String(n)): string {
  return v == null || !Number.isFinite(v) ? "—" : fmt(v);
}

/** Rótulo de cobertura honesta de soma de valores. */
export function coverageLabel(withValue: number, total: number): string {
  return `${withValue} de ${total} com valor`;
}

/** "mmm/yy" a partir do índice de mês absoluto (ano*12 + mês). */
export function ymLabel(ymIndex: number): string {
  const y = Math.floor(ymIndex / 12), m = ((ymIndex % 12) + 12) % 12;
  return `${MESES_PT[m]}/${String(y).slice(2)}`;
}

/** "18 jun" — dia + mês curto, a partir de um ISO/Date. */
export function dayMonthLabel(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MESES_PT[d.getUTCMonth()]}`;
}

/** Intervalo textual "18 jun – 18 jul" para declarar o corte do filtro. */
export function rangeLabel(startMs: number, endMs: number): string {
  return `${dayMonthLabel(startMs)} – ${dayMonthLabel(endMs)}`;
}
