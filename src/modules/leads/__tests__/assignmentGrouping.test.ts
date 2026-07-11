import { describe, it, expect } from "vitest";
import {
  groupAssignableMembers,
  brokerageOptions,
  brokerageSelectOptions,
  summarizePendingBrokers,
  pendingBrokersLabel,
  type AssignableMember,
} from "../assignmentGrouping";
import type { AssignableBrokerRow, BrokerageDirectoryEntry } from "../../../infra/repositories/clientsSupabaseRepository";

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

// ── L1.9 — dropdown completo (todas as imobiliárias) e rodapé informativo ──

const DIRECTORY: BrokerageDirectoryEntry[] = [
  { id: "b1", name: "Alfa Imóveis" },   // tem corretor com acesso (no SAMPLE)
  { id: "b2", name: "Beta Corretora" }, // tem corretor com acesso (no SAMPLE)
  { id: "b3", name: "Gama Negócios" },  // SEM corretor com acesso → desabilitada
  { id: "b4", name: "Delta Imob" },     // SEM corretor com acesso → desabilitada
];

describe("brokerageSelectOptions — dropdown que se explica (L1.9)", () => {
  it("lista TODAS as imobiliárias do diretório; sem corretor ativo vem desabilitada e rotulada", () => {
    const g = groupAssignableMembers(SAMPLE, false);
    const opts = brokerageSelectOptions(g, DIRECTORY);
    expect(opts[0]).toEqual({ id: null, label: "Todas", disabled: false });
    // b1/b2 têm corretor com acesso → selecionáveis; b3/b4 não → desabilitadas + sufixo.
    const alfa = opts.find((o) => o.id === "b1")!;
    const beta = opts.find((o) => o.id === "b2")!;
    const gama = opts.find((o) => o.id === "b3")!;
    const delta = opts.find((o) => o.id === "b4")!;
    expect(alfa).toEqual({ id: "b1", label: "Alfa Imóveis", disabled: false });
    expect(beta).toEqual({ id: "b2", label: "Beta Corretora", disabled: false });
    // Label limpo + motivo no hint (item desabilitado nunca é mudo).
    expect(gama).toEqual({ id: "b3", label: "Gama Negócios", disabled: true, hint: "sem corretores ativos" });
    expect(delta).toEqual({ id: "b4", label: "Delta Imob", disabled: true, hint: "sem corretores ativos" });
  });

  it("adiciona 'Independentes' (selecionável) por último quando há corretor independente com acesso", () => {
    const g = groupAssignableMembers(SAMPLE, false); // SAMPLE tem "Nina" independente
    const opts = brokerageSelectOptions(g, DIRECTORY);
    expect(opts[opts.length - 1]).toEqual({ id: "__independentes__", label: "Independentes", disabled: false });
  });

  it("ordem alfabética entre as imobiliárias (após 'Todas')", () => {
    const g = groupAssignableMembers(SAMPLE, false);
    const opts = brokerageSelectOptions(g, DIRECTORY).filter((o) => o.id !== null && o.id !== "__independentes__");
    expect(opts.map((o) => o.label.replace(" · sem corretores ativos", ""))).toEqual([
      "Alfa Imóveis", "Beta Corretora", "Delta Imob", "Gama Negócios",
    ]);
  });

  it("sem diretório e sem elegíveis: só 'Todas' (nada a filtrar)", () => {
    const g = groupAssignableMembers([], false);
    expect(brokerageSelectOptions(g, [])).toEqual([{ id: null, label: "Todas", disabled: false }]);
  });
});

describe("summarizePendingBrokers / pendingBrokersLabel — a verdade que faltava (L1.9)", () => {
  const rows = (over: Partial<AssignableBrokerRow>[]): AssignableBrokerRow[] =>
    over.map((o) => ({ profileId: o.profileId ?? null, brokerageId: o.brokerageId ?? null, status: o.status ?? "active" }));

  it("conta corretores ativos SEM profile e as imobiliárias distintas deles", () => {
    const s = summarizePendingBrokers(rows([
      { profileId: "p1", brokerageId: "b1" },              // com acesso → não conta
      { profileId: null, brokerageId: "b2" },              // sem acesso
      { profileId: null, brokerageId: "b2" },              // sem acesso (mesma imob)
      { profileId: null, brokerageId: "b3" },              // sem acesso (outra imob)
      { profileId: null, brokerageId: null },              // sem acesso, independente
      { profileId: null, brokerageId: "b4", status: "inactive" }, // inativo → não conta
    ]));
    expect(s).toEqual({ brokersWithoutAccess: 4, brokeragesWithPending: 2 });
  });

  it("rótulo pluraliza em pt-BR e some quando não há pendências", () => {
    expect(pendingBrokersLabel({ brokeragesWithPending: 0, brokersWithoutAccess: 0 })).toBeNull();
    expect(pendingBrokersLabel({ brokeragesWithPending: 1, brokersWithoutAccess: 1 }))
      .toBe("1 imobiliária · 1 corretor cadastrado ainda sem acesso");
    expect(pendingBrokersLabel({ brokeragesWithPending: 29, brokersWithoutAccess: 253 }))
      .toBe("29 imobiliárias · 253 corretores cadastrados ainda sem acesso");
  });

  it("só independentes pendentes: rótulo sem a parte de imobiliárias", () => {
    expect(pendingBrokersLabel({ brokeragesWithPending: 0, brokersWithoutAccess: 3 }))
      .toBe("3 corretores cadastrados ainda sem acesso");
  });
});
