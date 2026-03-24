import type { AccountContextData } from "../../shared/types/account";
import type { UserRole } from "../../shared/types/auth";
import { normalizeUserRole } from "../../shared/types/role";
import { getSupabaseClientOrThrow } from "./baseRepository";

type UserAccountAccessRow = {
  role: UserRole | null;
  accounts:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

function mapAccountAccessRowToAccount(
  row: UserAccountAccessRow,
): AccountContextData | null {
  const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;

  if (!account) {
    return null;
  }

  return {
    accountId: account.id,
    accountName: account.name,
    slug: account.name.toLowerCase().replace(/\s+/g, "-"),
    role: normalizeUserRole(row.role),
  };
}

export async function getAccessibleAccounts(userId: string) {
  const supabase = getSupabaseClientOrThrow("account access repository");

  const { data, error } = await supabase
    .from("user_account_access")
    .select("role, accounts(id, name)")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load accessible accounts: ${error.message}`);
  }

  return (data ?? [])
    .map((row) =>
      mapAccountAccessRowToAccount(row as unknown as UserAccountAccessRow),
    )
    .filter((account): account is AccountContextData => account !== null);
}
