// Registry declarativo dos issues de saúde do dado (check_unit_integrity).
// PURO e testável. Ordena por severidade; traduz rótulo + frase de ação PT-BR.
// `vendida_sem_venda_nem_won` é LEGADO — não entra na UI.
export type IntegrityIssueKind = "unit" | "negotiation";

export type IntegrityIssueDef = {
  id: string;
  label: string; // rótulo PT-BR (minúsculo, p/ compor "N <label> — <ação>")
  action: string; // frase de ação
  kind: IntegrityIssueKind; // unit = drill-down/foco; negotiation = "ver negociações →"
  severity: number; // menor = mais severo (ordem dos cards)
};

// Ordem = severidade (o placar principal primeiro).
export const INTEGRITY_ISSUES: readonly IntegrityIssueDef[] = [
  { id: "vendida_sem_registro_venda", label: "vendidas sem registro de venda", action: "registre pela Ficha", kind: "unit", severity: 1 },
  { id: "reservada_sem_reserva_ativa", label: "reservadas sem reserva ativa", action: "revise o status pela Ficha", kind: "unit", severity: 2 },
  { id: "disponivel_com_vinculo_vivo", label: "disponíveis com vínculo vivo", action: "revise o status pela Ficha", kind: "unit", severity: 3 },
  { id: "em_negociacao_sem_negociacao_viva", label: "em negociação sem negociação viva", action: "revise o status pela Ficha", kind: "unit", severity: 4 },
  { id: "unidades_com_multiplas_vivas", label: "com múltiplas vinculações vivas", action: "resolva o conflito pela Ficha", kind: "unit", severity: 5 },
  { id: "won_sem_unidade", label: "vendas sem unidade vinculada", action: "revise as negociações", kind: "negotiation", severity: 6 },
];

// IDs de issue que NUNCA aparecem na UI (legado).
export const INTEGRITY_IGNORED = new Set<string>(["vendida_sem_venda_nem_won"]);

export type IntegrityCard = {
  id: string;
  count: number;
  label: string;
  action: string;
  kind: IntegrityIssueKind;
};

// Cards visíveis: só issues conhecidos com contagem > 0, ordenados por severidade.
export function buildIntegrityCards(counters: Record<string, number> | null | undefined): IntegrityCard[] {
  if (!counters) return [];
  return INTEGRITY_ISSUES
    .filter((def) => !INTEGRITY_IGNORED.has(def.id) && (Number(counters[def.id]) || 0) > 0)
    .sort((a, b) => a.severity - b.severity)
    .map((def) => ({ id: def.id, count: Number(counters[def.id]) || 0, label: def.label, action: def.action, kind: def.kind }));
}

// Zero divergências entre os issues CONHECIDOS (ignora o legado).
export function isDataConsistent(counters: Record<string, number> | null | undefined): boolean {
  if (!counters) return false;
  return INTEGRITY_ISSUES.every((def) => (Number(counters[def.id]) || 0) === 0);
}
