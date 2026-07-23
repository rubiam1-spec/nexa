// Documentos Temáveis v3 · infra do tema. Lê/grava account_document_themes
// (RLS: leitura conta, escrita owner/director/manager). Sem linha = tema neutro
// (o resolvedor de domínio devolve o DEFAULT NEXA). Retorna a linha CRUA; a
// resolução em tokens é do domínio (documentTheme.ts).
import { getSupabaseClientOrThrow } from "./baseRepository";
import type { DocumentThemeRow } from "../../shared/documents/documentTheme";

const COLS = "account_id, logo_primary_url, logo_product_url, palette, slogan, slogan_accent_word, disclaimer, font_pair, updated_by, updated_at";

export async function getDocumentThemeRow(accountId: string): Promise<DocumentThemeRow | null> {
  const supabase = getSupabaseClientOrThrow("document theme repository");
  const { data, error } = await supabase
    .from("account_document_themes")
    .select(COLS)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DocumentThemeRow | null) ?? null;
}

export type DocumentThemePatch = {
  logo_primary_url?: string | null;
  logo_product_url?: string | null;
  palette?: Record<string, string> | null;
  slogan?: string | null;
  slogan_accent_word?: string | null;
  disclaimer?: string | null;
  font_pair?: string | null;
};

// Upsert por account_id (PK). Grava updated_by. Devolve a linha resultante.
export async function saveDocumentTheme(accountId: string, patch: DocumentThemePatch, updatedBy: string | null): Promise<DocumentThemeRow> {
  const supabase = getSupabaseClientOrThrow("document theme repository");
  const { data, error } = await supabase
    .from("account_document_themes")
    .upsert({ account_id: accountId, ...patch, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "account_id" })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as DocumentThemeRow;
}

// Upload de logo no bucket público `logos` (path por conta). Retorna o path.
export async function uploadDocumentLogo(accountId: string, kind: "primary" | "product", file: File): Promise<string> {
  const supabase = getSupabaseClientOrThrow("document theme repository");
  const path = `${accountId}/${kind}.png`;
  const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}
