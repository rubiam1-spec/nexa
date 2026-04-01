export type WidgetId =
  | "unidades_status"
  | "vgv_breakdown"
  | "vgv_total"
  | "funil_operacional"
  | "negociacoes_ativas"
  | "propostas_abertas"
  | "reservas_ativas"
  | "velocidade_vendas"
  | "ranking_corretores"
  | "minhas_negociacoes"
  | "minha_comissao"
  | "minhas_reservas"
  | "alertas_operacionais"
  | "performance_time"
  | "atividade_recente"
  | "atividades_equipe";

export interface WidgetConfig {
  id: WidgetId;
  titulo: string;
  descricao: string;
  tamanho: "pequeno" | "medio" | "grande" | "largo";
  perfisPermitidos: string[];
  padraoAtivoPara: string[];
}

export const WIDGETS_DISPONIVEIS: WidgetConfig[] = [
  { id: "unidades_status", titulo: "Status das Unidades", descricao: "Visão geral das unidades por status", tamanho: "largo", perfisPermitidos: ["director", "manager", "commercial_consultant", "broker", "administrative"], padraoAtivoPara: ["director", "manager", "commercial_consultant", "broker"] },
  { id: "vgv_total", titulo: "VGV Total", descricao: "Valor geral de vendas do empreendimento", tamanho: "pequeno", perfisPermitidos: ["director", "manager", "administrative"], padraoAtivoPara: ["director", "manager"] },
  { id: "vgv_breakdown", titulo: "VGV por Status", descricao: "Distribuição do VGV entre disponível, reservado e vendido", tamanho: "medio", perfisPermitidos: ["director", "manager", "administrative"], padraoAtivoPara: ["director", "manager"] },
  { id: "funil_operacional", titulo: "Funil Operacional", descricao: "Evolução das negociações pelo funil comercial", tamanho: "medio", perfisPermitidos: ["director", "manager", "commercial_consultant"], padraoAtivoPara: ["director", "manager", "commercial_consultant"] },
  { id: "negociacoes_ativas", titulo: "Negociações Ativas", descricao: "Total de negociações em andamento", tamanho: "pequeno", perfisPermitidos: ["director", "manager", "commercial_consultant", "broker"], padraoAtivoPara: ["director", "manager", "commercial_consultant"] },
  { id: "propostas_abertas", titulo: "Propostas em Aberto", descricao: "Propostas aguardando análise ou resposta", tamanho: "pequeno", perfisPermitidos: ["director", "manager", "commercial_consultant"], padraoAtivoPara: ["director", "manager", "commercial_consultant"] },
  { id: "reservas_ativas", titulo: "Reservas Ativas", descricao: "Reservas vigentes com prazo de expiração", tamanho: "pequeno", perfisPermitidos: ["director", "manager", "commercial_consultant", "broker"], padraoAtivoPara: ["director", "manager", "commercial_consultant"] },
  { id: "velocidade_vendas", titulo: "Velocidade de Vendas", descricao: "Unidades vendidas e reservadas nos últimos 30 dias", tamanho: "medio", perfisPermitidos: ["director", "manager"], padraoAtivoPara: ["director", "manager"] },
  { id: "ranking_corretores", titulo: "Ranking de Corretores", descricao: "Corretores com mais negociações ativas", tamanho: "medio", perfisPermitidos: ["director", "manager"], padraoAtivoPara: ["director"] },
  { id: "alertas_operacionais", titulo: "Alertas Operacionais", descricao: "Reservas vencendo, propostas paradas, negociações sem movimento", tamanho: "medio", perfisPermitidos: ["director", "manager", "commercial_consultant"], padraoAtivoPara: ["director", "manager", "commercial_consultant"] },
  { id: "minhas_negociacoes", titulo: "Minhas Negociações", descricao: "Suas negociações ativas", tamanho: "medio", perfisPermitidos: ["commercial_consultant", "broker"], padraoAtivoPara: ["commercial_consultant", "broker"] },
  { id: "minha_comissao", titulo: "Minha Comissão Estimada", descricao: "Comissão estimada das suas negociações ativas", tamanho: "pequeno", perfisPermitidos: ["commercial_consultant", "broker"], padraoAtivoPara: ["commercial_consultant", "broker"] },
  { id: "minhas_reservas", titulo: "Minhas Reservas", descricao: "Reservas das suas negociações com prazo", tamanho: "pequeno", perfisPermitidos: ["commercial_consultant", "broker"], padraoAtivoPara: ["broker"] },
  { id: "performance_time", titulo: "Performance do Time", descricao: "Ranking de corretores por atividade", tamanho: "largo", perfisPermitidos: ["director", "manager"], padraoAtivoPara: ["director", "manager"] },
  { id: "atividade_recente", titulo: "Atividade Recente", descricao: "Últimas ações do time na operação", tamanho: "largo", perfisPermitidos: ["director", "manager"], padraoAtivoPara: ["director", "manager"] },
  { id: "atividades_equipe", titulo: "Atividades da Equipe", descricao: "Resumo de atividades (visitas, ligações, follow-ups)", tamanho: "medio", perfisPermitidos: ["director", "manager"], padraoAtivoPara: ["director", "manager"] },
];

// owner tem mesmas permissões de director para widgets
function effectiveRole(role: string): string { return role === "owner" ? "director" : role; }

export function getWidgetsPadrao(role: string): WidgetId[] {
  const r = effectiveRole(role);
  return WIDGETS_DISPONIVEIS.filter((w) => w.padraoAtivoPara.includes(r)).map((w) => w.id);
}

export function getWidgetsPermitidos(role: string): WidgetConfig[] {
  const r = effectiveRole(role);
  return WIDGETS_DISPONIVEIS.filter((w) => w.perfisPermitidos.includes(r));
}
