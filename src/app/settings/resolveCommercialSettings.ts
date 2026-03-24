import type { AccountSettings } from "../../shared/types/accountSettings";
import type { CommercialSettings } from "../../shared/types/commercialSettings";
import type { DevelopmentSettings } from "../../shared/types/developmentSettings";

export function resolveCommercialSettings(input: {
  accountSettings: AccountSettings;
  developmentId: string;
  developmentSettings: DevelopmentSettings | null;
}): CommercialSettings {
  const { accountSettings, developmentId, developmentSettings } = input;

  return {
    accountId: accountSettings.accountId,
    developmentId,
    reservationDurationHours:
      developmentSettings?.reservationDurationHours ??
      accountSettings.reservationDurationHours,
    requireAcceptedProposalForReservationRequest:
      developmentSettings?.requireAcceptedProposalForReservationRequest ??
      accountSettings.requireAcceptedProposalForReservationRequest,
    requireCompleteClientDataForReservationRequest:
      developmentSettings?.requireCompleteClientDataForReservationRequest ??
      accountSettings.requireCompleteClientDataForReservationRequest,
    queueEnabled:
      developmentSettings?.queueEnabled ?? accountSettings.queueEnabled,
  };
}
