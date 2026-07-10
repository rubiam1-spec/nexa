import { describe, it, expect } from "vitest";
import { groupAssignableMembers, brokerageOptions, type AssignableMember } from "../assignmentGrouping";

const m = (over: Partial<AssignableMember>): AssignableMember => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: over.name ?? "X",
  role: over.role ?? "broker",
  brokerageId: over.brokerageId ?? null,
  brokerageName: over.brokerageName ?? null,
  activeLeads: over.activeLeads ?? 0,
});

const SAMPLE: AssignableMember[] = [
  m({ name: "Suellen", role: "commercial_consultant" }),
  m({ name: "Ana", role: "manager" }),
  m({ name: "Rubiam", role: "director" }),
  m({ name: "Carlos", role: "concierge" }),
  m({ name: "Bruno", role: "administrative" }),
  m({ name: "Ivo", role: "broker", brokerageId: "b1", brokerageName: "Alfa Imóveis" }),
  m({ name: "Aline", role: "broker", brokerageId: "b1", brokerageName: "Alfa Imóveis" }),
  m({ name: "Zeca", role: "broker", brokerageId: "b2", brokerageName: "Beta Corretora" }),
  m({ name: "Nina", role: "broker", brokerageId: null }), // independente
];

describe("groupAssignableMembers — elegibilidade e agrupamento (L1.7)", () => {
  it("por padrão só manager+consultant na equipe interna (alfabética)", () => {
    const g = groupAssignableMembers(SAMPLE, false);
    expect(g.internal.map((x) => x.name)).toEqual(["Ana", "Suellen"]);
    expect(g.hiddenCount).toBe(3); // director, concierge, administrative
  });

  it("showAll revela director/concierge/administrative na equipe interna", () => {
    const g = groupAssignableMembers(SAMPLE, true);
    expect(g.internal.map((x) => x.name)).toEqual(["Ana", "Bruno", "Carlos", "Rubiam", "Suellen"]);
    expect(g.hiddenCount).toBe(0);
  });

  it("corretores agrupados por imobiliária (alfabética), Independentes por último", () => {
    const g = groupAssignableMembers(SAMPLE, false);
    expect(g.brokerages.map((b) => b.brokerageName)).toEqual(["Alfa Imóveis", "Beta Corretora", "Independentes"]);
    expect(g.brokerages[0].brokers.map((x) => x.name)).toEqual(["Aline", "Ivo"]); // alfabética dentro do grupo
    expect(g.brokerages[2].brokers.map((x) => x.name)).toEqual(["Nina"]);
  });

  it("brokerageOptions começa com 'Todas' e lista as imobiliárias", () => {
    const opts = brokerageOptions(groupAssignableMembers(SAMPLE, false));
    expect(opts[0]).toEqual({ id: null, label: "Todas" });
    expect(opts.map((o) => o.label)).toEqual(["Todas", "Alfa Imóveis", "Beta Corretora", "Independentes"]);
  });

  it("director/concierge/administrative NUNCA entram como corretores", () => {
    const g = groupAssignableMembers(SAMPLE, true);
    const allBrokerNames = g.brokerages.flatMap((b) => b.brokers.map((x) => x.name));
    expect(allBrokerNames).not.toContain("Rubiam");
    expect(allBrokerNames).not.toContain("Carlos");
  });
});
