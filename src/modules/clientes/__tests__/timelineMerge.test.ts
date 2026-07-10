import { describe, it, expect } from "vitest";
import { filterMirroredActivities, type TimelineActivity, type TimelineInteractionRef } from "../timelineMerge";

const act = (o: Partial<TimelineActivity>): TimelineActivity => ({
  id: o.id ?? "a", type: o.type ?? "phone_call", title: o.title ?? "Ligação",
  activity_date: o.activity_date ?? "2026-07-10", created_at: o.created_at ?? "2026-07-10T14:00:00Z",
});
const int = (o: Partial<TimelineInteractionRef>): TimelineInteractionRef => ({
  type: o.type ?? "phone_call", title: o.title ?? "Ligação",
  performed_at: o.performed_at ?? "2026-07-10T14:00:00Z", activity_id: o.activity_id ?? null,
});

describe("filterMirroredActivities — dedupe do espelho (L1.8)", () => {
  it("esconde o espelho VINCULADO (contact_interactions.activity_id) — determinístico", () => {
    const activities = [act({ id: "act1" }), act({ id: "act2", title: "Visita", type: "visit_client" })];
    const interactions = [int({ activity_id: "act1" })]; // vínculo explícito ao act1
    const out = filterMirroredActivities(activities, interactions);
    expect(out.map((a) => a.id)).toEqual(["act2"]); // act1 escondido por vínculo
  });

  it("fallback legado: esconde espelho sem vínculo por tipo|título|dia", () => {
    const activities = [act({ id: "legacy", created_at: "2026-07-10T09:00:00Z" })];
    const interactions = [int({ activity_id: null, performed_at: "2026-07-10T09:01:00Z" })]; // mesmo tipo/título/dia
    expect(filterMirroredActivities(activities, interactions)).toHaveLength(0);
  });

  it("NÃO esconde activity standalone (QuickActivityModal) sem interação correspondente", () => {
    const activities = [act({ id: "standalone", title: "Atendimento presencial", type: "visit_client" })];
    const interactions = [int({ type: "phone_call", title: "Ligação" })]; // tipo/título diferentes
    expect(filterMirroredActivities(activities, interactions).map((a) => a.id)).toEqual(["standalone"]);
  });

  it("dia diferente NÃO dispara o fallback (heurística conservadora)", () => {
    const activities = [act({ id: "ontem", created_at: "2026-07-09T14:00:00Z", activity_date: "2026-07-09" })];
    const interactions = [int({ activity_id: null, performed_at: "2026-07-10T14:00:00Z" })];
    expect(filterMirroredActivities(activities, interactions).map((a) => a.id)).toEqual(["ontem"]);
  });
});
