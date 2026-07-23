/**
 * Equipe Comercial Interna — escopo de roles que entram no ranking de
 * produtividade do módulo /atividades.
 *
 * Brokers têm ranking próprio em /corretores. Administrative e concierge
 * não exercem atividade comercial direta.
 */

export const COMMERCIAL_INTERNAL_ROLES = [
  "owner",
  "director",
  "manager",
  "commercial_consultant",
] as const;

export type CommercialInternalRole = (typeof COMMERCIAL_INTERNAL_ROLES)[number];

export const NON_COMMERCIAL_ROLES = [
  "broker",
  "administrative",
  "concierge",
] as const;

export function isCommercialInternalRole(role: string | null | undefined): role is CommercialInternalRole {
  if (!role) return false;
  return (COMMERCIAL_INTERNAL_ROLES as readonly string[]).includes(role);
}

// Parte B · quem pode ALTERNAR o escopo (ver a Equipe): owner/director/manager.
// Contrato explícito (não "isManager && !admin" por acidente). Consultora e
// corretor ficam sempre no pessoal — alinhado com a RLS.
export const SCOPE_MANAGER_ROLES = ["owner", "director", "manager"] as const;

export function canManageScope(role: string | null | undefined): boolean {
  return !!role && (SCOPE_MANAGER_ROLES as readonly string[]).includes(role);
}

/** Escopo efetivo: default "mine" para TODOS; só quem gerencia alterna p/ "team". */
export function resolveScopeMode(role: string | null | undefined, viewMode: "mine" | "team"): "mine" | "team" {
  return canManageScope(role) ? viewMode : "mine";
}
