import type { DevelopmentSettings } from "../../../shared/types/developmentSettings";
import { developmentSettingsMock } from "../mocks/developmentSettingsMock";

function createDefaultDevelopmentSettings(
  accountId: string,
  developmentId: string,
): DevelopmentSettings {
  return {
    developmentId,
    accountId,
    reservationDurationHours: null,
    requireAcceptedProposalForReservationRequest: null,
    requireCompleteClientDataForReservationRequest: null,
    queueEnabled: null,
    updatedAt: new Date(),
  };
}

export function getDevelopmentSettings(accountId: string, developmentId: string) {
  return (
    developmentSettingsMock.find(
      (item) =>
        item.accountId === accountId && item.developmentId === developmentId,
    ) ?? createDefaultDevelopmentSettings(accountId, developmentId)
  );
}

export function updateDevelopmentSettings(
  accountId: string,
  developmentId: string,
  input: Partial<
    Omit<DevelopmentSettings, "accountId" | "developmentId" | "updatedAt">
  >,
) {
  const currentIndex = developmentSettingsMock.findIndex(
    (item) =>
      item.accountId === accountId && item.developmentId === developmentId,
  );
  const current =
    currentIndex >= 0
      ? developmentSettingsMock[currentIndex]
      : createDefaultDevelopmentSettings(accountId, developmentId);

  const next: DevelopmentSettings = {
    ...current,
    ...input,
    updatedAt: new Date(),
  };

  if (currentIndex >= 0) {
    developmentSettingsMock[currentIndex] = next;
  } else {
    developmentSettingsMock.unshift(next);
  }

  return next;
}
