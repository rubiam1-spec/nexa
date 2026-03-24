export type CommercialSettings = {
  accountId: string;
  developmentId: string;
  reservationDurationHours: number;
  requireAcceptedProposalForReservationRequest: boolean;
  requireCompleteClientDataForReservationRequest: boolean;
  queueEnabled: boolean;
};
