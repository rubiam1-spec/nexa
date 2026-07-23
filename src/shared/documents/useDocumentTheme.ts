// Documentos Temáveis v3 · hook de leitura do tema (config UI + gatilho do PDF).
// Devolve a linha crua + o tema resolvido (tokens). A escrita é feita direto
// pelos repositórios (save/upload) na tela de Configurações.
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDocumentThemeRow } from "../../infra/repositories/accountDocumentThemeSupabaseRepository";
import { resolveDocumentTheme, type DocumentThemeRow } from "./documentTheme";

export function useDocumentTheme(accountId: string | null) {
  const [row, setRow] = useState<DocumentThemeRow | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!accountId) { setRow(null); return; }
    setLoading(true);
    try { setRow(await getDocumentThemeRow(accountId)); }
    catch { setRow(null); }
    finally { setLoading(false); }
  }, [accountId]);

  useEffect(() => { void reload(); }, [reload]);

  const theme = useMemo(() => resolveDocumentTheme(row), [row]);
  return { row, theme, loading, reload, setRow };
}
