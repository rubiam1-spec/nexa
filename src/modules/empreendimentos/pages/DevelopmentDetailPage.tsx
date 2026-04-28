import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAccount } from "../../../app/contexts/AccountContext";
import type { DevelopmentContextData } from "../../../shared/types/development";
import type { Unidade } from "../../../domain/unidade/Unidade";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { getUnidadeStatusLabel } from "../../../domain/unidade/UnidadeStatusLabel";
import NexaBadge from "../../../shared/components/NexaBadge";
import { getDevelopmentById, updateDevelopment } from "../../../infra/repositories/developmentsSupabaseRepository";
import { getUnits, createUnit, createUnitsInBulk, updateUnit, deleteUnit } from "../../../infra/repositories/unitsSupabaseRepository";
import { getMaterials, createMaterial, uploadMaterialFile, type Material } from "../../../infra/repositories/materialsSupabaseRepository";
import { deleteSalesByDevelopment } from "../../../infra/repositories/salesSupabaseRepository";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import {
  extractFolderIdFromUrl,
  listFolderFiles,
  detectMaterialType,
  type DriveFile,
} from "../../../shared/services/googleDriveService";
import { useDocumentRequirements } from "../hooks/useDocumentRequirements";
import {
  PARTY_ROLE_LABEL,
  type PartyRole,
  type RequirementCellState,
} from "../../../shared/types/documentRequirement";

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 600 };
const btnD: React.CSSProperties = { background: "transparent", color: "var(--color-red)", border: "1px solid var(--color-red-muted)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 600 };
const sTitle: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-sprout)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 };

function fmt(v: number) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Sprint B.3.0a — papéis visíveis na matriz de documentos.
// beneficial_owner fica oculto até a Sprint B.7 (PJ).
const VISIBLE_PARTY_ROLES: PartyRole[] = [
  "primary_buyer",
  "spouse",
  "co_obligor",
  "attorney_in_fact",
];

function computeCellState(
  requirements: { partyRole: PartyRole; documentTypeId: string; isRequired: boolean }[],
  partyRole: PartyRole,
  documentTypeId: string,
): RequirementCellState {
  const req = requirements.find(
    (r) => r.partyRole === partyRole && r.documentTypeId === documentTypeId,
  );
  if (!req) return "missing";
  return req.isRequired ? "required" : "optional";
}

function RequirementCell({
  state,
  loading,
  onToggle,
}: {
  state: RequirementCellState;
  loading: boolean;
  onToggle: () => void;
}) {
  const config =
    state === "required"
      ? { icon: "✓", color: "var(--color-sprout)", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.3)" }
      : state === "optional"
        ? { icon: "○", color: "#FBBF24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" }
        : { icon: "—", color: "#5C5647", bg: "transparent", border: "rgba(61,58,48,0.3)" };
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      aria-label={state === "required" ? "Obrigatório" : state === "optional" ? "Opcional" : "Não pedido"}
      style={{
        width: 36,
        height: 36,
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 6,
        color: config.color,
        fontSize: 16,
        fontWeight: 700,
        cursor: loading ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: loading ? 0.5 : 1,
        transition: "all 150ms ease",
        padding: 0,
      }}
    >
      {loading ? "…" : config.icon}
    </button>
  );
}

type Tab = "unidades" | "materiais" | "documentos-requeridos";

