import type { DevelopmentSettings } from "../../../shared/types/developmentSettings";

export const developmentSettingsMock: DevelopmentSettings[] = [
  {
    developmentId: "development_1",
    accountId: "account_1",
    reservationDurationHours: 72,
    requireAcceptedProposalForReservationRequest: null,
    requireCompleteClientDataForReservationRequest: null,
    queueEnabled: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];
