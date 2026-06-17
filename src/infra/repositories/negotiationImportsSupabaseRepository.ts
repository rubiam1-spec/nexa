// Persistência Supabase-only do importador de negociações.
// Retorna dados de domínio; o commit é transacional via RPC SECURITY DEFINER.
import { getSupabaseClientOrThrow } from "./baseRepository";
import type { BrokerCandidate, CommitRow, UnitCandidate } from "../../services/negotiationImport";

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
    .select("id, name")
    .eq("account_id", accountId);
  if (error) throw new Error(`Falha ao carregar corretores: ${error.message}`);
  return (data ?? []).map((b) => ({ id: String(b.id), name: String(b.name ?? "") }));
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

export async function undoImport(batchId: string): Promise<{ archived: number }> {
  const supabase = getSupabaseClientOrThrow("negotiation imports repository");
  const { data, error } = await supabase.rpc("undo_negotiation_import", { p_batch_id: batchId });
  if (error) throw new Error(`Falha ao desfazer importação: ${error.message}`);
  const r = (data ?? {}) as Record<string, unknown>;
  return { archived: Number(r.archived ?? 0) };
}
