// L1.7 — Elegibilidade e AGRUPAMENTO do modal "Atribuir lead". PURO e testável
// (fora do .tsx). Decisão de produto (Rubiam, 2026-07-10):
//   RECEBEM lead por padrão: equipe comercial interna (manager, commercial_consultant)
//   e corretores (broker). Concierge/administrative/director distribuem/gerem —
//   NÃO aparecem por padrão; um "mostrar todos os papéis" os revela para exceções.
// "Corretores" = brokers com profile (identidade atribuível); agrupados por
// imobiliária, com "Independentes" para quem não tem vínculo.
import type {
  AssignableMember,
  AssignableBrokerRow,
  BrokerageDirectoryEntry,
} from "../../infra/repositories/clientsSupabaseRepository";

export type { AssignableMember, BrokerageDirectoryEntry };

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

// ── L1.9 — O dropdown que se explica ────────────────────────────────
// O sistema está certo (elegível = corretor com acesso), mas o dropdown "vazio"
// não contava a história. Agora ele lista TODAS as imobiliárias da conta: as que
// têm corretor ativo são selecionáveis; as demais aparecem desabilitadas com o
// sufixo "· sem corretores ativos". A elegibilidade NÃO muda — só a visibilidade.

const PENDING_SUFFIX = "· sem corretores ativos";

export type BrokerageSelectOption = { id: string | null; label: string; disabled: boolean };

/**
 * Opções do seletor a partir do DIRETÓRIO completo (todas as imobiliárias) e dos
 * grupos elegíveis (L1.7). Uma imobiliária é selecionável só quando tem ao menos
 * um corretor com acesso; senão vem desabilitada e rotulada. "Todas" e
 * "Independentes" (quando há corretores independentes com acesso) são sempre
 * selecionáveis. Alfabética; "Independentes" por último.
 */
export function brokerageSelectOptions(
  grouped: GroupedMembers,
  directory: BrokerageDirectoryEntry[],
): BrokerageSelectOption[] {
  const activeIds = new Set(
    grouped.brokerages
      .filter((g) => g.brokerageId !== null && g.brokers.length > 0)
      .map((g) => g.brokerageId as string),
  );
  const hasIndependentes = grouped.brokerages.some((g) => g.brokerageId === null && g.brokers.length > 0);

  // Diretório é a fonte da lista; garante que imobiliárias com corretor ativo
  // apareçam mesmo se o diretório divergir (defensivo contra drift de dados).
  const nameById = new Map<string, string>();
  for (const d of directory) nameById.set(d.id, d.name);
  for (const g of grouped.brokerages) {
    if (g.brokerageId && !nameById.has(g.brokerageId)) nameById.set(g.brokerageId, g.brokerageName);
  }

  const brokerageOpts: BrokerageSelectOption[] = [...nameById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(({ id, name }) => {
      const active = activeIds.has(id);
      return { id, label: active ? name : `${name} ${PENDING_SUFFIX}`, disabled: !active };
    });

  const opts: BrokerageSelectOption[] = [{ id: null, label: "Todas", disabled: false }, ...brokerageOpts];
  if (hasIndependentes) opts.push({ id: INDEP_KEY, label: "Independentes", disabled: false });
  return opts;
}

export type PendingBrokersSummary = { brokeragesWithPending: number; brokersWithoutAccess: number };

/**
 * Conta os corretores CADASTRADOS ativos ainda SEM acesso (sem profile) e em
 * quantas imobiliárias distintas eles estão. Base do rodapé informativo do modal.
 */
export function summarizePendingBrokers(rows: AssignableBrokerRow[]): PendingBrokersSummary {
  const pending = rows.filter((r) => r.status !== "inactive" && !r.profileId);
  const brokerageIds = new Set(
    pending.map((r) => r.brokerageId).filter((x): x is string => !!x),
  );
  return { brokersWithoutAccess: pending.length, brokeragesWithPending: brokerageIds.size };
}

/**
 * Rótulo do rodapé "N imobiliárias · M corretores cadastrados ainda sem acesso".
 * Retorna null quando não há pendências (nada a explicar). Pluralização em pt-BR.
 */
export function pendingBrokersLabel(s: PendingBrokersSummary): string | null {
  if (s.brokersWithoutAccess <= 0) return null;
  const corr = `${s.brokersWithoutAccess} corretor${s.brokersWithoutAccess === 1 ? "" : "es"} cadastrado${s.brokersWithoutAccess === 1 ? "" : "s"} ainda sem acesso`;
  if (s.brokeragesWithPending <= 0) return corr;
  const imob = `${s.brokeragesWithPending} imobiliária${s.brokeragesWithPending === 1 ? "" : "s"}`;
  return `${imob} · ${corr}`;
}
