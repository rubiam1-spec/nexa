// R1 · Fundação fluida — clamp() fluido para tipografia e espaçamento.
// Interpola LINEARMENTE de minPx (no viewport minVw) a maxPx (no viewport maxVw),
// travando nos extremos. Retorna string usável direto no inline style (fontSize,
// gap, padding). Sem JS, sem breakpoint — responde ao espaço continuamente, então
// a mesma peça encolhe/cresce suave por toda a banda tablet em vez de saltar.
//
// A expressão preferida é `<slope>vw ± <intercept>px`, válida dentro de clamp().

export type ClampOpts = { minVw?: number; maxVw?: number };

/** Coeficientes da reta (expostos p/ teste puro e reuso). */
export function fluidCoeffs(minPx: number, maxPx: number, opts: ClampOpts = {}) {
  const minVw = opts.minVw ?? 360; // menor viewport de referência (telefone)
  const maxVw = opts.maxVw ?? 1280; // maior viewport de referência (desktop)
  const slope = (maxPx - minPx) / (maxVw - minVw); // px de tamanho por px de viewport
  const slopeVw = slope * 100; // em unidades vw
  const interceptPx = minPx - slope * minVw; // termo constante em px
  return { minVw, maxVw, slopeVw, interceptPx };
}

export function clampSize(minPx: number, maxPx: number, opts: ClampOpts = {}): string {
  if (minPx === maxPx) return `${minPx}px`;
  const { slopeVw, interceptPx } = fluidCoeffs(minPx, maxPx, opts);
  const s = +slopeVw.toFixed(4);
  const b = +interceptPx.toFixed(4);
  const sign = b >= 0 ? "+" : "-";
  const pref = `${s}vw ${sign} ${Math.abs(b)}px`;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  return `clamp(${lo}px, ${pref}, ${hi}px)`;
}

// Presets — rótulos estáveis e testáveis. Tipografia e espaçamento fluidos.
export const fluidText = {
  xs: clampSize(11, 12),
  sm: clampSize(12, 13),
  base: clampSize(13, 15),
  lg: clampSize(16, 20),
  xl: clampSize(20, 28),
  display: clampSize(24, 34),
};

export const fluidSpace = {
  xs: clampSize(6, 8),
  sm: clampSize(8, 12),
  md: clampSize(12, 20),
  lg: clampSize(20, 32),
};
