import { supabase } from "../../infra/supabase/supabaseClient";

function generateSlug(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export async function createShareLink(params: {
  accountId: string;
  entityType: "simulation" | "proposal" | "property" | "unit" | "development";
  entityId: string;
  createdBy: string;
  developmentId?: string;
  expiresInHours?: number;
}): Promise<string> {
  if (!supabase) throw new Error("Supabase not initialized");

  const slug = generateSlug();
  const expiresAt = params.expiresInHours
    ? new Date(Date.now() + params.expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("share_links")
    .insert({
      account_id: params.accountId,
      slug,
      entity_type: params.entityType,
      entity_id: params.entityId,
      created_by: params.createdBy,
      expires_at: expiresAt,
      metadata: params.developmentId ? { development_id: params.developmentId } : {},
    })
    .select("slug")
    .single();

  if (error) throw error;
  return `https://app.nexacomercial.com.br/s/${data.slug}`;
}

export async function copyShareLink(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}
