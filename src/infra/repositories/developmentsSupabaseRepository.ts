import type { DevelopmentContextData } from "../../shared/types/development";
import { getSupabaseClientOrThrow } from "./baseRepository";

type DevelopmentRow = {
  id: string;
  account_id: string;
  name: string;
  city: string | null;
  state: string | null;
  description: string | null;
  status: "active" | "inactive";
};

function mapDevelopmentRowToDevelopment(
  row: DevelopmentRow,
): DevelopmentContextData {
  return {
    developmentId: row.id,
    accountId: row.account_id,
    developmentName: row.name,
    city: row.city,
    state: row.state,
    description: row.description,
    status: row.status,
  };
}

export async function getDevelopmentsByAccountId(accountId: string) {
  const supabase = getSupabaseClientOrThrow("developments repository");

  const { data, error } = await supabase
    .from("developments")
    .select("id, account_id, name, city, state, description, status")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load developments: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapDevelopmentRowToDevelopment(row as DevelopmentRow),
  );
}

export async function getDevelopmentById(developmentId: string): Promise<DevelopmentContextData | null> {
  const supabase = getSupabaseClientOrThrow("developments repository");
  const { data, error } = await supabase
    .from("developments")
    .select("id, account_id, name, city, state, description, status")
    .eq("id", developmentId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar empreendimento: ${error.message}`);
  if (!data) return null;
  return mapDevelopmentRowToDevelopment(data as DevelopmentRow);
}

export async function updateDevelopment(developmentId: string, input: {
  name?: string;
  city?: string;
  state?: string;
  description?: string;
}): Promise<DevelopmentContextData> {
  const supabase = getSupabaseClientOrThrow("developments repository");
  const { data, error } = await supabase
    .from("developments")
    .update({
      name: input.name,
      city: input.city || null,
      state: input.state || null,
      description: input.description || null,
    })
    .eq("id", developmentId)
    .select("id, account_id, name, city, state, description, status")
    .maybeSingle();
  if (error) throw new Error(`Falha ao atualizar empreendimento: ${error.message}`);
  if (!data) throw new Error("Empreendimento não encontrado.");
  return mapDevelopmentRowToDevelopment(data as DevelopmentRow);
}

export async function createDevelopment(input: {
  accountId: string;
  name: string;
  city?: string;
  state?: string;
  description?: string;
}): Promise<DevelopmentContextData> {
  const supabase = getSupabaseClientOrThrow("developments repository");

  const { data, error } = await supabase
    .from("developments")
    .insert({
      account_id: input.accountId,
      name: input.name,
      city: input.city || null,
      state: input.state || null,
      description: input.description || null,
      status: "active",
    })
    .select("id, account_id, name, city, state, description, status")
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao criar empreendimento: ${error.message}`);
  }

  if (!data) {
    throw new Error("Empreendimento não retornado após criação.");
  }

  return mapDevelopmentRowToDevelopment(data as DevelopmentRow);
}
