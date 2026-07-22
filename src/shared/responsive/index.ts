// R1 · Fundação fluida (src/shared/responsive) — fonte única dos helpers de
// responsividade dirigida ao ESPAÇO. Layout responde ao espaço (fluidGrid/clamp/
// useContainerWidth); INTERAÇÃO responde ao ponteiro (useIsTouch, reexportado
// aqui como árbitro único). Breakpoint só sobra para a navegação (FASE 2).
export { fluidGrid, type FluidGridMode } from "./fluidGrid";
export { clampSize, fluidCoeffs, fluidText, fluidSpace, type ClampOpts } from "./clampSize";
export { useContainerWidth } from "./useContainerWidth";
export { useIsTouch } from "../mobile/useIsTouch";
