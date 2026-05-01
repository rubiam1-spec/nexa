import type { UserRole } from "./auth";
import type { PermissionOverrides } from "../constants/permissionPresets";

export type AccountContextData = {
  accountId: string;
  accountName: string;
  slug: string;
  role: UserRole | null;
  /**
   * Overrides individuais aplicados sobre o preset do role para este usuario
   * nesta conta. Null = usa o preset integral.
   */
  permissionOverrides: PermissionOverrides | null;
};
