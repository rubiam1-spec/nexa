export type DevelopmentSettings = {
  developmentId: string;
  accountId: string;
  reservationDurationHours: number | null;
  requireAcceptedProposalForReservationRequest: boolean | null;
  requireCompleteClientDataForReservationRequest: boolean | null;
  queueEnabled: boolean | null;
  updatedAt: Date;
};
