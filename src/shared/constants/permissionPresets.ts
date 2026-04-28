// ============================================
// NEXA — Permission presets por perfil
// ============================================
// Fonte de verdade das permissoes por role. Nenhum componente React
// deve ter regra de permissao hardcoded — sempre consultar via
// usePermissions() (que encapsula resolvePermission / resolveAllPermissions).
//
// Camadas (mais fraca para mais forte):
//   1. Preset do role (este arquivo)
//   2. (futuro) Configuracao por conta em account_settings / development_settings
//   3. Override individual em user_account_access.permission_overrides
//
// Regras invioláveis permanecem no RLS do banco — overrides nao contornam:
//   - Broker so ve dados proprios
//   - Isolamento multi-tenant por account_id
//   - Administrative sempre ve propostas e documentos
//   - Cadeia de aprovacao sequencial (proposta -> docs -> contrato)
// ============================================

export type PermissionFlag =
  | "can_view_dashboard"
  | "can_view_all_negotiations"
  | "can_view_own_negotiations"
  | "can_view_reports"
  | "can_view_team_ranking"
  | "can_create_negotiation"
  | "can_create_proposal"
  | "can_create_counterproposal"
  | "can_request_reservation"
  | "can_approve_proposal"
  | "can_approve_reservation"
  | "can_complete_sale"
  | "can_cancel_sale"
  | "can_approve_documents"
  | "can_upload_documents"
  | "can_download_package"
  | "can_manage_settings"
  | "can_invite_users"
  | "can_manage_lead_distribution"
  /** @deprecated Substituída por can_create_social_post. Remover após Sprint 1 Fase 3C (migração do FeedPage). */
  | "can_create_feed_post"
  | "can_intervene_queue"
  | "can_receive_briefing"
  | "can_resolve_alerts"
  | "can_simulate"
  | "can_generate_pdf"
  | "can_register_activity"
  | "can_edit_any_activity"
  | "can_manage_brokers"
  | "can_manage_brokerages"
  | "can_manage_properties"
  // Category: social (NEXA Social v1 — Sprint 1 Fase 3B)
  | "can_create_social_post"
  | "can_moderate_social"
  | "can_interact_social";

export type PermissionPreset = Record<PermissionFlag, boolean>;
export type PermissionOverrides = Partial<Record<PermissionFlag, boolean>>;

/**
 * Overrides por role/categoria — vivem em account_settings.role_permission_overrides.
 * Estrutura: { broker: { can_create_negotiation: true }, commercial_consultant: { ... } }.
 * Afetam todos os usuarios do role na conta, mas sao sobrescritos por overrides individuais.
 */
export type RolePermissionOverrides = Partial<Record<string, PermissionOverrides>>;

export type PermissionCategory =
  | "vision"
  | "action"
  | "approval"
  | "destructive"
  | "admin"
  | "social";

export interface PermissionMeta {
  flag: PermissionFlag;
  label: string;
  description: string;
  category: PermissionCategory;
}

