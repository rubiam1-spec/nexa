// L1.8 — Dedupe da timeline da ficha (interação × activity espelho), PURO e testável.
// A ficha grava, por interação manual, um contact_interaction (registro) + um
// activity espelho (produção nos relatórios). Na timeline os dois apareceriam
// duplicados. Aqui escondemos o espelho:
//   1. DETERMINÍSTICO — activity cujo id está vinculado por contact_interactions.activity_id.
//   2. FALLBACK LEGADO (documentado) — espelhos pré-L1.8 sem vínculo: mesmo
//      tipo|título|dia de alguma interação. Só fallback (heurística pode, um dia,
//      esconder registro legítimo homônimo no mesmo dia — aceito p/ legado).
export type TimelineActivity = {
  id: string;
  type: string;
  title: string | null;
  activity_date: string;
  created_at: string | null;
};

export type TimelineInteractionRef = {
  type: string;
  title: string | null;
  performed_at: string;
  activity_id: string | null;
};

const sig = (type: string, title: string | null, dateIso: string) =>
  `${type}|${title ?? ""}|${(dateIso || "").slice(0, 10)}`;

export function filterMirroredActivities<A extends TimelineActivity>(
  activities: A[],
  interactions: TimelineInteractionRef[],
): A[] {
  const mirroredIds = new Set(interactions.map((i) => i.activity_id).filter(Boolean) as string[]);
  const legacySig = new Set(interactions.map((i) => sig(i.type, i.title, i.performed_at)));
  return activities.filter(
    (a) => !mirroredIds.has(a.id) && !legacySig.has(sig(a.type, a.title, a.created_at ?? a.activity_date)),
  );
}

// Simulação → item de timeline "Simulação criada · <valor>". Puro/testável.
// A SEÇÃO de simulações é a visão acionável; aqui só o marco temporal.
export type SimulationTimelineInput = { id: string; valorTotal: number; createdBy: string | null; createdAt: string };
export type MergedTimelineItem = {
  id: string; type: string; direction: string | null; title: string; description: string | null;
  performed_by: string | null; performed_at: string; profiles: { name: string } | null;
  _source: "activity"; _activityId: string | null;
};

export function simulationTimelineItems(
  sims: SimulationTimelineInput[],
  fmtValue: (v: number) => string,
  resolveName: (userId: string | null) => string | null,
): MergedTimelineItem[] {
  return sims.map((sm) => {
    const name = resolveName(sm.createdBy);
    return {
      id: `sim-${sm.id}`, type: "simulation", direction: null,
      title: `Simulação criada · ${fmtValue(sm.valorTotal)}`, description: null,
      performed_by: sm.createdBy, performed_at: sm.createdAt,
      profiles: name ? { name } : null, _source: "activity", _activityId: null,
    };
  });
}

// ── Ficha Viva · TIMELINE ÚNICA ─────────────────────────────────────────────
// UMA fonte para as abas Interações e Histórico (mata a leitura divergente).
// Une: interações + activities (deduplicadas) + simulações + negociações +
// cadastro. As abas diferem só no ENQUADRAMENTO: Interações = operação com o
// registrador (edita interação/activity); Histórico = auditoria compacta.
// Eventos de qualificação já chegam como interações type status_change.
export type FichaTimelineKind = "interaction" | "activity" | "simulation" | "negotiation" | "registration";

export type FichaInteraction = {
  id: string; type: string; title: string | null; description: string | null;
  performed_by: string | null; performed_at: string; activity_id: string | null;
  profiles?: { name: string } | null;
};
export type FichaActivity = TimelineActivity & { outcome?: string | null; profile_id: string | null };
export type FichaNegotiation = {
  id: string; status: string; updated_at: string;
  unit_quadra: string | null; unit_lote: string | null; unit_valor: number | null; broker_name: string | null;
};

export type FichaTimelineItem = {
  id: string;
  kind: FichaTimelineKind;
  type: string;               // sub-tipo p/ ícone/rótulo (tipo da interação/activity; ou o próprio kind)
  date: string;               // ISO — ordenação e exibição
  title: string;
  description: string | null;
  badgeLabel: string | null;  // rótulo do selo (status da negociação; senão a UI deriva de type)
  actorId: string | null;     // performed_by / profile_id (autoria)
  actorName: string | null;
  linkTo: string | null;
  interactionId: string | null; // presente ⇒ item é interação editável
  activityId: string | null;    // presente ⇒ item é activity removível
};

export type FichaTimelineInput = {
  interactions: FichaInteraction[];
  activities: FichaActivity[];
  simulations: SimulationTimelineInput[];
  negotiations: FichaNegotiation[];
  registrationAt: string | null;
  resolveActor: (userId: string | null) => string | null;
  fmtValue: (v: number | null) => string;
  statusLabel: (status: string) => string;
};

export function buildFichaTimeline(input: FichaTimelineInput): FichaTimelineItem[] {
  const items: FichaTimelineItem[] = [];

  for (const ci of input.interactions) {
    items.push({
      id: `int-${ci.id}`, kind: "interaction", type: ci.type, date: ci.performed_at,
      title: ci.title || "", description: ci.description, badgeLabel: null,
      actorId: ci.performed_by, actorName: ci.profiles?.name ?? input.resolveActor(ci.performed_by),
      linkTo: null, interactionId: ci.id, activityId: null,
    });
  }

  // Activities-espelho já cobertas por uma interação são escondidas (dedupe puro).
  const deduped = filterMirroredActivities(input.activities, input.interactions.map((i) => ({ type: i.type, title: i.title, performed_at: i.performed_at, activity_id: i.activity_id })));
  for (const a of deduped) {
    items.push({
      id: `act-${a.id}`, kind: "activity", type: a.type, date: a.created_at ?? (a.activity_date + "T12:00:00"),
      title: a.title || "", description: a.outcome ?? null, badgeLabel: null,
      actorId: a.profile_id, actorName: input.resolveActor(a.profile_id),
      linkTo: null, interactionId: null, activityId: a.id,
    });
  }

  for (const s of input.simulations) {
    items.push({
      id: `sim-${s.id}`, kind: "simulation", type: "simulation", date: s.createdAt,
      title: `Simulação criada · ${input.fmtValue(s.valorTotal)}`, description: null, badgeLabel: null,
      actorId: s.createdBy, actorName: input.resolveActor(s.createdBy),
      linkTo: null, interactionId: null, activityId: null,
    });
  }

  for (const n of input.negotiations) {
    items.push({
      id: `neg-${n.id}`, kind: "negotiation", type: "negotiation", date: n.updated_at,
      title: `Negociação — Q${n.unit_quadra}/L${n.unit_lote}`,
      description: `${input.fmtValue(n.unit_valor)} · ${n.broker_name || "—"}`,
      badgeLabel: input.statusLabel(n.status),
      actorId: null, actorName: n.broker_name ?? null,
      linkTo: `/negociacoes/${n.id}`, interactionId: null, activityId: null,
    });
  }

  if (input.registrationAt) {
    items.push({
      id: "reg", kind: "registration", type: "registration", date: input.registrationAt,
      title: "Cliente cadastrado", description: null, badgeLabel: "CADASTRO", actorId: null, actorName: null,
      linkTo: null, interactionId: null, activityId: null,
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
