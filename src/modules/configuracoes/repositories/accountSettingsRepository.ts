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
    logoUrl: null,
    logoLightUrl: null,
    logoDarkUrl: null,
    corPrimaria: "#14532d",
    corSecundaria: "#16a34a",
    nomeComercial: null,
    site: null,
    telefone: null,
    slogan: null,
    fraseImpactoPdf: "Patrimonio nao se constroi esperando o momento certo. O momento certo e quando voce age.",
    tituloProposta: null,
    bulletPdf1: null,
    bulletPdf2: null,
    bulletPdf3: null,
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
