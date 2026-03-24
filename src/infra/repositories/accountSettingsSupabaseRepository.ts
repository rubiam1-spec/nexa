import type { AccountSettings } from "../../shared/types/accountSettings";
import { getSupabaseClientOrThrow } from "./baseRepository";

type AccountSettingsRow = {
  account_id: string;
  reservation_duration_hours: number;
  require_accepted_proposal_for_reservation_request: boolean;
  require_complete_client_data_for_reservation_request: boolean;
  queue_enabled: boolean;
  updated_at: string;
};

function mapAccountSettingsRow(row: AccountSettingsRow): AccountSettings {
  return {
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

export async function getAccountSettings(accountId: string) {
  const supabase = getSupabaseClientOrThrow("account settings repository");

  const { data, error } = await supabase
    .from("account_settings")
    .select(
      "account_id, reservation_duration_hours, require_accepted_proposal_for_reservation_request, require_complete_client_data_for_reservation_request, queue_enabled, updated_at",
    )
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
  input: Partial<
    Omit<AccountSettings, "accountId" | "updatedAt">
  >,
) {
  const supabase = getSupabaseClientOrThrow("account settings repository");

  const { data, error } = await supabase
    .from("account_settings")
    .upsert({
      account_id: accountId,
      reservation_duration_hours: input.reservationDurationHours,
      require_accepted_proposal_for_reservation_request:
        input.requireAcceptedProposalForReservationRequest,
      require_complete_client_data_for_reservation_request:
        input.requireCompleteClientDataForReservationRequest,
      queue_enabled: input.queueEnabled,
      updated_at: new Date().toISOString(),
    })
    .select(
      "account_id, reservation_duration_hours, require_accepted_proposal_for_reservation_request, require_complete_client_data_for_reservation_request, queue_enabled, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update account settings: ${error.message}`);
  }

  if (!data) {
    throw new Error("Account settings were not returned after update.");
  }

  return mapAccountSettingsRow(data as AccountSettingsRow);
}
