import { getSupabaseClientOrThrow } from "./baseRepository";
import { supabase } from "../supabase/supabaseClient";

export type Material = {
  id: string;
  accountId: string;
  developmentId: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  fileUrl: string | null;
  ordem: number;
  status: string;
  createdAt: Date;
};

type MaterialRow = {
  id: string;
  account_id: string;
  development_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  file_url: string | null;
  ordem: number;
  status: string;
  created_at: string;
};

function mapRow(row: MaterialRow): Material {
  return {
    id: row.id,
    accountId: row.account_id,
    developmentId: row.development_id,
    tipo: row.tipo,
    titulo: row.titulo,
    descricao: row.descricao,
    fileUrl: row.file_url,
    ordem: row.ordem,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

export async function getMaterials(accountId: string, developmentId: string) {
  const sb = getSupabaseClientOrThrow("materials repository");
  const { data, error } = await sb
    .from("materials")
    .select("id, account_id, development_id, tipo, titulo, descricao, file_url, ordem, status, created_at")
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("ordem", { ascending: true });

  if (error) throw new Error(`Falha ao carregar materiais: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as MaterialRow));
}

export async function createMaterial(input: {
  accountId: string;
  developmentId: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  fileUrl?: string;
}): Promise<Material> {
  const sb = getSupabaseClientOrThrow("materials repository");
  const { data, error } = await sb
    .from("materials")
    .insert({
      account_id: input.accountId,
      development_id: input.developmentId,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao || null,
      file_url: input.fileUrl || null,
      status: "active",
    })
    .select("id, account_id, development_id, tipo, titulo, descricao, file_url, ordem, status, created_at")
    .maybeSingle();

  if (error) throw new Error(`Falha ao criar material: ${error.message}`);
  if (!data) throw new Error("Material não retornado após criação.");
  return mapRow(data as MaterialRow);
}

export async function uploadMaterialFile(file: File, accountId: string, developmentId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${accountId}/${developmentId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("materials").upload(path, file);
  if (error) throw new Error(`Falha no upload: ${error.message}`);
  const { data: urlData } = supabase.storage.from("materials").getPublicUrl(path);
  return urlData.publicUrl;
}