// Ordem aqui = ordem exibida na UI dentro de cada categoria.
export const PERMISSION_META: PermissionMeta[] = [
  { flag: "can_view_dashboard", label: "Dashboard gerencial", description: "Ver dashboard gerencial completo com KPIs de toda a operacao", category: "vision" },
  { flag: "can_view_all_negotiations", label: "Todas as negociacoes", description: "Ver negociacoes de todos os membros da equipe", category: "vision" },
  { flag: "can_view_own_negotiations", label: "Ver minhas negociações", description: "Ver apenas as negociações atribuídas a mim", category: "vision" },
  { flag: "can_view_reports", label: "Relatorios", description: "Acessar relatorios da operacao", category: "vision" },
  { flag: "can_view_team_ranking", label: "Ranking da equipe", description: "Ver ranking e performance da equipe", category: "vision" },
  { flag: "can_receive_briefing", label: "Briefing diario", description: "Receber briefing diario de inteligencia por email", category: "vision" },

  { flag: "can_create_negotiation", label: "Criar negociacao", description: "Criar novas negociacoes comerciais", category: "action" },
  { flag: "can_create_proposal", label: "Criar proposta", description: "Criar propostas comerciais vinculadas a negociacoes", category: "action" },
  { flag: "can_create_counterproposal", label: "Contraproposta", description: "Criar contrapropostas comerciais", category: "action" },
  { flag: "can_request_reservation", label: "Solicitar reserva", description: "Solicitar reserva de unidade", category: "action" },
  { flag: "can_upload_documents", label: "Upload de documentos", description: "Fazer upload de documentos de clientes", category: "action" },
  { flag: "can_download_package", label: "Baixar pacote", description: "Baixar pacote ZIP de documentos do cliente", category: "action" },
  // @deprecated — substituída por can_create_social_post. Remover após Sprint 1 Fase 3C.
  { flag: "can_create_feed_post", label: "Criar post no feed (legado)", description: "[DEPRECATED] Criar publicacoes no feed legado — substituída por can_create_social_post", category: "action" },
  { flag: "can_resolve_alerts", label: "Resolver alertas", description: "Resolver alertas de inteligencia operacional", category: "action" },
  { flag: "can_simulate", label: "Simulador", description: "Acessar simulador comercial e gerar simulacoes", category: "action" },
  { flag: "can_generate_pdf", label: "Gerar PDF", description: "Gerar PDF de simulacao ou proposta comercial", category: "action" },
  { flag: "can_register_activity", label: "Registrar atividade", description: "Registrar atividades como visitas, ligacoes e follow-ups", category: "action" },
  { flag: "can_manage_brokers", label: "Gerenciar corretores", description: "Cadastrar e editar corretores", category: "action" },
  { flag: "can_manage_brokerages", label: "Gerenciar imobiliárias", description: "Cadastrar e editar imobiliárias parceiras", category: "action" },
  { flag: "can_manage_properties", label: "Gerenciar imoveis", description: "Cadastrar e editar imoveis de terceiros", category: "action" },

  { flag: "can_approve_proposal", label: "Aprovar proposta", description: "Aprovar ou recusar propostas comerciais", category: "approval" },
  { flag: "can_approve_reservation", label: "Aprovar reserva", description: "Aprovar ou recusar reservas de unidade", category: "approval" },
  { flag: "can_approve_documents", label: "Aprovar documentos", description: "Aprovar ou rejeitar documentos de clientes no checklist", category: "approval" },
  { flag: "can_complete_sale", label: "Completar venda", description: "Registrar conclusao de venda", category: "approval" },

  { flag: "can_cancel_sale", label: "Cancelar venda", description: "Cancelar venda ativa (acao destrutiva com cascata)", category: "destructive" },
  { flag: "can_intervene_queue", label: "Intervir na fila", description: "Alterar posicoes e prioridades na fila de unidades", category: "destructive" },

  { flag: "can_manage_settings", label: "Configuracoes", description: "Acessar e alterar configuracoes do sistema", category: "admin" },
  { flag: "can_invite_users", label: "Convidar usuarios", description: "Convidar novos usuarios para a conta", category: "admin" },
  { flag: "can_manage_lead_distribution", label: "Distribuicao de leads", description: "Configurar distribuicao automatica de leads", category: "admin" },
  { flag: "can_edit_any_activity", label: "Editar qualquer atividade", description: "Editar ou deletar atividades registradas por qualquer membro", category: "admin" },

  // Category: social (NEXA Social v1 — Timeline da equipe)
  { flag: "can_create_social_post", label: "Publicar no Mural", description: "Publicar posts livres no Mural do Time (Social v1)", category: "social" },
  { flag: "can_moderate_social", label: "Moderar Mural", description: "Ocultar ou desocultar posts de outros membros no Mural", category: "social" },
  { flag: "can_interact_social", label: "Interagir no Mural", description: "Comentar, reagir, mencionar e salvar posts no Mural", category: "social" },
];

export const CATEGORY_LABELS: Record<PermissionCategory, { label: string; color: string }> = {
  vision: { label: "Visão", color: "#4ADE80" },
  action: { label: "Ação", color: "#60A5FA" },
  approval: { label: "Aprovação", color: "#D97706" },
  destructive: { label: "Destrutiva", color: "#F87171" },
  admin: { label: "Administração", color: "#A78BFA" },
  social: { label: "Social", color: "#FBBF24" },
};

// Ajuda na UI: lista ordenada de categorias.
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  "vision",
  "action",
  "approval",
  "destructive",
  "admin",
  "social",
];

// ============================================
// Presets
// ============================================

