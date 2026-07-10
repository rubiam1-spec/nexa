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
