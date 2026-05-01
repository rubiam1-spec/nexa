import type { AccountSettings } from "../../../shared/types/accountSettings";

export const accountSettingsMock: AccountSettings[] = [
  {
    accountId: "account_1",
    reservationDurationHours: 48,
    requireAcceptedProposalForReservationRequest: true,
    requireCompleteClientDataForReservationRequest: false,
    queueEnabled: false,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
  },
];
