import { useMemo, useCallback } from "react";
import { useAccount } from "../../app/contexts/AccountContext";
import {
  type PermissionFlag,
  type PermissionPreset,
  type PermissionOverrides,
  resolvePermission,
  resolveAllPermissions,
} from "../constants/permissionPresets";

export interface UsePermissionsResult {
  /** Objeto com as 27 flags ja resolvidas (preset + role override + individual override). */
  permissions: PermissionPreset;
  /** Checa uma flag especifica. Ex.: can("can_approve_documents"). */
  can: (flag: PermissionFlag) => boolean;
  /** Role efetivo da conta ativa (null enquanto o contexto nao carrega). */
  role: string | null;
  /** Override individual do usuario (camada 3). */
  individualOverrides: PermissionOverrides | null;
  /** Override aplicado ao role deste usuario na conta ativa (camada 2). */
  roleOverrides: PermissionOverrides | null;
}

/**
 * Ponto unico de consulta de permissoes na UI.
 *
 * Camadas aplicadas em ordem de prioridade (mais forte -> mais fraca):
 *   1. individualOverrides — user_account_access.permission_overrides
 *   2. roleOverrides       — account_settings.role_permission_overrides[role]
 *   3. preset               — PERMISSION_PRESETS[role]
 *
 * O RLS do banco continua sendo a ultima barreira; este hook controla
 * apenas a experiencia de UI.
 */
export function usePermissions(): UsePermissionsResult {
  const { account, rolePermissionOverrides } = useAccount();
  const role = account?.role ?? null;
  const individualOverrides = account?.permissionOverrides ?? null;
  const roleOverrides: PermissionOverrides | null =
    (role && rolePermissionOverrides?.[role]) || null;

  const permissions = useMemo(
    () => resolveAllPermissions(role, individualOverrides, roleOverrides),
    [role, individualOverrides, roleOverrides],
  );

  const can = useCallback(
    (flag: PermissionFlag) =>
      resolvePermission(flag, role, individualOverrides, roleOverrides),
    [role, individualOverrides, roleOverrides],
  );

  return { permissions, can, role, individualOverrides, roleOverrides };
}
