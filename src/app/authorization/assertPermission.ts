import type { UserRole } from "../../shared/types/auth";
import { ForbiddenActionError } from "./errors/ForbiddenActionError";
import { canPerformAction, type PermissionAction } from "./permissions";

export function assertPermission(
  role: UserRole | null | undefined,
  action: PermissionAction,
  message: string,
) {
  if (!canPerformAction(role, action)) {
    throw new ForbiddenActionError(message);
  }
}
