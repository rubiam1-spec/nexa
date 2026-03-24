import type { DevelopmentSettings } from "../../shared/types/developmentSettings";
import { getSupabaseClientOrThrow } from "./baseRepository";

type DevelopmentSettingsRow = {
  development_id: string;
  account_id: string;
  reservation_duration_hours: number | null;
  require_accepted_proposal_for_reservation_request: boolean | null;
  require_complete_client_data_for_reservation_request: boolean | null;
  queue_enabled: boolean | null;
  updated_at: string;
};

function mapDevelopmentSettingsRow(
  row: DevelopmentSettingsRow,
): DevelopmentSettings {
  return {
    developmentId: row.development_id,
    accountId: row.account_id,
    reservationDurationHours: row.reservation_duration_hours,
    requireAcceptedProposalForReservationRequest:
      row.require_accepted_proposal_for_reservation_request,
    requireCompleteClientDataForReservationRequest:
      row.require_complete_client_data_for_reservation_request,
    queueEnabled: row.queue_enabled,
    updatedAt: new Date(row.updated_at),
  };
}

export async function getDevelopmentSettings(
  accountId: string,
  developmentId: string,
) {
  const supabase = getSupabaseClientOrThrow("development settings repository");

  const { data, error } = await supabase
    .from("development_settings")
    .select(
      "development_id, account_id, reservation_duration_hours, require_accepted_proposal_for_reservation_request, require_complete_client_data_for_reservation_request, queue_enabled, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load development settings: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapDevelopmentSettingsRow(data as DevelopmentSettingsRow);
}

export async function updateDevelopmentSettings(
  accountId: string,
  developmentId: string,
  input: Partial<
    Omit<DevelopmentSettings, "accountId" | "developmentId" | "updatedAt">
  >,
) {
  const supabase = getSupabaseClientOrThrow("development settings repository");

  const { data, error } = await supabase
    .from("development_settings")
    .upsert({
      account_id: accountId,
      development_id: developmentId,
      reservation_duration_hours: input.reservationDurationHours,
      require_accepted_proposal_for_reservation_request:
        input.requireAcceptedProposalForReservationRequest,
      require_complete_client_data_for_reservation_request:
        input.requireCompleteClientDataForReservationRequest,
      queue_enabled: input.queueEnabled,
      updated_at: new Date().toISOString(),
    })
    .select(
      "development_id, account_id, reservation_duration_hours, require_accepted_proposal_for_reservation_request, require_complete_client_data_for_reservation_request, queue_enabled, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update development settings: ${error.message}`);
  }

  if (!data) {
    throw new Error("Development settings were not returned after update.");
  }

  return mapDevelopmentSettingsRow(data as DevelopmentSettingsRow);
}
