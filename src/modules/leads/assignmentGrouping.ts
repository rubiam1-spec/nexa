// L1.7 — Elegibilidade e AGRUPAMENTO do modal "Atribuir lead". PURO e testável
// (fora do .tsx). Decisão de produto (Rubiam, 2026-07-10):
//   RECEBEM lead por padrão: equipe comercial interna (manager, commercial_consultant)
//   e corretores (broker). Concierge/administrative/director distribuem/gerem —
//   NÃO aparecem por padrão; um "mostrar todos os papéis" os revela para exceções.
// "Corretores" = brokers com profile (identidade atribuível); agrupados por
// imobiliária, com "Independentes" para quem não tem vínculo.
import type { AssignableMember } from "../../infra/repositories/clientsSupabaseRepository";

export type { AssignableMember };

/** Equipe interna comercial visível por padrão. */
export const INTERNAL_DEFAULT_ROLES = ["manager", "commercial_consultant"] as const;
/** Papéis internos que só aparecem com "mostrar todos" (gerem/distribuem, não atendem). */
export const INTERNAL_EXTRA_ROLES = ["director", "concierge", "administrative"] as const;
export const BROKER_ROLE = "broker";

export type BrokerageGroup = {
  brokerageId: string | null;
  brokerageName: string;
  brokers: AssignableMember[];
};

export type GroupedMembers = {
  internal: AssignableMember[];
  brokerages: BrokerageGroup[];
  /** Nº de membros internos ocultos (papéis extra) quando showAll=false. */
  hiddenCount: number;
};

const byName = (a: AssignableMember, b: AssignableMember) => a.name.localeCompare(b.name, "pt-BR");
const INDEP_KEY = "__independentes__";

export function groupAssignableMembers(members: AssignableMember[], showAll: boolean): GroupedMembers {
  const internalRoles: string[] = showAll
    ? [...INTERNAL_DEFAULT_ROLES, ...INTERNAL_EXTRA_ROLES]
    : [...INTERNAL_DEFAULT_ROLES];

  const internal = members.filter((m) => internalRoles.includes(m.role)).sort(byName);

  const map = new Map<string, BrokerageGroup>();
  for (const b of members.filter((m) => m.role === BROKER_ROLE)) {
    const key = b.brokerageId ?? INDEP_KEY;
    const name = b.brokerageId ? (b.brokerageName ?? "Imobiliária") : "Independentes";
    if (!map.has(key)) map.set(key, { brokerageId: b.brokerageId, brokerageName: name, brokers: [] });
    map.get(key)!.brokers.push(b);
  }
  const brokerages = [...map.values()]
    .map((g) => ({ ...g, brokers: g.brokers.sort(byName) }))
    // Imobiliárias em ordem alfabética; "Independentes" sempre por último.
    .sort((a, b) => {
      if (a.brokerageId === null) return 1;
      if (b.brokerageId === null) return -1;
      return a.brokerageName.localeCompare(b.brokerageName, "pt-BR");
    });

  const hiddenCount = showAll
    ? 0
    : members.filter((m) => (INTERNAL_EXTRA_ROLES as readonly string[]).includes(m.role)).length;

  return { internal, brokerages, hiddenCount };
}

/** Opções do seletor de imobiliária (dropdown do grupo Corretores). "Todas" = null. */
export function brokerageOptions(grouped: GroupedMembers): { id: string | null; label: string }[] {
  return [
    { id: null, label: "Todas" },
    ...grouped.brokerages.map((g) => ({ id: g.brokerageId ?? INDEP_KEY, label: g.brokerageName })),
  ];
}
