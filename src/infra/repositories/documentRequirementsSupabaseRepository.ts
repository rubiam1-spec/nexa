// NEXA — Camada 3 (Documentos), Sprint B.3.0a
// Repositório de document_requirements + catálogo. Encapsula chamadas
// ao Supabase e mapeia snake_case → domínio (camelCase).

import { supabase } from "../supabase/supabaseClient";
import type {
  DocumentRequirement,
  DocumentRequirementWithType,
  DocumentType,
  PartyRole,
} from "../../shared/types/documentRequirement";

function mapDocumentType(row: Record<string, unknown>): DocumentType {
  return {
    id: row.id as string,
    label: row.label as string,
    description: (row.description as string) ?? null,
    category: row.category as DocumentType["category"],
    appliesToPessoaTipo: (row.applies_to_pessoa_tipo as string[]).map(
      (p) => p as DocumentType["appliesToPessoaTipo"][number],
    ),
    displayOrder: (row.display_order as number) ?? 0,
  };
}

function mapRequirement(row: Record<string, unknown>): DocumentRequirement {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    developmentId: row.development_id as string,
    partyRole: row.party_role as PartyRole,
    documentTypeId: row.document_type_id as string,
    isRequired: row.is_required as boolean,
    displayOrder: (row.display_order as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listCatalog(): Promise<DocumentType[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("document_type_catalog")
    .select("id, label, description, category, applies_to_pessoa_tipo, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`Falha ao carregar catálogo de documentos: ${error.message}`);
  return (data ?? []).map((row) => mapDocumentType(row as Record<string, unknown>));
}

export async function listByDevelopment(
  developmentId: string,
): Promise<DocumentRequirementWithType[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("document_requirements")
    .select(`
      id, account_id, development_id, party_role, document_type_id, is_required, display_order, created_at, updated_at,
      documentType:document_type_catalog(id, label, description, category, applies_to_pessoa_tipo, display_order)
    `)
    .eq("development_id", developmentId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`Falha ao carregar requirements: ${error.message}`);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const typeRowRaw = r.documentType;
    const typeRow = (Array.isArray(typeRowRaw) ? typeRowRaw[0] : typeRowRaw) as Record<string, unknown>;
    return {
      ...mapRequirement(r),
      documentType: mapDocumentType(typeRow),
    };
  });
}

export async function setRequirement(
  developmentId: string,
  accountId: string,
  partyRole: PartyRole,
  documentTypeId: string,
  isRequired: boolean,
): Promise<DocumentRequirement> {
  if (!supabase) throw new Error("Supabase indisponível.");

  // Buscar display_order do catálogo para ordenação consistente
  const { data: typeRow, error: typeErr } = await supabase
    .from("document_type_catalog")
    .select("display_order")
    .eq("id", documentTypeId)
    .maybeSingle();
  if (typeErr) throw new Error(`Tipo de documento inválido: ${typeErr.message}`);
  const displayOrder = ((typeRow as { display_order?: number } | null)?.display_order) ?? 0;

  const { data, error } = await supabase
    .from("document_requirements")
    .upsert(
      {
        account_id: accountId,
        development_id: developmentId,
        party_role: partyRole,
        document_type_id: documentTypeId,
        is_required: isRequired,
        display_order: displayOrder,
      },
      { onConflict: "development_id,party_role,document_type_id" },
    )
    .select()
    .single();
  if (error) throw new Error(`Falha ao salvar requirement: ${error.message}`);
  return mapRequirement(data as Record<string, unknown>);
}

export async function removeRequirement(requirementId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível.");
  const { error } = await supabase
    .from("document_requirements")
    .delete()
    .eq("id", requirementId);
  if (error) throw new Error(`Falha ao remover requirement: ${error.message}`);
}

export async function restoreDefaults(developmentId: string): Promise<number> {
  if (!supabase) throw new Error("Supabase indisponível.");
  const { error: delErr } = await supabase
    .from("document_requirements")
    .delete()
    .eq("development_id", developmentId);
  if (delErr) throw new Error(`Falha ao limpar customizações: ${delErr.message}`);

  const { data, error } = await supabase.rpc("seed_default_document_requirements", {
    target_development_id: developmentId,
  });
  if (error) throw new Error(`Falha ao restaurar defaults: ${error.message}`);
  return (data as number | null) ?? 0;
}
