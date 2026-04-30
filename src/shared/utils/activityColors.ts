export interface ActivityColorSet {
  color: string;
  bg: string;
  border: string;
}

export const ACTIVITY_COLORS: Record<string, ActivityColorSet> = {
  visit_client: { color: "#4ADE80", bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.25)" },
  visit_broker: { color: "#4ADE80", bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.25)" },
  visit_development: { color: "#4ADE80", bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.25)" },
  meeting_external: { color: "#60A5FA", bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.25)" },
  meeting_internal: { color: "#60A5FA", bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.25)" },
  // Follow-up = laranja (terracotta); Treinamento = roxo — alinhado com o map
  // local de AtividadesPage.tsx (T.purple / T.orange) e com a Lista de Atividades.
  phone_call: { color: "#A78BFA", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.25)" },
  follow_up: { color: "#D97706", bg: "rgba(217,119,6,0.15)", border: "rgba(217,119,6,0.25)" },
  training: { color: "#A78BFA", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.25)" },
  other: { color: "#5C5647", bg: "rgba(92,86,71,0.15)", border: "rgba(92,86,71,0.25)" },
};

export function getActivityColors(type: string): ActivityColorSet {
  return ACTIVITY_COLORS[type] || ACTIVITY_COLORS.other;
}
