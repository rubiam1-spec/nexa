import { getSupabaseClientOrThrow } from "./baseRepository";

// Colunas livres do Quadro de Atividades. RLS: todos da conta leem; só
// owner/director/manager escrevem (validado no banco — UI também esconde).
export type BoardColumnRow = {
  id: string;
  account_id: string;
  development_id: string | null;
  name: string;
  color: string;
  position: number;
  completes_activity: boolean;
};

export type CreateColumnInput = {
  accountId: string;
  developmentId?: string | null;
  name: string;
  color: string;
  position: number;
  completesActivity?: boolean;
};

export type UpdateColumnPatch = {
  name?: string;
  color?: string;
  position?: number;
  completes_activity?: boolean;
};

export async function fetchColumns(accountId: string): Promise<BoardColumnRow[]> {
  const client = getSupabaseClientOrThrow("boardColumnsRepository.fetchColumns");
  const { data, error } = await client
    .from("board_columns")
    .select("id, account_id, development_id, name, color, position, completes_activity")
    .eq("account_id", accountId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BoardColumnRow[];
}

export async function createColumn(input: CreateColumnInput): Promise<BoardColumnRow> {
  const client = getSupabaseClientOrThrow("boardColumnsRepository.createColumn");
  const { data, error } = await client
    .from("board_columns")
    .insert({
      account_id: input.accountId,
      development_id: input.developmentId ?? null,
      name: input.name,
      color: input.color,
      position: input.position,
      completes_activity: input.completesActivity ?? false,
    })
    .select("id, account_id, development_id, name, color, position, completes_activity")
    .single();
  if (error) throw error;
  return data as BoardColumnRow;
}

// updateColumn retorna linhas afetadas — caller usa .length p/ detectar
// bloqueio de RLS sem exception (UPDATE bloqueado retorna 0 linhas).
export async function updateColumn(
  id: string,
  patch: UpdateColumnPatch,
): Promise<BoardColumnRow[]> {
  const client = getSupabaseClientOrThrow("boardColumnsRepository.updateColumn");
  const { data, error } = await client
    .from("board_columns")
    .update(patch)
    .eq("id", id)
    .select("id, account_id, development_id, name, color, position, completes_activity");
  if (error) throw error;
  return (data ?? []) as BoardColumnRow[];
}

export async function deleteColumn(id: string): Promise<void> {
  const client = getSupabaseClientOrThrow("boardColumnsRepository.deleteColumn");
  const { error } = await client.from("board_columns").delete().eq("id", id);
  if (error) throw error;
}