const ALL_TRUE: PermissionPreset = {
  can_view_dashboard: true,
  can_view_all_negotiations: true,
  can_view_own_negotiations: true,
  can_view_reports: true,
  can_view_team_ranking: true,
  can_create_negotiation: true,
  can_create_proposal: true,
  can_create_counterproposal: true,
  can_request_reservation: true,
  can_approve_proposal: true,
  can_approve_reservation: true,
  can_complete_sale: true,
  can_cancel_sale: true,
  can_approve_documents: true,
  can_upload_documents: true,
  can_download_package: true,
  can_manage_settings: true,
  can_invite_users: true,
  can_manage_lead_distribution: true,
  can_create_feed_post: true,
  can_intervene_queue: true,
  can_receive_briefing: true,
  can_resolve_alerts: true,
  can_simulate: true,
  can_generate_pdf: true,
  can_register_activity: true,
  can_edit_any_activity: true,
  can_manage_brokers: true,
  can_manage_brokerages: true,
  can_manage_properties: true,
  // Category: social
  can_create_social_post: true,
  can_moderate_social: true,
  can_interact_social: true,
};

const ALL_FALSE: PermissionPreset = {
  can_view_dashboard: false,
  can_view_all_negotiations: false,
  can_view_own_negotiations: false,
  can_view_reports: false,
  can_view_team_ranking: false,
  can_create_negotiation: false,
  can_create_proposal: false,
  can_create_counterproposal: false,
  can_request_reservation: false,
  can_approve_proposal: false,
  can_approve_reservation: false,
  can_complete_sale: false,
  can_cancel_sale: false,
  can_approve_documents: false,
  can_upload_documents: false,
  can_download_package: false,
  can_manage_settings: false,
  can_invite_users: false,
  can_manage_lead_distribution: false,
  can_create_feed_post: false,
  can_intervene_queue: false,
  can_receive_briefing: false,
  can_resolve_alerts: false,
  can_simulate: false,
  can_generate_pdf: false,
  can_register_activity: false,
  can_edit_any_activity: false,
  can_manage_brokers: false,
  can_manage_brokerages: false,
  can_manage_properties: false,
  // Category: social
  can_create_social_post: false,
  can_moderate_social: false,
  can_interact_social: false,
};

export const PERMISSION_PRESETS: Record<string, PermissionPreset> = {
  owner: { ...ALL_TRUE },

  director: {
    ...ALL_TRUE,
    // Owner mantem o convite como privilegio; director pode ser habilitado
    // explicitamente via override quando necessario.
    can_invite_users: false,
  },

  manager: {
    ...ALL_TRUE,
    can_complete_sale: false,
    can_cancel_sale: false,
    can_intervene_queue: false,
    can_manage_settings: false,
    can_invite_users: false,
  },

  commercial_consultant: {
    ...ALL_FALSE,
    can_view_own_negotiations: true,
    can_view_reports: true,
    can_create_negotiation: true,
    can_create_proposal: true,
    can_create_counterproposal: false,
    can_request_reservation: true,
    can_upload_documents: true,
    can_create_feed_post: true,
    can_simulate: true,
    can_generate_pdf: true,
    can_register_activity: true,
    // Preserva direito legado: consultant podia criar corretor via
    // canCreateBroker=true no permissoes.ts. Imobiliária nunca teve
    // permissão prévia — fica false para não inventar direito novo.
    can_manage_brokers: true,
    // Social: participa, não modera.
    can_create_social_post: true,
    can_interact_social: true,
  },

  broker: {
    ...ALL_FALSE,
    can_view_own_negotiations: true,
    can_create_negotiation: false,
    can_create_proposal: true,
    can_request_reservation: true,
    can_upload_documents: true,
    can_simulate: true,
    can_generate_pdf: true,
    can_register_activity: true,
    // Social: participa, não modera.
    can_create_social_post: true,
    can_interact_social: true,
  },

  administrative: {
    ...ALL_FALSE,
    // Administrative SEMPRE acessa documentos/propostas — regra inviolavel
    // reforcada no RLS; aqui refletimos em nivel de UI.
    can_approve_documents: true,
    can_upload_documents: true,
    can_download_package: true,
    can_view_all_negotiations: true,
    // Social: participa, não modera.
    can_create_social_post: true,
    can_interact_social: true,
  },

  concierge: {
    ...ALL_FALSE,
    can_manage_properties: true,
    can_register_activity: true,
    // Concierge cuida da base de parceiros externos: cadastra corretores
    // e imobiliárias (234 corretores e 49 imobiliárias cadastrados pela
    // Gabrielly antes do sistema 3-camadas).
    can_manage_brokers: true,
    can_manage_brokerages: true,
    // Social: participa, não modera.
    can_create_social_post: true,
    can_interact_social: true,
  },
};

// ============================================
// Resolvers
// ============================================

