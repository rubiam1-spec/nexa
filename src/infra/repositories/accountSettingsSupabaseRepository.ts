import type { AccountSettings } from "../../shared/types/accountSettings";
import { getSupabaseClientOrThrow } from "./baseRepository";

type AccountSettingsRow = {
  account_id: string;
  reservation_duration_hours: number;
  require_accepted_proposal_for_reservation_request: boolean;
  require_complete_client_data_for_reservation_request: boolean;
  queue_enabled: boolean;
  updated_at: string;
  logo_url?: string | null;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  nome_comercial?: string | null;
  site?: string | null;
  telefone?: string | null;
  slogan?: string | null;
  frase_impacto_pdf?: string | null;
  titulo_proposta_pdf?: string | null;
  bullet_pdf_1?: string | null;
  bullet_pdf_2?: string | null;
  bullet_pdf_3?: string | null;
};

const DEFAULT_FRASE = "Patrimonio nao se constroi esperando o momento certo. O momento certo e quando voce age.";

function mapAccountSettingsRow(row: AccountSettingsRow): AccountSettings {
  return {
    accountId: row.account_id,
    reservationDurationHours: row.reservation_duration_hours,
    requireAcceptedProposalForReservationRequest: row.require_accepted_proposal_for_reservation_request,
    requireCompleteClientDataForReservationRequest: row.require_complete_client_data_for_reservation_request,
    queueEnabled: row.queue_enabled,
    updatedAt: new Date(row.updated_at),
    logoUrl: row.logo_url ?? null,
    logoLightUrl: row.logo_light_url ?? null,
    logoDarkUrl: row.logo_dark_url ?? null,
    corPrimaria: row.cor_primaria ?? "#14532d",
    corSecundaria: row.cor_secundaria ?? "#16a34a",
    nomeComercial: row.nome_comercial ?? null,
    site: row.site ?? null,
    telefone: row.telefone ?? null,
    slogan: row.slogan ?? null,
    fraseImpactoPdf: row.frase_impacto_pdf ?? DEFAULT_FRASE,
    tituloProposta: row.titulo_proposta_pdf ?? null,
    bulletPdf1: row.bullet_pdf_1 ?? null,
    bulletPdf2: row.bullet_pdf_2 ?? null,
    bulletPdf3: row.bullet_pdf_3 ?? null,
  };
}

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
    fraseImpactoPdf: DEFAULT_FRASE,
    tituloProposta: null,
    bulletPdf1: null,
    bulletPdf2: null,
    bulletPdf3: null,
  };
}

export async function getAccountSettings(accountId: string) {
  const supabase = getSupabaseClientOrThrow("account settings repository");

  const { data, error } = await supabase
    .from("account_settings")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account settings: ${error.message}`);
  }

  if (!data) {
    return createDefaultAccountSettings(accountId);
  }

  return mapAccountSettingsRow(data as AccountSettingsRow);
}

export async function updateAccountSettings(
  accountId: string,
  input: Partial<Omit<AccountSettings, "accountId" | "updatedAt">>,
) {
  const supabase = getSupabaseClientOrThrow("account settings repository");

  const upsertData: Record<string, unknown> = {
    account_id: accountId,
    updated_at: new Date().toISOString(),
  };

  if (input.reservationDurationHours !== undefined) upsertData.reservation_duration_hours = input.reservationDurationHours;
  if (input.requireAcceptedProposalForReservationRequest !== undefined) upsertData.require_accepted_proposal_for_reservation_request = input.requireAcceptedProposalForReservationRequest;
  if (input.requireCompleteClientDataForReservationRequest !== undefined) upsertData.require_complete_client_data_for_reservation_request = input.requireCompleteClientDataForReservationRequest;
  if (input.queueEnabled !== undefined) upsertData.queue_enabled = input.queueEnabled;
  if (input.logoUrl !== undefined) upsertData.logo_url = input.logoUrl;
  if (input.logoLightUrl !== undefined) upsertData.logo_light_url = input.logoLightUrl;
  if (input.logoDarkUrl !== undefined) upsertData.logo_dark_url = input.logoDarkUrl;
  if (input.corPrimaria !== undefined) upsertData.cor_primaria = input.corPrimaria;
  if (input.corSecundaria !== undefined) upsertData.cor_secundaria = input.corSecundaria;
  if (input.nomeComercial !== undefined) upsertData.nome_comercial = input.nomeComercial;
  if (input.site !== undefined) upsertData.site = input.site;
  if (input.telefone !== undefined) upsertData.telefone = input.telefone;
  if (input.slogan !== undefined) upsertData.slogan = input.slogan;
  if (input.fraseImpactoPdf !== undefined) upsertData.frase_impacto_pdf = input.fraseImpactoPdf;
  if (input.tituloProposta !== undefined) upsertData.titulo_proposta_pdf = input.tituloProposta;
  if (input.bulletPdf1 !== undefined) upsertData.bullet_pdf_1 = input.bulletPdf1;
  if (input.bulletPdf2 !== undefined) upsertData.bullet_pdf_2 = input.bulletPdf2;
  if (input.bulletPdf3 !== undefined) upsertData.bullet_pdf_3 = input.bulletPdf3;

  const { data, error } = await supabase
    .from("account_settings")
    .upsert(upsertData)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update account settings: ${error.message}`);
  }

  if (!data) {
    throw new Error("Account settings were not returned after update.");
  }

  return mapAccountSettingsRow(data as AccountSettingsRow);
}
