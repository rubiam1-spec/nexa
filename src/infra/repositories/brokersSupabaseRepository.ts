import type { Broker } from "../../shared/types/broker";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

export async function getBrokers(accountId: string) {
  const supabase = getSupabaseClientOrThrow("brokers repository");

  const { data, error } = await supabase
    .from("brokers")
    .select("id, name, email, phone, brokerage_name, city, status")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  const brokers =
    data?.map((broker) => ({
      id: broker.id,
      name: broker.name,
      email: broker.email,
      phone: broker.phone,
      brokerageName: broker.brokerage_name,
      city: broker.city,
      status: broker.status,
    })) ?? null;

  return unwrapSupabaseListResult<Broker>(brokers, error, "brokers");
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
}): Promise<Broker> {
  const supabase = getSupabaseClientOrThrow("brokers repository");
  const { data, error } = await supabase
    .from("brokers")
    .insert({
      account_id: input.accountId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      creci: input.creci || null,
      brokerage_id: input.brokerageId || null,
      brokerage_name: input.brokerageName || "",
      status: "active",
    })
    .select("id, name, email, phone, brokerage_name, city, status")
    .maybeSingle();
  if (error) throw new Error(`Falha ao criar corretor: ${error.message}`);
  if (!data) throw new Error("Corretor não retornado após criação.");
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    brokerageName: data.brokerage_name,
    city: data.city,
    status: data.status,
  };
}
