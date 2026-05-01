// Responsabilidade única: traduzir (xPct, yPct) calibrados em unit_map_pins
// para a posição de tela do pin dentro do container do mapa.
//
// Hoje a regra é trivial: o container tem aspect-ratio == aspect da imagem
// e objectFit: fill na img — então % do container == % da imagem renderizada
// e basta devolver "xPct%/yPct%".
//
// Se no futuro o mapa ganhar pan/zoom nativos (sem `transform: scale`), este
// utilitário é o único ponto de mudança para aplicar translate/scale.

export interface PinScreenPosition {
  left: string;
  top: string;
}

/**
 * Dado um pin calibrado em percentuais sobre a imagem do mapa e as dimensões
 * do container exibido, devolve a posição de tela do pin como strings CSS.
 *
 * containerWidth/Height não são usados enquanto o container mantiver
 * aspect-ratio da imagem (== a premissa de alinhamento). São reservados
 * para a evolução futura (bounds check, clamp, etc.).
 */
export function pinScreenPosition(
  xPct: number,
  yPct: number,
  _containerWidth?: number,
  _containerHeight?: number,
): PinScreenPosition {
  return {
    left: `${xPct}%`,
    top: `${yPct}%`,
  };
}

/**
 * Calcula o aspect ratio (largura / altura) a partir das dimensões naturais
 * da imagem carregada. Retorna null se alguma dimensão for zero ou inválida
 * — o chamador deve usar `auto` como fallback CSS.
 */
export function imageAspectRatio(
  naturalWidth: number,
  naturalHeight: number,
): number | null {
  if (!naturalWidth || !naturalHeight || naturalHeight === 0) return null;
  const ratio = naturalWidth / naturalHeight;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return ratio;
}