/**
 * Resolve a permissao efetiva para uma flag em 3 camadas, da mais forte para a mais fraca:
 *   1. Override individual (user_account_access.permission_overrides)
 *   2. Override por role na conta (account_settings.role_permission_overrides[role])
 *   3. Preset do sistema (PERMISSION_PRESETS[role])
 *
 * Nao usar em JSX; prefira o hook usePermissions().
 */
export function resolvePermission(
  flag: PermissionFlag,
  role: string | null | undefined,
  individualOverrides?: PermissionOverrides | null,
  roleOverrides?: PermissionOverrides | null,
): boolean {
  if (individualOverrides && Object.prototype.hasOwnProperty.call(individualOverrides, flag)) {
    const v = individualOverrides[flag];
    if (typeof v === "boolean") return v;
  }
  if (roleOverrides && Object.prototype.hasOwnProperty.call(roleOverrides, flag)) {
    const v = roleOverrides[flag];
    if (typeof v === "boolean") return v;
  }
  const preset = role ? PERMISSION_PRESETS[role] : undefined;
  if (!preset) return false;
  return preset[flag] ?? false;
}

/** Resolve todas as flags aplicando as 3 camadas. */
export function resolveAllPermissions(
  role: string | null | undefined,
  individualOverrides?: PermissionOverrides | null,
  roleOverrides?: PermissionOverrides | null,
): PermissionPreset {
  const preset = (role && PERMISSION_PRESETS[role]) || ALL_FALSE;
  return {
    ...preset,
    ...(roleOverrides ?? {}),
    ...(individualOverrides ?? {}),
  } as PermissionPreset;
}

/**
 * Resolve o baseline (preset + role override) sem o override individual.
 * Util na UI individual para mostrar qual e o "padrao atual" herdado da
 * categoria antes da personalizacao pessoal.
 */
export function resolveBaselinePermissions(
  role: string | null | undefined,
  roleOverrides?: PermissionOverrides | null,
): PermissionPreset {
  return resolveAllPermissions(role, null, roleOverrides);
}

/**
 * Normaliza um JSON parcial vindo do banco, descartando chaves
 * desconhecidas e valores nao-booleanos.
 */
export function sanitizeOverrides(
  raw: unknown,
): PermissionOverrides | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const valid = new Set<string>(PERMISSION_META.map((m) => m.flag));
  const out: PermissionOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!valid.has(k)) continue;
    if (typeof v !== "boolean") continue;
    out[k as PermissionFlag] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Dado um preset do role e um conjunto de flags desejadas, retorna apenas
 * as flags que DIVERGEM do preset. Usado ao gravar overrides de categoria
 * (evita persistir informacao redundante).
 */
export function diffFromPreset(
  role: string | null | undefined,
  desired: PermissionOverrides,
): PermissionOverrides | null {
  const preset = (role && PERMISSION_PRESETS[role]) || ALL_FALSE;
  const out: PermissionOverrides = {};
  for (const [k, v] of Object.entries(desired) as [PermissionFlag, boolean][]) {
    if (typeof v !== "boolean") continue;
    if (preset[k] !== v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Igual a diffFromPreset, mas usa um baseline customizado (preset + role
 * override) como referencia. Usado ao gravar o override INDIVIDUAL para
 * que so persista o que diverge do que o usuario ja receberia via role.
 */
export function diffFromBaseline(
  role: string | null | undefined,
  roleOverrides: PermissionOverrides | null | undefined,
  desired: PermissionOverrides,
): PermissionOverrides | null {
  const baseline = resolveBaselinePermissions(role, roleOverrides ?? null);
  const out: PermissionOverrides = {};
  for (const [k, v] of Object.entries(desired) as [PermissionFlag, boolean][]) {
    if (typeof v !== "boolean") continue;
    if (baseline[k] !== v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Normaliza o shape completo de role_permission_overrides (Record<role, overrides>)
 * validando cada sub-objeto via sanitizeOverrides. Descarta chaves invalidas e
 * retorna null se nada restar.
 */
export function sanitizeRoleOverrides(raw: unknown): RolePermissionOverrides | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const validRoles = new Set(Object.keys(PERMISSION_PRESETS));
  const out: RolePermissionOverrides = {};
  for (const [role, sub] of Object.entries(raw as Record<string, unknown>)) {
    if (!validRoles.has(role)) continue;
    const cleaned = sanitizeOverrides(sub);
    if (cleaned) out[role] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : null;
}
