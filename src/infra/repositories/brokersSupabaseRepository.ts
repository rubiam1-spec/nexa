import type { Broker } from "../../shared/types/broker";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const BROKER_COLUMNS = "id, name, email, phone, brokerage_id, brokerage_name, city, status, has_system_access, profile_id, created_by, approval_status";

function mapBrokerRow(row: Record<string, unknown>): Broker {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    brokerageId: (row.brokerage_id as string) ?? null,
    brokerageName: (row.brokerage_name as string) ?? "",
    city: (row.city as string) ?? "",
    status: row.status as "active" | "inactive",
    hasSystemAccess: (row.has_system_access as boolean) ?? false,
    profileId: (row.profile_id as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    approvalStatus: (row.approval_status as "approved" | "pending_approval") ?? "approved",
  };
}

export async function getBrokers(accountId: string, consultantFilter?: { userId: string; brokerIdsFromNegs: string[] }) {
  const supabase = getSupabaseClientOrThrow("brokers repository");

  let query = supabase
    .from("brokers")
    .select(BROKER_COLUMNS)
    .eq("account_id", accountId);

  if (consultantFilter) {
    const { userId, brokerIdsFromNegs } = consultantFilter;
    if (brokerIdsFromNegs.length > 0) {
      query = query.or(`created_by.eq.${userId},id.in.(${brokerIdsFromNegs.join(",")})`);
    } else {
      query = query.eq("created_by", userId);
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  const brokers = data?.map(mapBrokerRow) ?? null;

  return unwrapSupabaseListResult<Broker>(brokers, error, "brokers");
}

export async function approveBroker(brokerId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("brokers repository");
  const { error } = await supabase.from("brokers").update({ approval_status: "approved" }).eq("id", brokerId);
  if (error) throw new Error(`Falha ao aprovar corretor: ${error.message}`);
}

export async function createBroker(input: {
  accountId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  creci?: string;
  brokerageId?: string;
  brokerageName?: string;
  createdBy?: string;
  approvalStatus?: "approved" | "pending_approval";
  dataNascimento?: string;
}): Promise<Broker> {
  const supabase = getSupabaseClientOrThrow("brokers repository");
  const insertPayload: Record<string, unknown> = {
    account_id: input.accountId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    creci: input.creci || null,
    brokerage_id: input.brokerageId || null,
    brokerage_name: input.brokerageName || "",
    status: "active",
    has_system_access: false,
    data_nascimento: input.dataNascimento || null,
  };
  if (input.createdBy) insertPayload.created_by = input.createdBy;
  if (input.approvalStatus) insertPayload.approval_status = input.approvalStatus;
  const { data, error } = await supabase
    .from("brokers")
    .insert(insertPayload)
    .select(BROKER_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Falha ao criar corretor: ${error.message}`);
  if (!data) throw new Error("Corretor não retornado após criação.");
  return mapBrokerRow(data);
}

export type InviteBrokerResult = { success: boolean; link?: string };

export async function inviteBroker(
  brokerId: string,
  accessToken: string,
): Promise<InviteBrokerResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Supabase URL não configurada.");

  const response = await fetch(
    `${supabaseUrl}/functions/v1/invite-broker`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ broker_id: brokerId }),
    },
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || "Falha ao convidar corretor para o sistema.");
  }

  return { success: true, link: data.link ?? undefined };
}

export async function deactivateBroker(broker: Broker): Promise<void> {
  const supabase = getSupabaseClientOrThrow("brokers repository");

  const { error } = await supabase
    .from("brokers")
    .update({ status: "inactive", has_system_access: false })
    .eq("id", broker.id);
  if (error) throw new Error(`Falha ao desativar corretor: ${error.message}`);

  if (broker.profileId) {
    await supabase.from("profiles").update({ status: "inactive" }).eq("id", broker.profileId);
  }
}

export async function reactivateBroker(broker: Broker): Promise<void> {
  const supabase = getSupabaseClientOrThrow("brokers repository");

  const { error } = await supabase
    .from("brokers")
    .update({ status: "active" })
    .eq("id", broker.id);
  if (error) throw new Error(`Falha ao reativar corretor: ${error.message}`);

  if (broker.profileId) {
    await supabase.from("profiles").update({ status: "active" }).eq("id", broker.profileId);
  }
}

export async function countBrokerNegotiations(brokerId: string): Promise<number> {
  const supabase = getSupabaseClientOrThrow("brokers repository");

  const { count, error } = await supabase
    .from("negotiations")
    .select("id", { count: "exact", head: true })
    .eq("broker_id", brokerId);
  if (error) throw new Error(`Falha ao verificar negociações: ${error.message}`);
  return count ?? 0;
}

export async function deleteBroker(broker: Broker): Promise<void> {
  const supabase = getSupabaseClientOrThrow("brokers repository");

  if (broker.profileId) {
    await supabase.from("user_account_access").delete().eq("user_id", broker.profileId);
    await supabase.from("profiles").delete().eq("id", broker.profileId);
  }

  const { error } = await supabase.from("brokers").delete().eq("id", broker.id);
  if (error) throw new Error(`Falha ao excluir corretor: ${error.message}`);
}
