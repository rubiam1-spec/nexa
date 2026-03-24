import type { Brokerage } from "../../shared/types/brokerage";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

type BrokerageRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: "active" | "inactive";
};

function mapBrokerageRowToBrokerage(row: BrokerageRow): Brokerage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    status: row.status,
  };
}

export async function getBrokerages(accountId: string) {
  const supabase = getSupabaseClientOrThrow("brokerages repository");

  const { data, error } = await supabase
    .from("brokerages")
    .select("id, name, email, phone, city, status")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  const brokerages = (data ?? []).map((row) =>
    mapBrokerageRowToBrokerage(row as BrokerageRow),
  );

  return unwrapSupabaseListResult<Brokerage>(brokerages, error, "brokerages");
}

export async function createBrokerage(input: {
  accountId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  cnpj?: string;
}): Promise<Brokerage> {
  const supabase = getSupabaseClientOrThrow("brokerages repository");
  const { data, error } = await supabase
    .from("brokerages")
    .insert({
      account_id: input.accountId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      cnpj: input.cnpj || null,
      status: "active",
    })
    .select("id, name, email, phone, city, status")
    .maybeSingle();
  if (error) throw new Error(`Falha ao criar imobiliária: ${error.message}`);
  if (!data) throw new Error("Imobiliária não retornada após criação.");
  return mapBrokerageRowToBrokerage(data as BrokerageRow);
}
