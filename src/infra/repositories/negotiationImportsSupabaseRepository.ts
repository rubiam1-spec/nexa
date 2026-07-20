// Persistência Supabase-only do importador de negociações.
// Retorna dados de domínio; o commit é transacional via RPC SECURITY DEFINER.
import { getSupabaseClientOrThrow } from "./baseRepository";
import type {
  BrokerCandidate,
  ClientCandidate,
  CommitRow,
  UnitCandidate,
} from "../../services/negotiationImport";

export type CommitImportInput = {
  accountId: string;
  developmentId: string | null;
  fileName: string;
  sheetName: string | null;
  columnMapping: Record<string, string>;
  statusMapping: Record<string, string>;
  defaultValues?: Record<string, unknown>;
  duplicateStrategy: "skip" | "update" | "create";
  permutaOutOfVgv: boolean;
  totalRows: number;
  rows: CommitRow[];
};

export type CommitImportResult = {
  batchId: string;
  imported: number;
  skipped: number;
  duplicates: number;
  errorsCount: number;
  errors: Array<{ row: number; error: string }>;
};

export async function loadBrokers(accountId: string): Promise<BrokerCandidate[]> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const { data, error } = await supabase
    .from("brokers")
    .select("id, name, brokerage_name")
    .eq("account_id", accountId);
  if (error) throw new Error(`Falha ao carregar corretores: ${error.message}`);
  return (data ?? []).map((b) => ({
    id: String(b.id),
    name: String(b.name ?? ""),
    brokerageName: b.brokerage_name ? String(b.brokerage_name) : null,
  }));
}

export async function loadClients(accountId: string): Promise<ClientCandidate[]> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("account_id", accountId);
  if (error) throw new Error(`Falha ao carregar contatos: ${error.message}`);
  return (data ?? [])
    .map((c) => ({ id: String(c.id), name: String(c.name ?? "") }))
    .filter((c) => c.name);
}

export async function loadUnits(
  accountId: string,
  developmentId: string,
): Promise<UnitCandidate[]> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const { data, error } = await supabase
    .from("units")
    .select("id, quadra, lote, status")
    .eq("account_id", accountId)
    .eq("development_id", developmentId);
  if (error) throw new Error(`Falha ao carregar unidades: ${error.message}`);
  return (data ?? []).map((u) => ({
    id: String(u.id),
    quadra: String(u.quadra ?? ""),
    lote: String(u.lote ?? ""),
    status: String(u.status ?? ""),
  }));
}

export async function commitImport(input: CommitImportInput): Promise<CommitImportResult> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const payload = {
    account_id: input.accountId,
    development_id: input.developmentId,
    file_name: input.fileName,
    sheet_name: input.sheetName,
    column_mapping: input.columnMapping,
    status_mapping: input.statusMapping,
    default_values: input.defaultValues ?? {},
    duplicate_strategy: input.duplicateStrategy,
    permuta_out_of_vgv: input.permutaOutOfVgv,
    total_rows: input.totalRows,
    rows: input.rows,
  };
  const { data, error } = await supabase.rpc("commit_negotiation_import", { p_payload: payload });
  if (error) throw new Error(`Falha ao importar: ${error.message}`);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    batchId: String(r.batch_id ?? ""),
    imported: Number(r.imported ?? 0),
    skipped: Number(r.skipped ?? 0),
    duplicates: Number(r.duplicates ?? 0),
    errorsCount: Number(r.errors_count ?? 0),
    errors: Array.isArray(r.errors) ? (r.errors as Array<{ row: number; error: string }>) : [],
  };
}

// Contrato do undo (hard-delete com trava): remove as negociações do lote e
// preserva contatos/corretores (a fila de leads nunca é destruída pelo desfazer).
export type UndoImportResult = {
  deleted: number; // negociações removidas
  clientsKept: number; // contatos preservados
  brokersKept: number; // corretores preservados
};

// Traduz os códigos de exceção da RPC undo_negotiation_import para PT-BR.
// A trava de segurança do banco aborta o undo quando há registros downstream.
function mapUndoError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("batch_has_downstream_records"))
    return "Não é possível desfazer: há registros criados a partir deste lote (propostas, reservas, vendas ou atividades). Desfaça-os antes de remover a importação.";
  if (m.includes("batch_not_committed"))
    return "Este lote não está confirmado — não há importação a desfazer.";
  if (m.includes("batch_not_found")) return "Lote de importação não encontrado.";
  if (m.includes("forbidden")) return "Você não tem permissão para desfazer importações.";
  if (m.includes("not_authenticated")) return "Sessão expirada. Faça login novamente.";
  return `Falha ao desfazer importação: ${message}`;
}

// Resumo de um lote de importação para o histórico permanente (UI).
export type ImportBatchSummary = {
  batchId: string;
  fileName: string;
  sheetName: string | null;
  status: string; // 'committed' | 'undone' | 'reviewing'
  totalRows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
  createdAt: string | null; // committed_at quando houver, senão created_at
};

// Lista os lotes de importação da conta (mais recentes primeiro). A RLS
// (neg_imports_select) já restringe ao account_id do usuário autenticado.
export async function listImports(accountId: string): Promise<ImportBatchSummary[]> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const { data, error } = await supabase
    .from("negotiation_imports")
    .select(
      "id, file_name, sheet_name, status, total_rows, imported_count, skipped_count, duplicate_count, error_count, committed_at, created_at",
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar histórico de importações: ${error.message}`);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      batchId: String(row.id),
      fileName: String(row.file_name ?? "(sem nome)"),
      sheetName: row.sheet_name ? String(row.sheet_name) : null,
      status: String(row.status ?? ""),
      totalRows: Number(row.total_rows ?? 0),
      imported: Number(row.imported_count ?? 0),
      skipped: Number(row.skipped_count ?? 0),
      duplicates: Number(row.duplicate_count ?? 0),
      errors: Number(row.error_count ?? 0),
      createdAt: (row.committed_at as string) ?? (row.created_at as string) ?? null,
    };
  });
}

export async function undoImport(batchId: string): Promise<UndoImportResult> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const { data, error } = await supabase.rpc("undo_negotiation_import", { p_batch_id: batchId });
  if (error) throw new Error(mapUndoError(error.message ?? ""));
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    deleted: Number(r.deleted ?? 0),
    clientsKept: Number(r.clients_kept ?? 0),
    brokersKept: Number(r.brokers_kept ?? 0),
  };
}
