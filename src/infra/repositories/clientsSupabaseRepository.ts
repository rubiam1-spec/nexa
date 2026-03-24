import type { Client } from "../../shared/types/client";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: "active" | "inactive";
};

function mapClientRowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    status: row.status,
  };
}

export async function getClients(accountId: string) {
  const supabase = getSupabaseClientOrThrow("clients repository");

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, email, phone, city, status")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  const clients = (data ?? []).map((row) => mapClientRowToClient(row as ClientRow));

  return unwrapSupabaseListResult<Client>(clients, error, "clients");
}

export async function createClient(input: {
  accountId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  cpf?: string;
  profession?: string;
  maritalStatus?: string;
  observations?: string;
}): Promise<Client> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const { data, error } = await supabase
    .from("clients")
    .insert({
      account_id: input.accountId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      cpf: input.cpf || null,
      profession: input.profession || null,
      marital_status: input.maritalStatus || null,
      observations: input.observations || null,
      status: "active",
    })
    .select("id, name, email, phone, city, status")
    .maybeSingle();
  if (error) throw new Error(`Falha ao criar cliente: ${error.message}`);
  if (!data) throw new Error("Cliente não retornado após criação.");
  return mapClientRowToClient(data as ClientRow);
}
