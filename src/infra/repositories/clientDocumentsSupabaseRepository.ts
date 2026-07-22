import { supabase } from "../supabase/supabaseClient";

// Repositório (Supabase-only) do checklist de documentos do cliente.
// O CHECKLIST (tipos exigidos) vem de document_requirements(primary_buyer) +
// document_type_catalog — NÃO mais de document_type_configs (deprecada).
// O bucket client-documents é PRIVADO: upload + signed URL.

export interface ClientDoc {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  storage_path: string | null;
  uploaded_by: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  is_required: boolean;
  label: string | null;
}

// Tipo do checklist consumido pela ficha (mesmo shape que o antigo
// effectiveDocTypes para não mexer no render).
export interface ChecklistType {
  key: string;
  label: string;
  required: boolean;
  description?: string | null;
}

const CLIENT_DOC_COLS =
  "id, document_type, file_url, file_name, file_size, file_size_bytes, mime_type, storage_path, uploaded_by, status, rejection_reason, created_at, is_required, label";

export async function listClientDocuments(clientId: string): Promise<ClientDoc[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("client_documents")
    .select(CLIENT_DOC_COLS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientDoc[];
}

// Checklist canônico: requirements primary_buyer do empreendimento do cliente
// (ou fallback de conta) + label/descrição do catálogo. Espelha o trigger
// seed_documents_for_new_client.
export async function listChecklist(
  developmentId: string | null,
  accountId: string,
): Promise<ChecklistType[]> {
  if (!supabase) return [];
  // Catálogo (label/descrição/ordem)
  const { data: cat, error: catErr } = await supabase
    .from("document_type_catalog")
    .select("id, label, description, display_order")
    .eq("is_active", true);
  if (catErr) throw catErr;
  const catById = new Map(
    (cat ?? []).map((c: Record<string, unknown>) => [c.id as string, c]),
  );

  let reqRows: Record<string, unknown>[] = [];
  if (developmentId) {
    const { data, error } = await supabase
      .from("document_requirements")
      .select("document_type_id, is_required, display_order")
      .eq("development_id", developmentId)
      .eq("party_role", "primary_buyer");
    if (error) throw error;
    reqRows = (data ?? []) as Record<string, unknown>[];
  } else {
    // Fallback de conta: tipos distintos primary_buyer (obrigatório se exigido
    // em qualquer empreendimento da conta).
    const { data, error } = await supabase
      .from("document_requirements")
      .select("document_type_id, is_required")
      .eq("account_id", accountId)
      .eq("party_role", "primary_buyer");
    if (error) throw error;
    const agg = new Map<string, boolean>();
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const t = r.document_type_id as string;
      agg.set(t, (agg.get(t) ?? false) || Boolean(r.is_required));
    }
    reqRows = Array.from(agg.entries()).map(([document_type_id, is_required]) => ({
      document_type_id,
      is_required,
    }));
  }

  return reqRows
    .map((r) => {
      const c = catById.get(r.document_type_id as string);
      return {
        key: r.document_type_id as string,
        label: (c?.label as string) ?? (r.document_type_id as string),
        required: Boolean(r.is_required),
        description: (c?.description as string) ?? null,
        _order: Number((c?.display_order as number) ?? 9999),
      };
    })
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...rest }) => { void _order; return rest; });
}

export async function uploadClientDocument(opts: {
  clientId: string;
  accountId: string;
  docType: string;
  file: File;
  userId: string;
}): Promise<{ signedUrl: string; storagePath: string }> {
  if (!supabase) throw new Error("Supabase indisponível.");
  const { clientId, accountId, docType, file, userId } = opts;
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${accountId}/${clientId}/${docType}_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file);
  if (upErr) throw upErr;
  const { data: signed } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  const signedUrl = signed?.signedUrl || path;
  const { error: insErr } = await supabase.from("client_documents").insert({
    client_id: clientId,
    account_id: accountId,
    document_type: docType,
    file_url: signedUrl,
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    file_size_bytes: file.size,
    mime_type: file.type,
    status: "sent",
    uploaded_by: userId,
    uploaded_at: new Date().toISOString(),
  });
  if (insErr) throw insErr;
  return { signedUrl, storagePath: path };
}

export async function reviewClientDocument(
  docId: string,
  action: "approved" | "rejected",
  reason: string | null,
  userId: string,
): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível.");
  const { error } = await supabase
    .from("client_documents")
    .update({
      status: action,
      rejection_reason: reason,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", docId);
  if (error) throw error;
}

export async function approveClientDocuments(docIds: string[], userId: string): Promise<void> {
  if (!supabase || docIds.length === 0) return;
  const { error } = await supabase
    .from("client_documents")
    .update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .in("id", docIds);
  if (error) throw error;
}

export async function resetClientDocument(docId: string, storagePath: string | null): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível.");
  if (storagePath) {
    await supabase.storage.from("client-documents").remove([storagePath]);
  }
  const { error } = await supabase
    .from("client_documents")
    .update({
      storage_path: null, file_url: null, file_name: null, file_size: null,
      file_size_bytes: null, mime_type: null, uploaded_by: null, uploaded_at: null,
      reviewed_by: null, reviewed_at: null, rejection_reason: null, status: "pending",
    })
    .eq("id", docId);
  if (error) throw error;
}

// Recalcula doc_status do cliente a partir dos status atuais dos documentos.
export async function recalcClientDocStatus(
  clientId: string,
): Promise<{ approved: number; total: number; status: string | null }> {
  if (!supabase) return { approved: 0, total: 0, status: null };
  const { data } = await supabase.from("client_documents").select("status").eq("client_id", clientId);
  const rows = (data ?? []) as { status: string }[];
  if (rows.length === 0) return { approved: 0, total: 0, status: null };
  const approved = rows.filter((d) => d.status === "approved").length;
  const rejected = rows.filter((d) => d.status === "rejected").length;
  const total = rows.length;
  const status = approved === total ? "approved" : rejected > 0 ? "needs_resubmission" : "in_review";
  await supabase.from("clients").update({ doc_status: status }).eq("id", clientId);
  return { approved, total, status };
}

// Completude para o gate de avanço da venda: "completo" = todos os documentos
// OBRIGATÓRIOS (is_required=true) com status='approved'. Opcionais NÃO contam.
// NÃO confundir com clients.doc_status='approved' (que exige também opcionais).
export async function areRequiredDocsApproved(
  clientId: string,
): Promise<{ requiredTotal: number; requiredApproved: number; complete: boolean; pendingLabels: string[] }> {
  const empty = { requiredTotal: 0, requiredApproved: 0, complete: false, pendingLabels: [] };
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("client_documents")
    .select("status, is_required, label, document_type")
    .eq("client_id", clientId)
    .eq("is_required", true);
  if (error) throw error;
  const rows = (data ?? []) as { status: string; label: string | null; document_type: string }[];
  const requiredTotal = rows.length;
  const requiredApproved = rows.filter((r) => r.status === "approved").length;
  const pendingLabels = rows
    .filter((r) => r.status !== "approved")
    .map((r) => r.label || r.document_type);
  return {
    requiredTotal,
    requiredApproved,
    complete: requiredTotal > 0 && requiredApproved === requiredTotal,
    pendingLabels,
  };
}

export async function getDocUploader(docId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("client_documents")
    .select("uploaded_by")
    .eq("id", docId)
    .maybeSingle();
  return (data?.uploaded_by as string) ?? null;
}

export async function listAccountManagers(accountId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("user_account_access")
    .select("user_id")
    .eq("account_id", accountId)
    .in("role", ["owner", "director", "manager"]);
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
}
