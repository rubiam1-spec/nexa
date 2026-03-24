export type AccountSettings = {
  accountId: string;
  reservationDurationHours: number;
  requireAcceptedProposalForReservationRequest: boolean;
  requireCompleteClientDataForReservationRequest: boolean;
  queueEnabled: boolean;
  updatedAt: Date;
};
