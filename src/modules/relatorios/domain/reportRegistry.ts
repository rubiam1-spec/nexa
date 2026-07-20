// Registry declarativo dos relatórios — fonte ÚNICA da matriz role × escopo.
// Domínio PURO: zero React, zero IO. Cada escopo de um relatório declara a
// PermissionFlag que o habilita; a visibilidade é derivada de can() (que já
// resolve as 3 camadas de override). Nenhuma condição de role vive fora daqui.
import type { PermissionFlag } from "../../../shared/constants/permissionPresets";

export type ReportScope = "self" | "team" | "global";

// IDs canônicos — espelham o union `active` da página (sem o "menu").
export type ReportId =
  | "individual"
  | "vendas"
  | "equipeInterna"
  | "corretores"
  | "imobiliarias"
  | "estoque"
  | "negociacoes"
  | "contatos";

export type ReportDefinition = {
  id: ReportId;
  titulo: string;
  descricao: string;
  icone?: string; // chave semântica opcional; o mapeamento visual vive na UI
  // Cada escopo aponta a flag que o habilita. Um relatório é visível se
  // QUALQUER um dos seus escopos passar no can().
  scopes: Partial<Record<ReportScope, PermissionFlag>>;
};

// Ordem estável de exibição dos escopos (usada por allowedScopes).
const SCOPE_ORDER: readonly ReportScope[] = ["self", "team", "global"];

// Registro dos 8 relatórios. A ORDEM aqui é a ordem dos cards na página.
export const REPORT_REGISTRY: readonly ReportDefinition[] = [
  {
    id: "individual",
    titulo: "Relatório Individual",
    descricao: "Atividades e negócios por pessoa",
    icone: "clientes",
    scopes: { self: "can_view_reports", team: "can_view_team_ranking" },
  },
  {
    id: "vendas",
    titulo: "Relatório de Vendas",
    descricao: "VGV, funil e conversão por período",
    icone: "relatorios",
    scopes: { team: "can_view_team_ranking" },
  },
  {
    id: "equipeInterna",
    titulo: "Equipe Interna",
    descricao: "Consultoras, atividades e gestão",
    icone: "clientes",
    scopes: { team: "can_view_team_ranking" },
  },
  {
    id: "corretores",
    titulo: "Corretores",
    descricao: "Ranking, vendas e simulações",
    icone: "corretores",
    scopes: { team: "can_view_team_ranking" },
  },
  {
    id: "imobiliarias",
    titulo: "Imobiliárias",
    descricao: "Volume por imobiliária parceira",
    icone: "imobiliarias",
    scopes: { team: "can_view_team_ranking" },
  },
  {
    id: "estoque",
    titulo: "Estoque de Unidades",
    descricao: "Mapa de calor e quadras",
    icone: "estoque",
    // ÚNICA mudança de acesso da F2a: estoque é global (todo mundo com
    // can_view_reports vê — inclui a consultora).
    scopes: { global: "can_view_reports" },
  },
  {
    id: "negociacoes",
    titulo: "Negociações",
    descricao: "Funil, conversão, gargalos e paradas",
    icone: "relatorios",
    scopes: { team: "can_view_team_ranking" },
  },
  {
    id: "contatos",
    titulo: "Contatos",
    descricao: "Funil, origens, temperatura e performance",
    icone: "clientes",
    scopes: { team: "can_view_team_ranking" },
  },
];

type CanFn = (flag: PermissionFlag) => boolean;

// Relatórios visíveis: um relatório aparece se QUALQUER escopo dele passar no
// can(). Preserva a ordem do registry.
export function visibleReports(can: CanFn): ReportDefinition[] {
  return REPORT_REGISTRY.filter((r) =>
    (Object.values(r.scopes) as PermissionFlag[]).some((flag) => can(flag)),
  );
}

// Escopos permitidos de um relatório para o usuário atual, em ordem estável.
export function allowedScopes(reportId: ReportId, can: CanFn): ReportScope[] {
  const def = REPORT_REGISTRY.find((r) => r.id === reportId);
  if (!def) return [];
  return SCOPE_ORDER.filter((scope) => {
    const flag = def.scopes[scope];
    return flag !== undefined && can(flag);
  });
}
