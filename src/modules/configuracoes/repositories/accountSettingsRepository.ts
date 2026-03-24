import type { AccountSettings } from "../../../shared/types/accountSettings";
import { accountSettingsMock } from "../mocks/accountSettingsMock";

function createDefaultAccountSettings(accountId: string): AccountSettings {
  return {
    accountId,
    reservationDurationHours: 48,
    requireAcceptedProposalForReservationRequest: true,
    requireCompleteClientDataForReservationRequest: false,
    queueEnabled: false,
    updatedAt: new Date(),
  };
}

export function getAccountSettings(accountId: string) {
  return (
    accountSettingsMock.find((item) => item.accountId === accountId) ??
    createDefaultAccountSettings(accountId)
  );
}

export function updateAccountSettings(
  accountId: string,
  input: Partial<
    Omit<AccountSettings, "accountId" | "updatedAt">
  >,
) {
  const currentIndex = accountSettingsMock.findIndex(
    (item) => item.accountId === accountId,
  );
  const current =
    currentIndex >= 0
      ? accountSettingsMock[currentIndex]
      : createDefaultAccountSettings(accountId);

  const next: AccountSettings = {
    ...current,
    ...input,
    updatedAt: new Date(),
  };

  if (currentIndex >= 0) {
    accountSettingsMock[currentIndex] = next;
  } else {
    accountSettingsMock.unshift(next);
  }

  return next;
}
