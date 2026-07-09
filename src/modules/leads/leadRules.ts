// Regras PURAS de Leads L1 (permissões + resolução de dono na conversão).
// Fora da UI, testável. Papéis vêm de account.role (mesmo padrão do resto do app).
import type { Client } from "../../shared/types/client";

// Podem ATRIBUIR leads (decisão de produto).
const LEAD_ASSIGN_ROLES = ["owner", "director", "manager", "concierge"];

export function canAssignLeads(role: string | null | undefined): boolean {
  return LEAD_ASSIGN_ROLES.includes(role ?? "");
}

/** Broker só enxerga leads atribuídos a ele; os demais papéis veem todos. */
export function canViewAllLeads(role: string | null | undefined): boolean {
  return (role ?? "") !== "broker";
}

/**
 * Pode atender/qualificar/descartar/converter: o ATRIBUÍDO ao lead OU um papel
 * que também pode atribuir (concierge/manager/director/owner).
 */
export function canWorkLead(role: string | null | undefined, isAssignee: boolean): boolean {
  return isAssignee || canAssignLeads(role);
}

/**
 * Dono da negociação ao CONVERTER: o atribuído ao lead; fallback = quem converte.
 * (owner = atribuído, senão o profile atual.)
 */
export function resolveConvertOwner(
  lead: Pick<Client, "assignedTo">,
  currentProfileId: string | null,
): string | null {
  return lead.assignedTo ?? currentProfileId;
}