export default function DevelopmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { account } = useAccount();
  const isMobile = useIsMobile();
  const accountId = account?.accountId ?? null;

  const tabParam = searchParams.get("tab");
  const activeTab: Tab =
    tabParam === "materiais" ? "materiais" :
    tabParam === "documentos-requeridos" ? "documentos-requeridos" :
    "unidades";
  function switchTab(tab: Tab) {
    setSearchParams(tab === "unidades" ? {} : { tab }, { replace: true });
  }

  const [dev, setDev] = useState<DevelopmentContextData | null>(null);
  const [units, setUnits] = useState<Unidade[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Unit form
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [uQuadra, setUQuadra] = useState(""); const [uLote, setULote] = useState("");
  const [uArea, setUArea] = useState(""); const [uValor, setUValor] = useState("");
  const [savingUnit, setSavingUnit] = useState(false);

  // Edit unit
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [euQuadra, setEuQuadra] = useState(""); const [euLote, setEuLote] = useState("");
  const [euArea, setEuArea] = useState(""); const [euValor, setEuValor] = useState("");

  // Material form
  const [showMatForm, setShowMatForm] = useState(false);
  const [mTipo, setMTipo] = useState("link"); const [mTitulo, setMTitulo] = useState("");
  const [mUrl, setMUrl] = useState(""); const [mFile, setMFile] = useState<File | null>(null);
  const [savingMat, setSavingMat] = useState(false);

  // Dropdown menus
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showMatDropdown, setShowMatDropdown] = useState(false);
  const [matAction, setMatAction] = useState<"none" | "drive-link" | "drive-oauth" | "upload" | "link">("none");
  const unitsDropRef = useRef<HTMLDivElement>(null);
  const matDropRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (unitsDropRef.current && !unitsDropRef.current.contains(e.target as Node)) setShowUnitsDropdown(false);
      if (matDropRef.current && !matDropRef.current.contains(e.target as Node)) setShowMatDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Google Drive import
  const [driveMode, setDriveMode] = useState<"none" | "link" | "oauth">("none");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveSelected, setDriveSelected] = useState<Set<string>>(new Set());
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [importingDrive, setImportingDrive] = useState(false);
  const [showDriveTutorial, setShowDriveTutorial] = useState(false);
  const [driveFolderStack, setDriveFolderStack] = useState<{ id: string; name: string }[]>([]);

  // Success message
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inline delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearSales, setConfirmClearSales] = useState(false);
  const [clearingSales, setClearingSales] = useState(false);

  // Sprint B.3.0a — matriz de documentos requeridos do empreendimento
  const docRequirements = useDocumentRequirements(id ?? null, accountId);
  const [showRestoreDefaultsConfirm, setShowRestoreDefaultsConfirm] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);

  // Unit form autoFocus
  const unitQuadraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showUnitForm) unitQuadraRef.current?.focus();
  }, [showUnitForm]);

  // CSV import
  type CsvRow = { quadra: string; lote: string; area: number | null; valor: number | null; observacoes: string };
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // AI import
  type AiRow = { quadra: string; lote: string; area: number | null; valor: number | null; status: string; socio_permutante: boolean };
  const [aiPreview, setAiPreview] = useState<AiRow[]>([]);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [importingAi, setImportingAi] = useState(false);

  useEffect(() => {
    if (!id || !accountId) return;
    let m = true;
    setLoading(true);
    Promise.all([
      getDevelopmentById(id),
      getUnits(accountId, id),
      getMaterials(accountId, id),
    ]).then(([d, u, mat]) => {
      if (!m) return;
      setDev(d);
      if (d) { setEditName(d.developmentName); setEditCity(d.city ?? ""); setEditState(d.state ?? ""); setEditDesc(d.description ?? ""); }
      setUnits(u);
      setMaterials(mat);
    }).catch((e: unknown) => { if (m) setError(e instanceof Error ? e.message : "Falha ao carregar."); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [id, accountId]);

  if (loading) return <p style={{ color: "var(--color-fog)" }}>Carregando empreendimento...</p>;
  if (!dev) return <p style={{ color: "var(--color-fog)" }}>Empreendimento não encontrado.</p>;

  const vgv = units.reduce((s, u) => s + u.valor, 0);
  const countBy = (st: string) => units.filter((u) => u.status === st).length;

  async function handleSaveDev() {
    if (!id) return;
    setSaving(true); setError(null); setSuccessMsg(null);
    try {
      const updated = await updateDevelopment(id, { name: editName.trim(), city: editCity.trim(), state: editState.trim(), description: editDesc.trim() });
      setDev(updated);
      setSuccessMsg("Alterações salvas com sucesso");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }

  async function handleAddUnit() {
    if (!accountId || !id || !uQuadra.trim() || !uLote.trim() || !uValor.trim()) return;
    setSavingUnit(true);
    try {
      const u = await createUnit({ accountId, developmentId: id, quadra: uQuadra.trim(), lote: uLote.trim(), valor: Number(uValor) });
      setUnits((p) => [u, ...p]); setShowUnitForm(false);
      setUQuadra(""); setULote(""); setUArea(""); setUValor("");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha."); }
    finally { setSavingUnit(false); }
  }

  function startEditUnit(u: Unidade) {
    setEditingUnitId(u.id); setEuQuadra(u.quadra); setEuLote(u.lote); setEuValor(u.valor.toString()); setEuArea("");
  }

  async function handleSaveUnit() {
    if (!editingUnitId) return;
    try {
      const updated = await updateUnit(editingUnitId, { quadra: euQuadra.trim(), lote: euLote.trim(), valor: Number(euValor), area: euArea ? Number(euArea) : null });
      setUnits((p) => p.map((u) => u.id === updated.id ? updated : u));
      setEditingUnitId(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha."); }
  }

  async function handleDeleteUnit(unitId: string) {
    try {
      await deleteUnit(unitId);
      setUnits((p) => p.filter((u) => u.id !== unitId));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao excluir."); }
  }

  async function handleClearSales() {
    if (!id) return;
    setClearingSales(true);
    try {
      await deleteSalesByDevelopment(id);
      setUnits((prev) => prev.map((u) => u.status === UnidadeStatus.VENDIDO ? { ...u, status: UnidadeStatus.DISPONIVEL } : u));
      setConfirmClearSales(false);
      setSuccessMsg("Todas as vendas foram removidas.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao limpar vendas.");
    } finally {
      setClearingSales(false);
    }
  }

  async function handleAddMaterial() {
    if (!accountId || !id || !mTitulo.trim()) return;
    setSavingMat(true);
    try {
      let fileUrl = mUrl.trim() || undefined;
      if ((mTipo === "imagem" || mTipo === "pdf") && mFile) {
        fileUrl = await uploadMaterialFile(mFile, accountId, id);
      }
      const mat = await createMaterial({ accountId, developmentId: id, tipo: mTipo, titulo: mTitulo.trim(), fileUrl });
      setMaterials((p) => [...p, mat]); setShowMatForm(false);
      setMTitulo(""); setMUrl(""); setMFile(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha."); }
    finally { setSavingMat(false); }
  }

  async function handleDriveFolderLoad() {
    const folderId = extractFolderIdFromUrl(driveFolderUrl);
    if (!folderId) {
      setDriveError("Link inválido. Cole o link de uma pasta compartilhada do Google Drive.");
      return;
    }
    setDriveLoading(true); setDriveError(null);
    try {
      const files = await listFolderFiles(folderId);
      setDriveFiles(files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder"));
      setDriveSelected(new Set(files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder").map((f) => f.id)));
    } catch (e: unknown) {
      setDriveError(e instanceof Error ? e.message : "Falha ao carregar pasta.");
    } finally { setDriveLoading(false); }
  }

  function toggleDriveFile(fileId: string) {
    setDriveSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  }

  async function handleDriveImport() {
    if (!accountId || !id || driveSelected.size === 0) return;
    setImportingDrive(true); setDriveError(null);
    try {
      const selectedFiles = driveFiles.filter((f) => driveSelected.has(f.id));
      const created: Material[] = [];
      for (const file of selectedFiles) {
        const tipo = detectMaterialType(file.mimeType);
        if (tipo === "folder") continue;
        const mat = await createMaterial({
          accountId, developmentId: id,
          tipo,
          titulo: file.name,
          fileUrl: file.webViewLink,
        });
        created.push(mat);
      }
      setMaterials((p) => [...p, ...created]);
      setSuccessMsg(`${created.length} materiais importados do Google Drive.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setDriveMode("none"); setDriveFiles([]); setDriveSelected(new Set()); setDriveFolderUrl("");
    } catch (e: unknown) {
      setDriveError(e instanceof Error ? e.message : "Falha na importação.");
    } finally { setImportingDrive(false); }
  }

  async function handleDriveOAuthLoad(folderId = "root") {
    setDriveLoading(true); setDriveError(null);
    try {
      const files = await listFolderFiles(folderId);
      // Separate folders from files
      const folders = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
      const nonFolders = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");
      setDriveFiles([...folders, ...nonFolders]);
      setDriveSelected(new Set(nonFolders.map((f) => f.id)));
    } catch (e: unknown) {
      setDriveError(e instanceof Error ? e.message : "Falha ao carregar arquivos do Drive.");
    } finally { setDriveLoading(false); }
  }

  function navigateDriveFolder(folderId: string, folderName: string) {
    setDriveFolderStack((prev) => [...prev, { id: folderId, name: folderName }]);
    void handleDriveOAuthLoad(folderId);
  }

  function navigateDriveBack() {
    setDriveFolderStack((prev) => {
      const next = prev.slice(0, -1);
      const parentId = next.length > 0 ? next[next.length - 1].id : "root";
      void handleDriveOAuthLoad(parentId);
      return next;
    });
  }


  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setError("CSV vazio ou sem dados."); return; }
      const rows: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const quadra = cols[0] ?? "";
        const lote = cols[1] ?? "";
        if (!quadra || !lote) continue;
        rows.push({
          quadra,
          lote,
          area: cols[2] ? Number(cols[2]) || null : null,
          valor: cols[3] ? Number(cols[3]) || null : null,
          observacoes: cols[4] ?? "",
        });
      }
      setCsvPreview(rows);
      setShowCsvPreview(true);
      setImportResult(null);
    };
    reader.readAsText(file);
  }

  async function handleCsvImport() {
    if (!accountId || !id || csvPreview.length === 0) return;
    setImportingCsv(true); setError(null); setImportResult(null);
    try {
      const insertRows = csvPreview.map((r) => ({
        accountId: accountId!,
        developmentId: id!,
        quadra: r.quadra,
        lote: r.lote,
        valor: r.valor ?? 0,
        area: r.area ?? undefined,
      }));
      const created = await createUnitsInBulk(insertRows);
      setUnits((p) => [...created, ...p]);
      setImportResult(`${created.length} unidades importadas com sucesso.`);
      setCsvPreview([]); setShowCsvPreview(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha na importação."); }
    finally { setImportingCsv(false); }
  }

  async function handleAiFile(file: File) {
    setAiProcessing(true); setError(null); setImportResult(null); setAiProgress("");
    try {
      let textContent: string;
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        textContent = XLSX.utils.sheet_to_csv(ws);
      } else {
        textContent = await file.text();
      }

      if (!supabase) throw new Error("Supabase não configurado.");

      const lines = textContent.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("Arquivo vazio ou sem dados.");

      const header = lines[0];
      const dataLines = lines.slice(1);
      const CHUNK_SIZE = 60;
      const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);
      const allUnidades: AiRow[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, dataLines.length);
        setAiProgress(`Processando lotes ${start + 1}-${end} de ${dataLines.length}...`);

        const chunkCsv = [header, ...dataLines.slice(start, end)].join("\n");

        const { data, error: fnError } = await supabase.functions.invoke("import-units-ai", {
          body: { conteudo: chunkCsv },
        });

        if (fnError) throw new Error(fnError.message ?? "Falha na Edge Function.");
        if (data?.error) throw new Error(data.error);

        const unidades: AiRow[] = (data?.unidades ?? []).map((u: Record<string, unknown>) => ({
          quadra: String(u.quadra ?? ""),
          lote: String(u.lote ?? ""),
          area: typeof u.area === "number" ? u.area : null,
          valor: typeof u.valor === "number" ? u.valor : null,
          status: String(u.status ?? "available"),
          socio_permutante: Boolean(u.socio_permutante),
        })).filter((u: AiRow) => u.quadra && u.lote);

        allUnidades.push(...unidades);
      }

      setAiPreview(allUnidades);
      setShowAiPreview(true);
      setAiProgress("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha na análise com IA.");
    } finally {
      setAiProcessing(false);
      setAiProgress("");
    }
  }

  async function handleAiImport() {
    if (!accountId || !id || aiPreview.length === 0) return;
    setImportingAi(true); setError(null);
    try {
      const rows = aiPreview.map((r) => ({
        accountId: accountId!,
        developmentId: id!,
        quadra: r.quadra,
        lote: r.lote,
        valor: r.valor ?? 0,
        area: r.area ?? undefined,
        socioPermutante: r.socio_permutante,
        status: r.status === "sold" ? "sold" : r.status === "reserved" ? "reserved" : "available",
      }));
      const created = await createUnitsInBulk(rows);
      setUnits((p) => [...created, ...p]);
      setImportResult(`${created.length} unidades importadas com IA.`);
      setAiPreview([]); setShowAiPreview(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha na importação."); }
    finally { setImportingAi(false); }
  }

  function downloadCsvTemplate() {
    const csv = "quadra,lote,area,valor,observacoes\nQ1,1,360,180000,Lote de esquina\nQ1,2,300,165000,";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_unidades.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const tipoLabels: Record<string, string> = { imagem: "Imagem", video: "Vídeo", pdf: "PDF", link: "Link" };
  const tipoColors: Record<string, { color: string; bg: string }> = {
    imagem: { color: "var(--color-sprout)", bg: "var(--color-sprout-muted)" },
    video: { color: "var(--color-blue)", bg: "var(--color-blue-muted)" },
    pdf: { color: "var(--color-terracotta)", bg: "var(--color-terracotta-muted)" },
    link: { color: "var(--color-purple)", bg: "var(--color-purple-muted)" },
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--color-sprout)" : "2px solid transparent",
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? "var(--color-sprout)" : "var(--color-fog)",
    cursor: "pointer",
    transition: "color 150ms ease, border-color 150ms ease",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.04em",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-fog)", marginBottom: 12 }}>
          <Link to="/empreendimentos" style={{ color: "var(--color-fog)" }}>Empreendimentos</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          <span style={{ color: "var(--color-dust)" }}>{dev.developmentName}</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>{dev.developmentName}</h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>
          {[dev.city, dev.state].filter(Boolean).join(" · ") || "Sem localização"} · VGV R$ {fmt(vgv)}
        </div>
      </div>

      {error ? <p style={{ color: "var(--color-red)", fontSize: 12, marginBottom: 16 }}>{error}</p> : null}

      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>
          {successMsg}
        </div>
      ) : null}

      {/* SEÇÃO 1 — Informações */}
      <div className="nexa-card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={sTitle}>Informações gerais</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, maxWidth: 600, marginBottom: 16 }}>
          <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome</span><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
          <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} /></label>
          <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Estado</span><input type="text" value={editState} onChange={(e) => setEditState(e.target.value)} /></label>
          <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Descrição</span><input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></label>
        </div>
        <button type="button" disabled={saving} onClick={() => void handleSaveDev()} style={btnP}>{saving ? "Salvando..." : "Salvar alterações"}</button>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-stone)", marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => switchTab("unidades")} style={tabStyle(activeTab === "unidades")}>
          Unidades ({units.length})
        </button>
        <button type="button" onClick={() => switchTab("documentos-requeridos")} style={tabStyle(activeTab === "documentos-requeridos")}>
          Documentos requeridos
        </button>
        <button type="button" onClick={() => navigate("/materiais")} style={tabStyle(false)}>
          Materiais →
        </button>
      </div>

      {/* ═══ ABA UNIDADES ═══ */}
      {activeTab === "unidades" ? (
        <div className="nexa-card" style={{ padding: 20 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total", value: units.length },
              { label: "Disponíveis", value: countBy(UnidadeStatus.DISPONIVEL) },
              { label: "Em negociação", value: countBy(UnidadeStatus.EM_NEGOCIACAO) },
              { label: "Reservadas", value: countBy(UnidadeStatus.RESERVADO) },
              { label: "Vendidas", value: countBy(UnidadeStatus.VENDIDO) },
            ].map((kpi) => (
              <div key={kpi.label} style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "12px 16px" }}>
                <div className="nexa-label" style={{ marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-bone)" }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Botão limpar vendas */}
          {countBy(UnidadeStatus.VENDIDO) > 0 ? (
            <div style={{ marginBottom: 16 }}>
              {confirmClearSales ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "var(--color-red-muted)", border: "1px solid var(--color-red)", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--color-red)", fontWeight: 600 }}>
                    Apagar {countBy(UnidadeStatus.VENDIDO)} venda{countBy(UnidadeStatus.VENDIDO) !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.
                  </span>
                  <button type="button" onClick={() => void handleClearSales()} disabled={clearingSales}
                    style={{ background: "var(--color-red)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", height: 28, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {clearingSales ? "Apagando..." : "Confirmar"}
                  </button>
                  <button type="button" onClick={() => setConfirmClearSales(false)}
                    style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: 6, padding: "0 12px", height: 28, fontSize: 12 }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmClearSales(true)}
                  style={{ background: "transparent", color: "var(--color-red)", border: "1px solid var(--color-red-muted)", borderRadius: 8, padding: "0 14px", height: 32, fontSize: 12, fontWeight: 600 }}>
                  Limpar todas as vendas ({countBy(UnidadeStatus.VENDIDO)})
                </button>
              )}
            </div>
          ) : null}

          {/* Header + Dropdown */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={sTitle}>Listagem</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {aiProcessing ? (
                <span style={{ fontSize: 12, color: "var(--color-sprout)", fontWeight: 600 }}>{aiProgress || "Processando IA..."}</span>
              ) : null}
              <div ref={unitsDropRef} style={{ position: "relative" }}>
                <button type="button" onClick={() => setShowUnitsDropdown((p) => !p)} style={{ ...btnP, height: 32, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Adicionar
                </button>
                {showUnitsDropdown ? (
                  <div style={{ position: "absolute", right: 0, top: 38, background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 4, minWidth: 200, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", animation: "fadeIn 150ms ease" }}>
                    <button type="button" onClick={() => { setShowUnitForm(true); setShowUnitsDropdown(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-sprout)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Adicionar unidade
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Importar CSV
                      <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; setShowUnitsDropdown(false); }} style={{ display: "none" }} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: aiProcessing ? "not-allowed" : "pointer", opacity: aiProcessing ? 0.5 : 1 }}
                      onMouseEnter={(e) => { if (!aiProcessing) e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4c0 1.1-.9 2-2 2h-4a2 2 0 01-2-2 4 4 0 014-4z"/><path d="M8 8v8a4 4 0 008 0V8"/></svg>
                      Importar com IA
                      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAiFile(f); e.target.value = ""; setShowUnitsDropdown(false); }} style={{ display: "none" }} disabled={aiProcessing} />
                    </label>
                    <div style={{ height: 1, background: "var(--color-stone)", margin: "4px 0" }} />
                    <button type="button" onClick={() => { downloadCsvTemplate(); setShowUnitsDropdown(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-fog)", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Baixar template CSV
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Import result */}
          {importResult ? (
            <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>
              {importResult}
            </div>
          ) : null}

          {/* CSV Preview */}
          {showCsvPreview && csvPreview.length > 0 ? (
            <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="nexa-label">{csvPreview.length} unidades encontradas no CSV</div>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                <table className="nexa-table">
                  <thead><tr><th>Quadra</th><th>Lote</th><th>Área m²</th><th>Valor</th><th>Observações</th></tr></thead>
                  <tbody>
                    {csvPreview.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{r.quadra}</td>
                        <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{r.lote}</td>
                        <td>{r.area ?? "—"}</td>
                        <td>{r.valor ? `R$ ${r.valor.toLocaleString("pt-BR")}` : "—"}</td>
                        <td style={{ color: "var(--color-fog)", fontSize: 12 }}>{r.observacoes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" disabled={importingCsv} onClick={() => void handleCsvImport()} style={{ ...btnP, height: 32, fontSize: 12 }}>
                  {importingCsv ? "Importando..." : `Confirmar importação (${csvPreview.length})`}
                </button>
                <button type="button" onClick={() => { setShowCsvPreview(false); setCsvPreview([]); }} style={{ ...btnS, height: 32, fontSize: 12 }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {/* AI Preview */}
          {showAiPreview && aiPreview.length > 0 ? (
            <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-sprout-muted)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div className="nexa-label" style={{ color: "var(--color-sprout)" }}>{aiPreview.length} unidades extraídas pela IA</div>
                  <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Revise os dados antes de confirmar.</div>
                </div>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 350, overflowY: "auto" }}>
                <table className="nexa-table">
                  <thead><tr><th>Quadra</th><th>Lote</th><th>Área m²</th><th>Valor</th><th>Status</th><th>Sócio Perm.</th></tr></thead>
                  <tbody>
                    {aiPreview.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{r.quadra}</td>
                        <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{r.lote}</td>
                        <td>{r.area?.toLocaleString("pt-BR") ?? "—"}</td>
                        <td>{r.valor ? `R$ ${r.valor.toLocaleString("pt-BR")}` : "—"}</td>
                        <td><span className="nexa-badge" style={{ color: r.status === "sold" ? "var(--color-purple)" : r.status === "reserved" ? "var(--color-terracotta)" : "var(--color-sprout)", background: r.status === "sold" ? "var(--color-purple-muted)" : r.status === "reserved" ? "var(--color-terracotta-muted)" : "var(--color-sprout-muted)" }}>{r.status === "sold" ? "Vendido" : r.status === "reserved" ? "Reservado" : "Disponível"}</span></td>
                        <td>{r.socio_permutante ? "Sim" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" disabled={importingAi} onClick={() => void handleAiImport()} style={{ ...btnP, height: 32, fontSize: 12 }}>
                  {importingAi ? "Importando..." : `Confirmar importação (${aiPreview.length})`}
                </button>
                <button type="button" onClick={() => { setShowAiPreview(false); setAiPreview([]); }} style={{ ...btnS, height: 32, fontSize: 12 }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {showUnitForm ? (
            <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Quadra *</span><input ref={unitQuadraRef} type="text" value={uQuadra} onChange={(e) => setUQuadra(e.target.value)} placeholder="1" /></label>
                <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Lote *</span><input type="text" value={uLote} onChange={(e) => setULote(e.target.value)} placeholder="1" /></label>
                <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Área m²</span><input type="number" value={uArea} onChange={(e) => setUArea(e.target.value)} placeholder="360" /></label>
                <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Valor R$ *</span><input type="number" value={uValor} onChange={(e) => setUValor(e.target.value)} placeholder="180000" /></label>
              </div>
              <button type="button" disabled={!uQuadra.trim() || !uLote.trim() || !uValor.trim() || savingUnit} onClick={() => void handleAddUnit()} style={{ ...btnP, height: 32, fontSize: 12, marginTop: 12 }}>
                {savingUnit ? "Criando..." : "Criar unidade"}
              </button>
            </div>
          ) : null}

          {units.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table className="nexa-table">
                <thead><tr><th>Quadra</th><th>Lote</th><th>Área m²</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {units.map((u) => editingUnitId === u.id ? (
                    <tr key={u.id}>
                      <td><input type="text" value={euQuadra} onChange={(e) => setEuQuadra(e.target.value)} style={{ width: 60 }} /></td>
                      <td><input type="text" value={euLote} onChange={(e) => setEuLote(e.target.value)} style={{ width: 60 }} /></td>
                      <td><input type="number" value={euArea} onChange={(e) => setEuArea(e.target.value)} style={{ width: 80 }} /></td>
                      <td><input type="number" value={euValor} onChange={(e) => setEuValor(e.target.value)} style={{ width: 100 }} /></td>
                      <td><NexaBadge entity="unit" status={u.status} label={getUnidadeStatusLabel(u.status)} /></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => void handleSaveUnit()} style={{ ...btnP, height: 28, fontSize: 11, padding: "0 10px" }}>Salvar</button>
                          <button type="button" onClick={() => setEditingUnitId(null)} style={{ ...btnS, height: 28, fontSize: 11, padding: "0 10px" }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id}>
                      <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{u.quadra}</td>
                      <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{u.lote}</td>
                      <td>—</td>
                      <td>R$ {u.valor.toLocaleString("pt-BR")}</td>
                      <td><NexaBadge entity="unit" status={u.status} label={getUnidadeStatusLabel(u.status)} /></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => startEditUnit(u)} style={{ ...btnS, height: 28, fontSize: 11, padding: "0 10px" }}>Editar</button>
                          {u.status === UnidadeStatus.DISPONIVEL ? (
                            confirmDeleteId === u.id ? (
                              <>
                                <span style={{ fontSize: 11, color: "var(--color-terracotta)", whiteSpace: "nowrap" }}>Tem certeza?</span>
                                <button type="button" onClick={() => { void handleDeleteUnit(u.id); setConfirmDeleteId(null); }} style={{ ...btnD, height: 28, fontSize: 11, padding: "0 10px" }}>Confirmar</button>
                                <button type="button" onClick={() => setConfirmDeleteId(null)} style={{ ...btnS, height: 28, fontSize: 11, padding: "0 10px" }}>Cancelar</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setConfirmDeleteId(u.id)} style={{ ...btnD, height: 28, fontSize: 11, padding: "0 10px" }}>Excluir</button>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma unidade cadastrada.</p>
          )}
        </div>
      ) : null}

      {/* ═══ ABA DOCUMENTOS REQUERIDOS (Sprint B.3.0a) ═══ */}
      {activeTab === "documentos-requeridos" ? (
        <div className="nexa-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={sTitle}>Documentos requeridos</div>
              <div style={{ fontSize: 13, color: "var(--color-fog)", lineHeight: 1.5, maxWidth: 600 }}>
                Configure quais documentos são exigidos para cada papel da parte na negociação. Cada célula tem 3 estados — clique para alternar.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRestoreDefaultsConfirm(true)}
              disabled={docRequirements.isLoading}
              style={{ ...btnD, height: 32 }}
            >
              Restaurar defaults NEXA
            </button>
          </div>

          {/* Legenda */}
          <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 16, fontSize: 11, color: "var(--color-fog)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 4, color: "var(--color-sprout)", fontSize: 13, fontWeight: 700 }}>✓</span>
              Obrigatório
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 4, color: "#FBBF24", fontSize: 13, fontWeight: 700 }}>○</span>
              Opcional
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, background: "transparent", border: "1px solid rgba(61,58,48,0.3)", borderRadius: 4, color: "#5C5647", fontSize: 13, fontWeight: 700 }}>—</span>
              Não pedido
            </span>
          </div>

          {docRequirements.errorMessage ? (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, fontSize: 12, color: "#F87171" }}>
              {docRequirements.errorMessage}
            </div>
          ) : null}

          {docRequirements.isLoading && docRequirements.catalog.length === 0 ? (
            <p style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Carregando matriz de documentos...</p>
          ) : docRequirements.catalog.length === 0 ? (
            <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhum tipo de documento ativo no catálogo.</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--color-stone)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr style={{ background: "rgba(34,33,28,0.3)" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog)", fontWeight: 600, borderBottom: "1px solid var(--color-stone)", minWidth: 220 }}>
                      Tipo de documento
                    </th>
                    {VISIBLE_PARTY_ROLES.map((role) => (
                      <th key={role} style={{ textAlign: "center", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-fog)", fontWeight: 600, borderBottom: "1px solid var(--color-stone)", minWidth: 100 }}>
                        {PARTY_ROLE_LABEL[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docRequirements.catalog.map((type, idx) => (
                    <tr key={type.id} style={{ borderBottom: idx < docRequirements.catalog.length - 1 ? "1px solid rgba(61,58,48,0.3)" : "none" }}>
                      <td style={{ padding: "10px 14px", verticalAlign: "top" }}>
                        <div style={{ fontSize: 13, color: "var(--color-bone)", fontWeight: 500 }}>{type.label}</div>
                        {type.description ? (
                          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2, lineHeight: 1.4 }}>{type.description}</div>
                        ) : null}
                      </td>
                      {VISIBLE_PARTY_ROLES.map((role) => {
                        const state = computeCellState(docRequirements.requirements, role, type.id);
                        const cellKey = `${role}:${type.id}`;
                        const isMutating = docRequirements.mutatingCell === cellKey;
                        return (
                          <td key={role} style={{ padding: "10px 14px", textAlign: "center" }}>
                            <RequirementCell
                              state={state}
                              loading={isMutating}
                              onToggle={() => void docRequirements.toggleRequirement(role, type.id, state)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Modal de confirmação Restaurar defaults (Sprint B.3.0a) */}
      {showRestoreDefaultsConfirm ? createPortal(
        <div
          onClick={() => { if (!restoringDefaults) setShowRestoreDefaultsConfirm(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, maxWidth: 460, width: "100%" }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 8px" }}>
              Restaurar defaults NEXA?
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-fog)", margin: "0 0 20px", lineHeight: 1.5 }}>
              Isso vai apagar todas as suas customizações nesta matriz e restaurar os 19 requirements padrão. Não pode ser desfeito.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowRestoreDefaultsConfirm(false)}
                disabled={restoringDefaults}
                style={btnS}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restoringDefaults}
                onClick={async () => {
                  setRestoringDefaults(true);
                  try {
                    await docRequirements.restoreDefaults();
                    setShowRestoreDefaultsConfirm(false);
                  } finally {
                    setRestoringDefaults(false);
                  }
                }}
                style={{ ...btnD, height: 36, padding: "0 16px", fontSize: 13 }}
              >
                {restoringDefaults ? "Restaurando..." : "Restaurar mesmo assim"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {/* ═══ ABA MATERIAIS ═══ */}
      {activeTab === "materiais" ? (
        <div className="nexa-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={sTitle}>Materiais</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={() => setShowDriveTutorial(true)} style={{ background: "transparent", color: "var(--color-fog)", border: "1px solid var(--color-stone)", borderRadius: "50%", width: 24, height: 24, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }} title="Como conectar o Google Drive">?</button>
              <div ref={matDropRef} style={{ position: "relative" }}>
                <button type="button" onClick={() => setShowMatDropdown((p) => !p)} style={{ ...btnP, height: 32, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Adicionar
                </button>
                {showMatDropdown ? (
                  <div style={{ position: "absolute", right: 0, top: 38, background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 4, minWidth: 220, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", animation: "fadeIn 150ms ease" }}>
                    <button type="button" onClick={() => { setMatAction(matAction === "drive-link" ? "none" : "drive-link"); setDriveMode(matAction === "drive-link" ? "none" : "link"); setDriveFiles([]); setDriveError(null); setShowMatDropdown(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                      Importar do Drive
                    </button>
                    <button type="button" onClick={() => { const returnUrl = window.location.pathname + window.location.search; window.location.href = `/api/google-auth?return_url=${encodeURIComponent(returnUrl)}`; }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Conectar Google Drive
                    </button>
                    <div style={{ height: 1, background: "var(--color-stone)", margin: "4px 0" }} />
                    <label style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Upload de arquivo
                      <input type="file" accept="image/*,.pdf,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMFile(f); setMTipo(f.type.startsWith("image/") ? "imagem" : f.type === "application/pdf" ? "pdf" : f.type.startsWith("video/") ? "video" : "link"); setMTitulo(f.name.replace(/\.[^.]+$/, "")); setMatAction("upload"); setShowMatForm(true); } setShowMatDropdown(false); e.target.value = ""; }} style={{ display: "none" }} />
                    </label>
                    <button type="button" onClick={() => { setMatAction("link"); setShowMatForm(true); setMTipo("link"); setShowMatDropdown(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 6, fontSize: 12, color: "var(--color-bone)", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-stone)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                      Adicionar link
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tutorial Modal */}
          {showDriveTutorial ? (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowDriveTutorial(false)}>
              <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 28, maxWidth: 480, width: "90%", animation: "fadeIn 200ms ease" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)" }}>Como conectar seu Google Drive</div>
                  <button type="button" onClick={() => setShowDriveTutorial(false)} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 18, cursor: "pointer" }}>×</button>
                </div>
                <div style={{ display: "grid", gap: 16 }}>
                  {[
                    { step: 1, text: "Acesse drive.google.com e encontre a pasta com os materiais do empreendimento" },
                    { step: 2, text: "Clique com o botão direito na pasta desejada" },
                    { step: 3, text: 'Vá em "Compartilhar" → "Qualquer pessoa com o link pode ver"' },
                    { step: 4, text: 'Copie o link e cole no campo "Importar do Drive" acima' },
                  ].map((item) => (
                    <div key={item.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-sprout-muted)", color: "var(--color-sprout)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{item.step}</div>
                      <div style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.5, paddingTop: 4 }}>{item.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--color-ink)", borderRadius: 8, border: "1px solid var(--color-stone)" }}>
                  <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 4 }}>Acesso direto à sua conta</div>
                  <div style={{ fontSize: 12, color: "var(--color-dust)" }}>Para navegar suas pastas diretamente, use o botão "Conectar Google Drive" no menu Adicionar.</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Google Drive - Link mode */}
          {driveMode === "link" ? (
            <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, marginBottom: 16, animation: "fadeIn 200ms ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="nexa-label">Importar do Google Drive (link público)</div>
                <button type="button" onClick={() => { setDriveMode("none"); setMatAction("none"); setDriveFiles([]); }} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 14, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="url" value={driveFolderUrl} onChange={(e) => setDriveFolderUrl(e.target.value)} placeholder="Cole o link da pasta compartilhada do Drive" style={{ flex: 1 }} autoFocus />
                <button type="button" disabled={!driveFolderUrl.trim() || driveLoading} onClick={() => void handleDriveFolderLoad()} style={{ ...btnP, height: 36, fontSize: 12, whiteSpace: "nowrap" }}>
                  {driveLoading ? "Carregando..." : "Buscar arquivos"}
                </button>
              </div>
              {driveError ? <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{driveError}</p> : null}
              {driveFiles.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--color-fog)" }}>{driveFiles.length} arquivos encontrados · {driveSelected.size} selecionados</span>
                    <button type="button" onClick={() => setDriveSelected(driveSelected.size === driveFiles.length ? new Set() : new Set(driveFiles.map((f) => f.id)))} style={{ fontSize: 11, color: "var(--color-sprout)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      {driveSelected.size === driveFiles.length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div style={{ maxHeight: 250, overflowY: "auto", display: "grid", gap: 4 }}>
                    {driveFiles.map((file) => {
                      const tipo = detectMaterialType(file.mimeType);
                      const tc = tipoColors[tipo] ?? tipoColors.link;
                      return (
                        <label key={file.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 6, background: driveSelected.has(file.id) ? "var(--color-sprout-glow)" : "transparent", cursor: "pointer" }}>
                          <input type="checkbox" checked={driveSelected.has(file.id)} onChange={() => toggleDriveFile(file.id)} />
                          <span className="nexa-badge" style={{ color: tc.color, background: tc.bg, fontSize: 9 }}>{tipoLabels[tipo] ?? tipo}</span>
                          <span style={{ fontSize: 12, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <button type="button" disabled={driveSelected.size === 0 || importingDrive} onClick={() => void handleDriveImport()} style={{ ...btnP, height: 32, fontSize: 12, marginTop: 12 }}>
                    {importingDrive ? "Importando..." : `Importar ${driveSelected.size} arquivo${driveSelected.size !== 1 ? "s" : ""}`}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}


          {/* Google Drive - OAuth mode (folder navigation) */}
          {driveMode === "oauth" ? (
            <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, marginBottom: 16, animation: "fadeIn 200ms ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="nexa-label">Google Drive — Selecione uma pasta</div>
                <button type="button" onClick={() => { setDriveMode("none"); setMatAction("none"); setDriveFiles([]); setDriveFolderStack([]); }} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 14, cursor: "pointer" }}>×</button>
              </div>
              {/* Breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => { setDriveFolderStack([]); void handleDriveOAuthLoad("root"); }} style={{ background: "transparent", border: "none", color: driveFolderStack.length > 0 ? "var(--color-sprout)" : "var(--color-bone)", fontSize: 12, cursor: "pointer", textDecoration: driveFolderStack.length > 0 ? "underline" : "none", padding: 0 }}>Meu Drive</button>
                {driveFolderStack.map((folder, idx) => (
                  <span key={folder.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "var(--color-fog)", fontSize: 11 }}>/</span>
                    <button type="button" onClick={() => { const next = driveFolderStack.slice(0, idx + 1); setDriveFolderStack(next); void handleDriveOAuthLoad(folder.id); }} style={{ background: "transparent", border: "none", color: idx === driveFolderStack.length - 1 ? "var(--color-bone)" : "var(--color-sprout)", fontSize: 12, cursor: "pointer", textDecoration: idx < driveFolderStack.length - 1 ? "underline" : "none", padding: 0, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</button>
                  </span>
                ))}
                {driveFolderStack.length > 0 ? (
                  <button type="button" onClick={navigateDriveBack} style={{ ...btnS, height: 24, fontSize: 11, marginLeft: 8, padding: "0 8px" }}>← Voltar</button>
                ) : null}
              </div>
              {driveLoading ? <p style={{ color: "var(--color-fog)", fontSize: 12 }}>Carregando...</p> : null}
              {driveError ? <p style={{ color: "var(--color-red)", fontSize: 12 }}>{driveError}</p> : null}
              {!driveLoading && driveFiles.length > 0 ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--color-fog)" }}>{driveFiles.length} itens · {driveSelected.size} selecionados</span>
                    <button type="button" onClick={() => { const nonFolders = driveFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder"); setDriveSelected(driveSelected.size === nonFolders.length ? new Set() : new Set(nonFolders.map((f) => f.id))); }} style={{ fontSize: 11, color: "var(--color-sprout)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      {driveSelected.size === driveFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder").length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div style={{ maxHeight: 300, overflowY: "auto", display: "grid", gap: 4 }}>
                    {driveFiles.map((file) => {
                      const isFolder = file.mimeType === "application/vnd.google-apps.folder";
                      const tipo = detectMaterialType(file.mimeType);
                      const tc = tipoColors[tipo] ?? tipoColors.link;
                      if (isFolder) {
                        return (
                          <button key={file.id} type="button" onClick={() => navigateDriveFolder(file.id, file.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, background: "transparent", border: "1px solid var(--color-stone)", cursor: "pointer", textAlign: "left" }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-sprout)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-stone)"; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-terracotta)" stroke="var(--color-terracotta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                            <span style={{ fontSize: 12, color: "var(--color-bone)", fontWeight: 600 }}>{file.name}</span>
                            <span style={{ fontSize: 10, color: "var(--color-fog)", marginLeft: "auto" }}>→</span>
                          </button>
                        );
                      }
                      return (
                        <label key={file.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 6, background: driveSelected.has(file.id) ? "var(--color-sprout-glow)" : "transparent", cursor: "pointer" }}>
                          <input type="checkbox" checked={driveSelected.has(file.id)} onChange={() => toggleDriveFile(file.id)} />
                          <span className="nexa-badge" style={{ color: tc.color, background: tc.bg, fontSize: 9 }}>{tipoLabels[tipo] ?? tipo}</span>
                          <span style={{ fontSize: 12, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {driveFiles.some((f) => f.mimeType !== "application/vnd.google-apps.folder") ? (
                    <button type="button" disabled={driveSelected.size === 0 || importingDrive} onClick={() => void handleDriveImport()} style={{ ...btnP, height: 32, fontSize: 12, marginTop: 12 }}>
                      {importingDrive ? "Importando..." : `Importar ${driveSelected.size} arquivo${driveSelected.size !== 1 ? "s" : ""}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!driveLoading && driveFiles.length === 0 && !driveError ? (
                <p style={{ color: "var(--color-fog)", fontSize: 12 }}>Nenhum arquivo encontrado nesta pasta.</p>
              ) : null}
            </div>
          ) : null}

          {/* Upload/Link form */}
          {showMatForm ? (
            <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: 16, marginBottom: 16, animation: "fadeIn 200ms ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="nexa-label">{matAction === "upload" ? "Upload de arquivo" : "Adicionar link"}</div>
                <button type="button" onClick={() => { setShowMatForm(false); setMatAction("none"); setMTitulo(""); setMUrl(""); setMFile(null); }} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 14, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, maxWidth: 500 }}>
                <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Título *</span><input type="text" value={mTitulo} onChange={(e) => setMTitulo(e.target.value)} placeholder="Nome do material" autoFocus /></label>
                {matAction === "upload" && mFile ? (
                  <div style={{ fontSize: 12, color: "var(--color-fog)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="nexa-badge" style={{ color: tipoColors[mTipo]?.color ?? "var(--color-fog)", background: tipoColors[mTipo]?.bg ?? "var(--color-stone)" }}>{tipoLabels[mTipo] ?? mTipo}</span>
                    {mFile.name}
                  </div>
                ) : null}
                {matAction === "link" ? (
                  <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>URL</span><input type="url" value={mUrl} onChange={(e) => setMUrl(e.target.value)} placeholder="https://..." /></label>
                ) : null}
              </div>
              <button type="button" disabled={!mTitulo.trim() || savingMat} onClick={() => void handleAddMaterial()} style={{ ...btnP, height: 32, fontSize: 12, marginTop: 12 }}>
                {savingMat ? "Salvando..." : "Salvar material"}
              </button>
            </div>
          ) : null}

          {/* Materials grid */}
          {materials.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(auto-fill, minmax(140px, 1fr))" : "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {materials.map((mat) => {
                const tc = tipoColors[mat.tipo] ?? tipoColors.link;
                const iconByType: Record<string, React.ReactNode> = {
                  pdf: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
                  imagem: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-sprout)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
                  video: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
                  link: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
                };
                return (
                  <a key={mat.id} href={mat.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                    style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textDecoration: "none", transition: "border-color 150ms ease, box-shadow 150ms ease" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = tc.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${tc.color}`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-stone)"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {iconByType[mat.tipo] ?? iconByType.link}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-bone)", fontWeight: 600, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", maxWidth: 160 }}>{mat.titulo}</div>
                    <span className="nexa-badge" style={{ color: tc.color, background: tc.bg, fontSize: 9 }}>{tipoLabels[mat.tipo] ?? mat.tipo}</span>
                  </a>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-stone)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              <div style={{ fontSize: 14, color: "var(--color-dust)", fontWeight: 600 }}>Nenhum material ainda</div>
              <div style={{ fontSize: 12, color: "var(--color-fog)", textAlign: "center", maxWidth: 280 }}>Adicione fotos, vídeos, PDFs e links do empreendimento</div>
              <button type="button" onClick={() => setShowMatDropdown(true)} style={{ ...btnP, height: 36, fontSize: 13, marginTop: 8 }}>
                Adicionar primeiro material
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
