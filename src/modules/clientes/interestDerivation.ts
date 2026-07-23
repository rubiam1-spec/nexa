// Ficha Viva · FASE 2 — derivação do INTERESSE a partir da simulação (PURO/testável).
// Doutrina: o que o sistema já sabe não aparece como "—". Derivado ≠ declarado:
// derivado carrega origem (interest_sources) e badge "sugerido"; edição manual
// remove a origem (vira declarado). Campo canônico do tipo = `interesse`
// (empreendimentos são loteamento urbano → 'lote_urbano').

export type InterestOrigin = "simulation" | "negotiation";
export type InterestSource = { origin: InterestOrigin; ref: string; at: string }; // at = 'YYYY-MM-DD'
export type InterestSources = Record<string, InterestSource>;

export const DERIVABLE_INTEREST_FIELDS = ["interesse", "budget_max", "payment_preference"] as const;
export type DerivableInterestField = (typeof DERIVABLE_INTEREST_FIELDS)[number];

export type SimulationForInterest = {
  id: string;
  valorTotal: number;
  entradaPercentual: number | null;
  parcelasQuantidade: number | null;
  createdAt: string;
};

export type InterestValues = {
  interesse: string | null;
  budget_max: number | null;
  payment_preference: string | null;
};

export type DerivedInterest = {
  values: Record<DerivableInterestField, string | number>;
  sources: InterestSources;
};

// "parcelado · entrada X% · Nx" — partes só aparecem quando há dado.
export function formatPaymentSuggestion(entradaPct: number | null, parcelas: number | null): string {
  const parts = ["parcelado"];
  if (entradaPct != null && entradaPct > 0) parts.push(`entrada ${Math.round(entradaPct)}%`);
  if (parcelas != null && parcelas > 0) parts.push(`${parcelas}x`);
  return parts.join(" · ");
}

export function deriveInterestFromSimulation(sim: SimulationForInterest): DerivedInterest {
  const at = (sim.createdAt || "").slice(0, 10);
  const src: InterestSource = { origin: "simulation", ref: sim.id, at };
  return {
    values: {
      interesse: "lote_urbano",
      budget_max: sim.valorTotal,
      payment_preference: formatPaymentSuggestion(sim.entradaPercentual, sim.parcelasQuantidade),
    },
    sources: { interesse: src, budget_max: src, payment_preference: src },
  };
}

// Plano de escrita: aplica a sugestão SÓ onde o campo está vazio e não é declarado
// nem já rastreado (respeita o que o humano escreveu e o que já foi sugerido antes).
// Retorna o patch { values, sources } a persistir, ou null se nada a fazer.
export function planInterestSuggestion(
  current: InterestValues,
  currentSources: InterestSources,
  derived: DerivedInterest,
): { values: Partial<InterestValues>; sources: InterestSources } | null {
  const values: Partial<InterestValues> = {};
  const sources: InterestSources = { ...currentSources };
  let changed = false;
  for (const f of DERIVABLE_INTEREST_FIELDS) {
    const cur = current[f];
    const isEmpty = cur == null || cur === "";
    const alreadyTracked = currentSources[f] != null;
    if (isEmpty && !alreadyTracked) {
      (values as Record<string, unknown>)[f] = derived.values[f];
      sources[f] = derived.sources[f];
      changed = true;
    }
  }
  return changed ? { values, sources } : null;
}

// Edição manual de um campo → declarado: remove a origem.
export function declareField(sources: InterestSources, field: string): InterestSources {
  if (!(field in sources)) return sources;
  const next = { ...sources };
  delete next[field];
  return next;
}

// Origem do campo (para o badge "sugerido · <origin> de <at>"), ou null se declarado.
export function interestSourceOf(sources: InterestSources | null | undefined, field: string): InterestSource | null {
  return sources?.[field] ?? null;
}
