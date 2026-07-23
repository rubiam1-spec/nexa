// Ficha Viva · FASE 1 — a timeline ÚNICA (buildFichaTimeline).
import { describe, it, expect } from "vitest";
import { buildFichaTimeline, type FichaTimelineInput } from "../timelineMerge";

const base: FichaTimelineInput = {
  interactions: [],
  activities: [],
  simulations: [],
  negotiations: [],
  registrationAt: null,
  resolveActor: (id) => (id ? `User ${id}` : null),
  fmtValue: (v) => (v == null ? "—" : `R$ ${v}`),
  statusLabel: (s) => s.toUpperCase(),
};

describe("buildFichaTimeline — fonte única das duas abas", () => {
  it("une interações + activities + simulações + negociações + cadastro numa lista só", () => {
    const items = buildFichaTimeline({
      ...base,
      interactions: [{ id: "i1", type: "phone_call", title: "Ligou", description: "ok", performed_by: "u1", performed_at: "2026-07-20T10:00:00Z", activity_id: null }],
      activities: [{ id: "a1", type: "note", title: "Nota", outcome: "detalhe", activity_date: "2026-07-19", created_at: "2026-07-19T09:00:00Z", profile_id: "u2" }],
      simulations: [{ id: "s1", valorTotal: 862500, createdBy: "u1", createdAt: "2026-07-22T15:00:00Z" }],
      negotiations: [{ id: "n1", status: "won", updated_at: "2026-07-21T12:00:00Z", unit_quadra: "3", unit_lote: "5", unit_valor: 500000, broker_name: "Ana" }],
      registrationAt: "2026-07-01T08:00:00Z",
    });
    // 5 fontes, 5 itens
    expect(items.map((i) => i.kind)).toEqual(
      // ordenado por data DESC: sim(22) > neg(21) > int(20) > act(19) > reg(01)
      ["simulation", "negotiation", "interaction", "activity", "registration"],
    );
  });

  it("ordena por data DESC", () => {
    const items = buildFichaTimeline({
      ...base,
      interactions: [
        { id: "i1", type: "note", title: "antiga", description: null, performed_by: null, performed_at: "2026-01-01T00:00:00Z", activity_id: null },
        { id: "i2", type: "note", title: "nova", description: null, performed_by: null, performed_at: "2026-07-01T00:00:00Z", activity_id: null },
      ],
    });
    expect(items[0].title).toBe("nova");
    expect(items[1].title).toBe("antiga");
  });

  it("deduplica a activity-espelho vinculada a uma interação (activity_id)", () => {
    const items = buildFichaTimeline({
      ...base,
      interactions: [{ id: "i1", type: "phone_call", title: "Ligação", description: null, performed_by: "u1", performed_at: "2026-07-20T10:00:00Z", activity_id: "a1" }],
      activities: [{ id: "a1", type: "phone_call", title: "Ligação", outcome: null, activity_date: "2026-07-20", created_at: "2026-07-20T10:00:00Z", profile_id: "u1" }],
    });
    // só a interação sobrevive (a activity-espelho a1 some)
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("interaction");
  });

  it("interação carrega interactionId (editável); activity carrega activityId (removível)", () => {
    const items = buildFichaTimeline({
      ...base,
      interactions: [{ id: "i1", type: "note", title: "x", description: null, performed_by: "u1", performed_at: "2026-07-20T10:00:00Z", activity_id: null }],
      activities: [{ id: "a9", type: "note", title: "y", outcome: null, activity_date: "2026-07-18", created_at: "2026-07-18T10:00:00Z", profile_id: "u1" }],
    });
    const int = items.find((i) => i.kind === "interaction")!;
    const act = items.find((i) => i.kind === "activity")!;
    expect(int.interactionId).toBe("i1");
    expect(int.activityId).toBeNull();
    expect(act.activityId).toBe("a9");
    expect(act.interactionId).toBeNull();
  });

  it("negociação vira marco linkável; resolve autor pelo profiles/resolveActor", () => {
    const items = buildFichaTimeline({
      ...base,
      negotiations: [{ id: "n1", status: "won", updated_at: "2026-07-21T12:00:00Z", unit_quadra: "3", unit_lote: "5", unit_valor: 500000, broker_name: "Ana" }],
      interactions: [{ id: "i1", type: "note", title: "x", description: null, performed_by: "u7", performed_at: "2026-07-01T00:00:00Z", activity_id: null }],
    });
    const neg = items.find((i) => i.kind === "negotiation")!;
    expect(neg.linkTo).toBe("/negociacoes/n1");
    expect(neg.badgeLabel).toBe("WON"); // statusLabel resolveu o status
    const int = items.find((i) => i.kind === "interaction")!;
    expect(int.actorName).toBe("User u7");
  });

  it("lista vazia → []", () => {
    expect(buildFichaTimeline(base)).toEqual([]);
  });
});
