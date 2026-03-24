import type { UserRole } from "../../shared/types/auth";

export const PermissionAction = {
  CREATE_NEGOTIATION: "CREATE_NEGOTIATION",
  START_NEGOTIATION: "START_NEGOTIATION",
  CANCEL_NEGOTIATION: "CANCEL_NEGOTIATION",
  CREATE_PROPOSAL: "CREATE_PROPOSAL",
  OPERATE_PROPOSAL: "OPERATE_PROPOSAL",
  ENTER_UNIT_QUEUE: "ENTER_UNIT_QUEUE",
  REQUEST_RESERVATION: "REQUEST_RESERVATION",
  APPROVE_RESERVATION_REQUEST: "APPROVE_RESERVATION_REQUEST",
  REJECT_RESERVATION_REQUEST: "REJECT_RESERVATION_REQUEST",
  CANCEL_RESERVATION: "CANCEL_RESERVATION",
  EXPIRE_RESERVATION: "EXPIRE_RESERVATION",
  CONVERT_SALE: "CONVERT_SALE",
  ADVANCE_SALE: "ADVANCE_SALE",
  CANCEL_SALE: "CANCEL_SALE",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
} as const;

export type PermissionAction =
  (typeof PermissionAction)[keyof typeof PermissionAction];

const permissionsByRole: Record<UserRole, PermissionAction[]> = {
  director: [
    PermissionAction.CREATE_NEGOTIATION,
    PermissionAction.START_NEGOTIATION,
    PermissionAction.CANCEL_NEGOTIATION,
    PermissionAction.CREATE_PROPOSAL,
    PermissionAction.OPERATE_PROPOSAL,
    PermissionAction.ENTER_UNIT_QUEUE,
    PermissionAction.REQUEST_RESERVATION,
    PermissionAction.APPROVE_RESERVATION_REQUEST,
    PermissionAction.REJECT_RESERVATION_REQUEST,
    PermissionAction.CANCEL_RESERVATION,
    PermissionAction.EXPIRE_RESERVATION,
    PermissionAction.CONVERT_SALE,
    PermissionAction.ADVANCE_SALE,
    PermissionAction.CANCEL_SALE,
    PermissionAction.UPDATE_SETTINGS,
  ],
  manager: [
    PermissionAction.CREATE_NEGOTIATION,
    PermissionAction.START_NEGOTIATION,
    PermissionAction.CANCEL_NEGOTIATION,
    PermissionAction.CREATE_PROPOSAL,
    PermissionAction.OPERATE_PROPOSAL,
    PermissionAction.ENTER_UNIT_QUEUE,
    PermissionAction.REQUEST_RESERVATION,
    PermissionAction.APPROVE_RESERVATION_REQUEST,
    PermissionAction.REJECT_RESERVATION_REQUEST,
    PermissionAction.CANCEL_RESERVATION,
    PermissionAction.EXPIRE_RESERVATION,
    PermissionAction.CONVERT_SALE,
    PermissionAction.ADVANCE_SALE,
    PermissionAction.CANCEL_SALE,
    PermissionAction.UPDATE_SETTINGS,
  ],
  commercial_consultant: [
    PermissionAction.CREATE_NEGOTIATION,
    PermissionAction.START_NEGOTIATION,
    PermissionAction.CANCEL_NEGOTIATION,
    PermissionAction.CREATE_PROPOSAL,
    PermissionAction.OPERATE_PROPOSAL,
    PermissionAction.ENTER_UNIT_QUEUE,
    PermissionAction.REQUEST_RESERVATION,
  ],
  broker: [
    PermissionAction.CREATE_NEGOTIATION,
    PermissionAction.START_NEGOTIATION,
    PermissionAction.CREATE_PROPOSAL,
    PermissionAction.ENTER_UNIT_QUEUE,
    PermissionAction.REQUEST_RESERVATION,
  ],
  administrative: [
    PermissionAction.APPROVE_RESERVATION_REQUEST,
    PermissionAction.REJECT_RESERVATION_REQUEST,
    PermissionAction.CANCEL_RESERVATION,
    PermissionAction.EXPIRE_RESERVATION,
  ],
};

export function canPerformAction(
  role: UserRole | null | undefined,
  action: PermissionAction,
) {
  if (!role) {
    return false;
  }

  return permissionsByRole[role].includes(action);
}
