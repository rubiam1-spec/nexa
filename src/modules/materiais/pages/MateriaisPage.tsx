import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { getPermissions } from "../../../shared/utils/permissoes";
import { timeAgo } from "../../../shared/utils/timeAgo";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
}

const ICONS: Record<string, string> = {
  folder: "\uD83D\uDCC1",
  image: "\uD83D\uDDBC\uFE0F",
  pdf: "\uD83D\uDCC4",
  video: "\uD83C\uDFAC",
  document: "\uD83D\uDCDD",
  spreadsheet: "\uD83D\uDCCA",
  presentation: "\uD83D\uDCCA",
  other: "\uD83D\uDCC2",
};

function getFileType(mime: string): string {
  if (mime.includes("folder")) return "folder";
  if (mime.includes("image")) return "image";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("video")) return "video";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation";
  if (mime.includes("document") || mime.includes("word") || mime.includes("text")) return "document";
  return "other";
}

function fmtSize(bytes: string | null): string {
  if (!bytes) return "";
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function MateriaisPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const perms = getPermissions(account?.role ?? null);
  const developmentId = development?.developmentId ?? null;

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Load folder_id from development
  useEffect(() => {
    if (!supabase || !developmentId) { setLoading(false); return; }
    supabase.from("developments").select("drive_folder_id").eq("id", developmentId).maybeSingle()
      .then(({ data }) => {
        setFolderId(data?.drive_folder_id ?? null);
        setLoading(false);
      });
  }, [developmentId]);

  // Fetch files from Drive
  const fetchFiles = useCallback(async (targetFolderId: string) => {
    if (!supabase) return;
    setLoading(true); setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const url = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${url}/functions/v1/drive-files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: targetFolderId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao buscar arquivos.");
      setFiles(data.files ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar materiais.");
      setFiles([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : folderId;
    if (id) void fetchFiles(id);
  }, [folderId, folderStack, fetchFiles]);

  function openFolder(file: DriveFile) {
    setFolderStack((s) => [...s, { id: file.id, name: file.name }]);
  }

  function goBack() {
    setFolderStack((s) => s.slice(0, -1));
  }

  // No folder configured
  if (!loading && !folderId) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 16px" }}>Materiais</h1>
        <div className="nexa-card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{"\uD83D\uDCC1"}</div>
          <div style={{ fontSize: 14, color: "var(--color-fog)", marginBottom: 16 }}>
            {perms.canAccessSettings
              ? "Nenhuma pasta conectada. Conecte uma pasta do Google Drive nas configurações do empreendimento."
              : "Materiais ainda não disponíveis para este empreendimento."}
          </div>
          {perms.canAccessSettings ? (
            <button type="button" onClick={() => navigate("/configuracoes")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Configurar
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const filtered = busca ? files.filter((f) => f.name.toLowerCase().includes(busca.toLowerCase())) : files;
  const folders = filtered.filter((f) => f.mimeType.includes("folder"));
  const nonFolders = filtered.filter((f) => !f.mimeType.includes("folder"));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Materiais</h1>
          {folderStack.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <button type="button" onClick={() => setFolderStack([])} style={{ background: "none", border: "none", color: "var(--color-fog)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "var(--font-mono)" }}>Raiz</button>
              {folderStack.map((f, i) => (
                <span key={f.id} style={{ fontSize: 12, color: "var(--color-fog)", fontFamily: "var(--font-mono)" }}>
                  {" / "}
                  <button type="button" onClick={() => setFolderStack((s) => s.slice(0, i + 1))} style={{ background: "none", border: "none", color: i === folderStack.length - 1 ? "var(--color-bone)" : "var(--color-fog)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "var(--font-mono)" }}>{f.name}</button>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>{development?.developmentName} · {files.length} arquivos</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%" }}>
          <input placeholder="Buscar arquivo..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "8px 14px", color: "var(--color-bone)", fontSize: 13, outline: "none", width: "100%", maxWidth: 200, minWidth: 120 }} />
          {folderStack.length > 0 ? <button type="button" onClick={goBack} style={{ background: "transparent", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "8px 14px", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>← Voltar</button> : null}
          <button type="button" onClick={() => { const id = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : folderId; if (id) void fetchFiles(id); }} style={{ background: "transparent", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "8px 14px", color: "var(--color-fog)", fontSize: 13, cursor: "pointer" }}>Atualizar</button>
        </div>
      </div>

      {loading ? <p style={{ color: "var(--color-fog)" }}>Carregando materiais...</p> : null}
      {error ? <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#F87171" }}>{error}</div> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="nexa-card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 14, color: "var(--color-fog)" }}>{busca ? "Nenhum arquivo encontrado para esta busca." : "Esta pasta está vazia."}</div>
        </div>
      ) : null}

      {/* Folders */}
      {folders.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {folders.map((f) => (
            <div key={f.id} onClick={() => openFolder(f)} style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 10, padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget).style.borderColor = "rgba(74,222,128,0.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.borderColor = "var(--color-stone)"; }}>
              <span style={{ fontSize: 24 }}>{ICONS.folder}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Files grid */}
      {nonFolders.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {nonFolders.map((f) => {
            const type = getFileType(f.mimeType);
            return (
              <a key={f.id} href={f.webViewLink ?? "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 10, overflow: "hidden", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget).style.borderColor = "rgba(74,222,128,0.3)"; }}
                  onMouseLeave={(e) => { (e.currentTarget).style.borderColor = "var(--color-stone)"; }}>
                  {/* Thumbnail or icon */}
                  <div style={{ height: 120, background: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {f.thumbnailLink ? (
                      <img src={f.thumbnailLink} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 40 }}>{ICONS[type] ?? ICONS.other}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "var(--color-fog)", fontFamily: "var(--font-mono)", display: "flex", gap: 8 }}>
                      {fmtSize(f.size) ? <span>{fmtSize(f.size)}</span> : null}
                      {f.modifiedTime ? <span>{timeAgo(f.modifiedTime)}</span> : null}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
