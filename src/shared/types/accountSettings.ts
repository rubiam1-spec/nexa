export type AccountSettings = {
  accountId: string;
  reservationDurationHours: number;
  requireAcceptedProposalForReservationRequest: boolean;
  requireCompleteClientDataForReservationRequest: boolean;
  queueEnabled: boolean;
  updatedAt: Date;
  // Identidade visual
  logoUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  corPrimaria: string;
  corSecundaria: string;
  nomeComercial: string | null;
  site: string | null;
  telefone: string | null;
  slogan: string | null;
  fraseImpactoPdf: string;
  tituloProposta: string | null;
  bulletPdf1: string | null;
  bulletPdf2: string | null;
  bulletPdf3: string | null;
};
