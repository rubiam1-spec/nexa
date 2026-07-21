// Navigation Registry — fonte ÚNICA da navegação (desktop E mobile).
// Domínio PURO: zero React, zero IO. Espelha o padrão do reportRegistry.
// O gating (permissionFlags) é EXATAMENTE o que o AppSidebar usava antes
// (Fase 0 — colado verbatim); a visibilidade deriva de can().
// Regra: [] = sempre visível (o RLS do banco filtra os DADOS); várias flags = OR.
import type { PermissionFlag } from "../constants/permissionPresets";

export type NavSection = "operacao" | "comercial" | "gestao" | "sistema";

export type NavModule = {
  id: string;
  label: string; // SEM abreviação (mesmo texto no desktop e no mobile)
  icone: string; // chave semântica; o mapeamento visual (SVG) vive em navIcons
  secao: NavSection;
  rota: string;
  permissionFlags: PermissionFlag[]; // OR; [] = sempre visível
  mobilePrimary?: number; // posição na tab bar (1..n); ausente = só no "Mais"
};

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  operacao: "Operação",
  comercial: "Comercial",
  gestao: "Gestão",
  sistema: "Sistema",
};

export const NAV_SECTION_ORDER: readonly NavSection[] = ["operacao", "comercial", "gestao", "sistema"];

// A ORDEM aqui é a ordem de exibição (desktop e sheet).
export const NAV_REGISTRY: readonly NavModule[] = [
  // ── Operação ──
  { id: "central", label: "Central", icone: "meudia", secao: "operacao", rota: "/", permissionFlags: [], mobilePrimary: 1 },
  { id: "simulador", label: "Simulador", icone: "simulador", secao: "operacao", rota: "/simulador", permissionFlags: ["can_simulate"] },
  { id: "unidades", label: "Unidades", icone: "unidades", secao: "operacao", rota: "/unidades", permissionFlags: [] },
  { id: "imoveis", label: "Imóveis", icone: "imoveis", secao: "operacao", rota: "/imoveis", permissionFlags: ["can_manage_properties", "can_view_dashboard"] },
  // ── Comercial ──
  { id: "leads", label: "Leads", icone: "leads", secao: "comercial", rota: "/leads", permissionFlags: [], mobilePrimary: 3 },
  { id: "negociacoes", label: "Negociações", icone: "negociacoes", secao: "comercial", rota: "/negociacoes", permissionFlags: ["can_view_all_negotiations", "can_view_own_negotiations"], mobilePrimary: 2 },
  { id: "contatos", label: "Contatos", icone: "contatos", secao: "comercial", rota: "/contatos", permissionFlags: [] },
  { id: "corretores", label: "Corretores", icone: "corretores", secao: "comercial", rota: "/corretores", permissionFlags: ["can_manage_brokers"] },
  { id: "imobiliarias", label: "Imobiliárias", icone: "imobiliarias", secao: "comercial", rota: "/imobiliarias", permissionFlags: ["can_manage_brokerages"] },
  // ── Gestão ──
  { id: "atividades", label: "Atividades", icone: "atividades", secao: "gestao", rota: "/atividades", permissionFlags: ["can_register_activity", "can_edit_any_activity"] },
  { id: "feed", label: "Feed", icone: "feed", secao: "gestao", rota: "/feed", permissionFlags: [] },
  { id: "relatorios", label: "Relatórios", icone: "relatorios", secao: "gestao", rota: "/relatorios", permissionFlags: ["can_view_reports", "can_view_dashboard"] },
  { id: "materiais", label: "Materiais", icone: "materiais", secao: "gestao", rota: "/materiais", permissionFlags: [] },
  { id: "relacionamento", label: "Relacionamento", icone: "relacionamento", secao: "gestao", rota: "/relacionamento", permissionFlags: [] },
  // ── Sistema ──
  { id: "empreendimentos", label: "Empreendimentos", icone: "empreendimentos", secao: "sistema", rota: "/empreendimentos", permissionFlags: ["can_manage_settings"] },
  { id: "usuarios", label: "Usuários", icone: "usuarios", secao: "sistema", rota: "/usuarios", permissionFlags: ["can_invite_users", "can_manage_settings"] },
  { id: "configuracoes", label: "Configurações", icone: "configuracoes", secao: "sistema", rota: "/configuracoes", permissionFlags: ["can_manage_settings"] },
];

type CanFn = (flag: PermissionFlag) => boolean;

export function isModuleVisible(mod: NavModule, can: CanFn): boolean {
  if (mod.permissionFlags.length === 0) return true; // RLS filtra os dados
  return mod.permissionFlags.some((f) => can(f));
}

// Todos os módulos visíveis ao usuário, na ordem do registry.
export function visibleModules(can: CanFn): NavModule[] {
  return NAV_REGISTRY.filter((m) => isModuleVisible(m, can));
}

// Agrupados por seção (desktop + sheet), preservando a ordem e omitindo seções vazias.
export function visibleModulesBySection(can: CanFn): { secao: NavSection; label: string; modules: NavModule[] }[] {
  const vis = visibleModules(can);
  return NAV_SECTION_ORDER.map((secao) => ({
    secao,
    label: NAV_SECTION_LABELS[secao],
    modules: vis.filter((m) => m.secao === secao),
  })).filter((g) => g.modules.length > 0);
}

// Tab bar: os mobilePrimary visíveis, ordenados. A aba fixa "Mais" é adicionada na UI.
export function mobilePrimaryModules(can: CanFn): NavModule[] {
  return visibleModules(can)
    .filter((m) => m.mobilePrimary !== undefined)
    .sort((a, b) => (a.mobilePrimary as number) - (b.mobilePrimary as number));
}

// ── Paridade desktop × mobile (invariante testável) ──
// O desktop mostra `visibleModules`; o mobile expõe os MESMOS módulos: os
// mobilePrimary na tab bar + TODOS os visíveis no sheet. Logo a cobertura mobile
// é idêntica à do desktop por construção — nenhum módulo permitido some no mobile.
export function desktopVisibleIds(can: CanFn): string[] {
  return visibleModules(can).map((m) => m.id);
}

export function mobileReachableIds(can: CanFn): string[] {
  // Sheet cobre todos os visíveis (a tab bar é subconjunto). Fonte única.
  return visibleModules(can).map((m) => m.id);
}
