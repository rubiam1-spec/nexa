// NexaViz — padrão único de gráficos do sistema (SVG + wrappers).
// Regra-mãe: agregação SEMPRE em serviço/hook; primitivas só pintam dados prontos.
export * from "./format";
export * from "./tokens";
export { VizFrame, VizLegendItem } from "./VizFrame";
export { useVizTooltip, VizTipRow } from "./VizTooltip";
export { Sparkline, BarSeries, LineOverlay, FunnelBars, type VizDatum, type FunnelStageDatum } from "./primitives";
