import type { AccountSettings } from "../../../shared/types/accountSettings";

export const accountSettingsMock: AccountSettings[] = [
  {
    accountId: "account_1",
    reservationDurationHours: 48,
    requireAcceptedProposalForReservationRequest: true,
    requireCompleteClientDataForReservationRequest: false,
    queueEnabled: false,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];
