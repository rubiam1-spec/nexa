import type { UserRole } from "./auth";

export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  switch (role) {
    case null:
    case undefined:
      return null;
    case "owner":
    case "admin":
    case "director":
      return "director";
    case "manager":
      return "manager";
    case "commercial_consultant":
    case "consultor_comercial":
      return "commercial_consultant";
    case "broker":
      return "broker";
    case "administrative":
    case "administrativo":
      return "administrative";
    case "concierge":
      return "concierge";
    default:
      return null;
  }
}

export function getUserRoleLabel(role: UserRole | null | undefined) {
  switch (role) {
    case "director":
      return "Diretor";
    case "manager":
      return "Gestor";
    case "commercial_consultant":
      return "Consultor comercial";
    case "broker":
      return "Corretor";
    case "administrative":
      return "Administrativo";
    case "concierge":
      return "Concierge";
    default:
      return "Nao definido";
  }
}
