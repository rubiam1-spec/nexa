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
