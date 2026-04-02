// Roles que têm permissão total (equivalente a director)
const ADMIN_ROLES = ["owner", "director"];

// Roles que têm permissão de gestão
const MANAGER_ROLES = ["owner", "director", "manager"];

// Roles que têm permissão de gestão + administrativo + concierge
const MANAGER_ADMIN_ROLES = ["owner", "director", "manager", "administrative", "concierge"];

function is(role: string | null, roles: string[]): boolean {
  return roles.includes(role ?? "");
}

export function podeVerTodasNegociacoes(role: string | null): boolean {
  return is(role, [...MANAGER_ROLES, "administrative"]);
}

export function podeAprovarReserva(role: string | null): boolean {
  return is(role, MANAGER_ROLES);
}

export function podeAcessarConfiguracoes(role: string | null): boolean {
  return is(role, ADMIN_ROLES);
}

export function podeVerVGV(role: string | null): boolean {
  return is(role, MANAGER_ADMIN_ROLES);
}

export function podeEditarMapa(role: string | null): boolean {
  return is(role, MANAGER_ROLES);
}

export function ehPerfilComercial(role: string | null): boolean {
  return is(role, ["commercial_consultant", "broker"]);
}

export function podeGerenciarEmpreendimentos(role: string | null): boolean {
  return is(role, MANAGER_ROLES);
}

export function podeGerenciarUsuarios(role: string | null): boolean {
  return is(role, MANAGER_ROLES);
}

export function podeConvidarUsuarios(role: string | null): boolean {
  return is(role, MANAGER_ROLES);
}

export type Permissions = ReturnType<typeof getPermissions>;

export function getPermissions(role: string | null) {
  const r = role ?? "";
  return {
    // Dashboard
    canViewFullDashboard: is(r, MANAGER_ROLES),
    canCustomizeDashboard: is(r, MANAGER_ROLES),

    // Negociações
    canCreateNegotiation: is(r, [...MANAGER_ROLES, "commercial_consultant", "broker"]),
    canEditNegotiation: is(r, [...MANAGER_ROLES, "commercial_consultant"]),
    canCreateProposal: is(r, [...MANAGER_ROLES, "commercial_consultant", "broker"]),
    canRequestReservation: is(r, [...MANAGER_ROLES, "commercial_consultant", "broker"]),

    // Ações críticas
    canApproveReservation: is(r, MANAGER_ROLES),
    canCancelReservation: is(r, MANAGER_ROLES),
    canCompleteSale: is(r, MANAGER_ROLES),
    canCancelSale: is(r, MANAGER_ROLES),

    // Fila
    canAlterQueuePriority: is(r, ADMIN_ROLES),

    // Corretores
    canManageBrokers: is(r, MANAGER_ROLES),
    canCreateBroker: is(r, [...MANAGER_ROLES, "commercial_consultant"]),
    canViewBrokers: is(r, [...MANAGER_ROLES, "commercial_consultant"]),

    // Dados estratégicos
    canViewUnitStatus: is(r, MANAGER_ROLES),
    canViewVGV: is(r, MANAGER_ROLES),

    // Usuários
    canManageUsers: is(r, MANAGER_ROLES),
    canAccessSettings: is(r, ADMIN_ROLES),
  };
}

export function podeVerItem(key: string, role: string | null): boolean {
  if (!role) return false;
  if (role === "broker") {
    const brokerAllowed = ["meudia", "dashboard", "simulador", "negociacoes", "pipeline", "clientes", "unidades", "materiais"];
    return brokerAllowed.includes(key);
  }
  if (role === "commercial_consultant") {
    const consultantAllowed = ["meudia", "dashboard", "simulador", "negociacoes", "pipeline", "clientes", "unidades", "corretores", "atividades", "materiais", "feed"];
    return consultantAllowed.includes(key);
  }
  if (role === "concierge") {
    const conciergeAllowed = ["meudia", "dashboard", "clientes", "corretores", "imobiliarias", "configuracoes"];
    return conciergeAllowed.includes(key);
  }
  if (role === "administrative") {
    // Administrative tem acesso a tudo EXCETO gerenciamento de usuários
    if (key === "usuarios") return false;
    return true;
  }
  switch (key) {
    case "configuracoes": return podeAcessarConfiguracoes(role);
    case "empreendimentos": return podeGerenciarEmpreendimentos(role);
    case "usuarios": return podeGerenciarUsuarios(role);
    case "imobiliarias": return is(role, MANAGER_ADMIN_ROLES);
    default: return true;
  }
}
