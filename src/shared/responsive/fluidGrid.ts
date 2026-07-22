// R1 · Fundação fluida — grid dirigido ao ESPAÇO, nunca ao rótulo de device.
// Uma faixa auto-fit/auto-fill com minmax(min(100%, Xpx), 1fr):
//   • min(100%, Xpx)  → evita overflow quando o container é menor que Xpx
//     (a trilha nunca exige mais que a largura disponível);
//   • auto-fit        → colapsa trilhas vazias e ESTICA os itens p/ preencher;
//   • auto-fill       → mantém trilhas vazias (itens ficam no mínimo, evitando
//     o card único "esticado" full-width).
// String pura, usável direto no inline style `gridTemplateColumns`. Sem JS, sem
// breakpoint, sem listener de largura — o navegador resolve por espaço.
export type FluidGridMode = "fit" | "fill";

export function fluidGrid(minPx: number, mode: FluidGridMode = "fit"): string {
  const auto = mode === "fill" ? "auto-fill" : "auto-fit";
  return `repeat(${auto}, minmax(min(100%, ${minPx}px), 1fr))`;
}
