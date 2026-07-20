// NexaViz — tokens de estilo dos gráficos. Séries em cores do DS; eixos/grid
// discretos; números em mono. REGRA: Sprout (var(--color-sprout)) é reservado a
// POSITIVO / VENDA / #1 — nunca como cor neutra de série.
export const VIZ = {
  mono: "var(--font-mono)",
  ink: "var(--color-chalk)",
  bone: "var(--color-bone)",
  dust: "var(--color-dust)",
  muted: "var(--color-slate)",
  clay: "var(--color-clay)",
  grid: "rgba(61,58,48,0.35)",
  axis: "var(--color-slate)",
  // acento positivo (uso restrito)
  positive: "var(--color-sprout)",
  positiveSolid: "#4ADE80",
  // paleta de séries neutras (ordem estável)
  blue: "#7DA7F4",
  purple: "#A78BFA",
  amber: "#E8B45A",
  slateBlue: "#9DB8E8",
  negative: "#F87171",
} as const;

/** Paleta neutra para séries categóricas (Sprout fica FORA — é só acento). */
export const VIZ_SERIES: readonly string[] = [VIZ.blue, VIZ.purple, VIZ.amber, VIZ.slateBlue, VIZ.clay];

export const VIZ_FRAME_HEIGHT = 220;
