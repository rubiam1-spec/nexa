// Wizard de importação de negociações (Camada 1, sem IA).
// Modal via createPortal. Toda regra/normalização vem do serviço; aqui só UI/estado.
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useNegotiationImport } from "../hooks/useNegotiationImport";
import {
  autoMapColumns,
  buildStaging,
  dedupeBrokers,
  getBrokerRawNames,
  getDistinctStatuses,
  listSheets,
  parseSheet,
  toCommitRows,
  STATUS_LABELS,
  ROW_FLAG_LABELS,
  type BrokerDecision,
  type ColumnMapping,
  type NegotiationStatus,
  type NexaField,
  type ParsedSheet,
  type StagingRow,
} from "../../../services/negotiationImport";
import type { CommitImportResult } from "../../../infra/repositories/negotiationImportsSupabaseRepository";

// ----- Tokens v7 -----
const T = {
  ink: "#12110F",
  carbon: "#1C1B18",
  stone: "#2A2822",
  clay: "#5C5647",
  layer1: "#0F0E0C",
  sprout: "#4ADE80",
  sproutMuted: "rgba(74,222,128,0.12)",
  terracotta: "#D97706",
  terracottaMuted: "rgba(217,119,6,0.14)",
  chalk: "#FAF9F6",
  bone: "#E8E5DE",
  dust: "#C4BFB3",
  fog: "#9C9686",
  slate: "#706B5F",
  blue: "#60A5FA",
  purple: "#A78BFA",
  red: "#F87171",
  yellow: "#FBBF24",
  border: "rgba(232,229,222,0.08)",
  borderStrong: "rgba(232,229,222,0.14)",
  mono: "var(--font-mono, 'JetBrains Mono', monospace)",
  ui: "var(--font-ui, 'Outfit', sans-serif)",
};

const CARD_BG = "linear-gradient(160deg, #1C1B18 0%, #131210 100%)";

const NEXA_FIELDS: Array<{ key: NexaField; label: string }> = [
  { key: "ignorar", label: "— Ignorar" },
  { key: "cliente", label: "Cliente" },
  { key: "corretor", label: "Corretor" },
  { key: "imobiliaria", label: "Imobiliária" },
  { key: "status", label: "Status" },
  { key: "quadra_lote", label: "Quadra/Lote" },
  { key: "data", label: "Data" },
  { key: "telefone", label: "Telefone" },
  { key: "cpf", label: "CPF" },
  { key: "observacao", label: "Observação" },
];

const ALL_STATUSES: NegotiationStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "PROPOSAL",
  "RESERVATION",
  "WON",
  "LOST",
  "CANCELLED",
];

const CHIP: Record<NegotiationStatus, { fg: string; bg: string }> = {
  OPEN: { fg: T.dust, bg: "rgba(196,191,179,0.12)" },
  IN_PROGRESS: { fg: T.yellow, bg: "rgba(251,191,36,0.12)" },
  PROPOSAL: { fg: T.purple, bg: "rgba(167,139,250,0.12)" },
  RESERVATION: { fg: T.blue, bg: "rgba(96,165,250,0.12)" },
  WON: { fg: T.sprout, bg: T.sproutMuted },
  LOST: { fg: T.red, bg: "rgba(248,113,113,0.12)" },
  CANCELLED: { fg: T.fog, bg: "rgba(112,107,95,0.14)" },
};

// ----- estilos reutilizáveis -----
const selectStyle: React.CSSProperties = {
  background: T.layer1,
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: T.bone,
  fontSize: 13,
  fontFamily: T.ui,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
const sectionLabel: React.CSSProperties = {
  fontFamily: T.mono,
  textTransform: "uppercase",
  fontSize: 9,
  letterSpacing: "0.12em",
  color: T.sprout,
};
const kpiStyle: React.CSSProperties = { fontFamily: T.mono, fontSize: 32, color: T.chalk, fontWeight: 600 };

function StatusChip({ status }: { status: NegotiationStatus }) {
  const c = CHIP[status];
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        color: c.fg,
        background: c.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 10,
        color,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${T.border}`,
        borderRadius: 5,
        padding: "1px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  developmentId: string | null;
  developmentName?: string | null;
  onImported?: () => void;
};

export default function NegotiationImportWizard({
  open,
  onClose,
  accountId,
  developmentId,
  developmentName,
  onImported,
}: Props) {
  const navigate = useNavigate();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;
  const fileRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const imp = useNegotiationImport(accountId, developmentId);

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [autoFields, setAutoFields] = useState<Record<string, NexaField>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, NegotiationStatus>>({});
  const [brokerDecisions, setBrokerDecisions] = useState<Record<string, BrokerDecision>>({});
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [dupStrategy, setDupStrategy] = useState<"skip" | "update" | "create">("skip");
  const [onlyReview, setOnlyReview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [committed, setCommitted] = useState<CommitImportResult | null>(null);
  const [undoArchived, setUndoArchived] = useState<number | null>(null);

  const reset = useCallback(() => {
    bufferRef.current = null;
    setStep(1);
    setFileName("");
    setSheetNames([]);
    setParsed(null);
    setMapping({});
    setAutoFields({});
    setStatusOverrides({});
    setBrokerDecisions({});
    setRows([]);
    setDupStrategy("skip");
    setOnlyReview(false);
    setParseError(null);
    setCommitted(null);
    setUndoArchived(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ---------- Etapa 1: parsing ----------
  const runParse = useCallback(
    (buf: ArrayBuffer, sheet?: string) => {
      try {
        const names = listSheets(buf);
        const p = parseSheet(buf, sheet);
        if (!p.headers.length || !p.rows.length) {
          setParseError("Não foi possível detectar cabeçalho/linhas de dados nesta aba.");
          return;
        }
        const auto = autoMapColumns(p.headers);
        bufferRef.current = buf;
        setSheetNames(names);
        setParsed(p);
        setMapping(auto);
        setAutoFields({ ...auto });
        setParseError(null);
        void imp.loadReference();
      } catch {
        setParseError("Erro ao ler o arquivo. Verifique o formato (.xlsx/.xls/.csv).");
      }
    },
    [imp],
  );

  const onFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const buf = e.target?.result;
        if (buf instanceof ArrayBuffer) runParse(buf);
      };
      reader.readAsArrayBuffer(file);
    },
    [runParse],
  );

  const changeSheet = useCallback(
    (name: string) => {
      if (bufferRef.current) runParse(bufferRef.current, name);
    },
    [runParse],
  );

  // ---------- de-para & corretores (derivados) ----------
  const distinctStatuses = useMemo(
    () => (parsed ? getDistinctStatuses(parsed, mapping) : []),
    [parsed, mapping],
  );
  const brokerMatches = useMemo(
    () => (parsed ? dedupeBrokers(getBrokerRawNames(parsed, mapping), imp.brokers) : []),
    [parsed, mapping, imp.brokers],
  );

  // inicializa decisões de corretor a partir dos matches (uma vez por conjunto)
  const initBrokerDecisions = useCallback(() => {
    setBrokerDecisions((prev) => {
      const next = { ...prev };
      for (const m of brokerMatches) {
        if (!next[m.normalized]) {
          next[m.normalized] = m.existingId
            ? { brokerId: m.existingId, brokerName: m.existingName ?? m.raw }
            : { brokerId: null, brokerName: m.raw };
        }
      }
      return next;
    });
  }, [brokerMatches]);

  const recomputeRows = useCallback(() => {
    if (!parsed) return;
    setRows(
      buildStaging({
        parsed,
        mapping,
        existingBrokers: imp.brokers,
        units: imp.units,
        statusOverrides,
        brokerDecisions,
      }),
    );
  }, [parsed, mapping, imp.brokers, imp.units, statusOverrides, brokerDecisions]);

  // ---------- navegação entre etapas ----------
  const goTo = useCallback(
    (next: number) => {
      if (next === 3) initBrokerDecisions();
      if (next === 4) recomputeRows();
      setStep(next);
    },
    [initBrokerDecisions, recomputeRows],
  );

  // ---------- contadores ----------
  const approved = rows.filter((r) => r.approved);
  const counts = useMemo(() => {
    const ativas = approved.filter((r) => r.statusClass === "ativa").length;
    const arquivadas = approved.filter((r) => r.statusClass === "arquivada").length;
    const permutas = approved.filter((r) => r.permuta).length;
    const unidades = approved.filter((r) => r.unitId).length;
    const revisar = rows.filter((r) => r.flags.length > 0).length;
    const erros = rows.filter((r) => r.flags.includes("sem_cliente")).length;
    const novosCorretores = new Set(
      Object.values(brokerDecisions)
        .filter((d) => !d.brokerId)
        .map((d) => d.brokerName.toLowerCase()),
    ).size;
    return { ativas, arquivadas, permutas, unidades, revisar, erros, novosCorretores };
  }, [rows, approved, brokerDecisions]);

  // ---------- commit ----------
  const doCommit = useCallback(async () => {
    if (!accountId || !parsed) return;
    const statusMappingObj: Record<string, string> = {};
    for (const d of distinctStatuses) {
      statusMappingObj[d.raw] = statusOverrides[d.raw.toUpperCase()] ?? d.status;
    }
    const result = await imp.runCommit({
      accountId,
      developmentId,
      fileName,
      sheetName: parsed.sheetName,
      columnMapping: mapping as Record<string, string>,
      statusMapping: statusMappingObj,
      defaultValues: { permuta_out_of_vgv: true },
      duplicateStrategy: dupStrategy,
      permutaOutOfVgv: true,
      totalRows: approved.length,
      rows: toCommitRows(rows),
    });
    if (result) {
      setCommitted(result);
      onImported?.();
    }
  }, [
    accountId,
    developmentId,
    parsed,
    distinctStatuses,
    statusOverrides,
    imp,
    fileName,
    mapping,
    dupStrategy,
    approved.length,
    rows,
    onImported,
  ]);

  const doUndo = useCallback(async () => {
    if (!committed?.batchId) return;
    const archived = await imp.runUndo(committed.batchId);
    if (archived !== null) {
      setUndoArchived(archived);
      onImported?.();
    }
  }, [committed, imp, onImported]);

  const downloadTemplate = useCallback(() => {
    const headers = ["Cliente", "Corretor", "Imobiliária", "Status", "Quadra/Lote", "Data", "Telefone", "Observação"];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-negociacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!open) return null;

  const STEPS = ["Upload", "Mapeamento", "De-para", "Revisão", "Confirmar"];

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 9001, display: "flex", flexDirection: "column", background: T.ink }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 9001,
        width: "min(960px, 95vw)",
        maxHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        background: T.ink,
        border: `1px solid ${T.borderStrong}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, fontFamily: T.ui }}>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)" }} />
      <div style={panelStyle}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${T.border}`,
            paddingTop: isMobile ? "max(16px, env(safe-area-inset-top))" : 16,
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-serif, 'Instrument Serif', serif)", fontStyle: "italic", fontSize: 22, color: T.chalk }}>
              Importar negociações
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.fog, letterSpacing: "0.08em", marginTop: 2 }}>
              {developmentName ? developmentName.toUpperCase() : "EMPREENDIMENTO ATIVO"} · ETAPA {step}/5 · {STEPS[step - 1].toUpperCase()}
            </div>
          </div>
          <button
            onClick={close}
            style={{ background: "transparent", border: "none", color: T.fog, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0" }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i < step ? T.sprout : T.stone,
                transition: "background .2s",
              }}
            />
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {imp.errorMessage && (
            <div
              style={{
                background: "rgba(248,113,113,0.1)",
                border: `1px solid ${T.red}`,
                color: T.red,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {imp.errorMessage}
            </div>
          )}

          {/* ====== ETAPA 1 ====== */}
          {step === 1 && (
            <div>
              <div style={sectionLabel}>ARQUIVO & ESCOPO</div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) onFile(f);
                }}
                onClick={() => fileRef.current?.click()}
                style={{
                  marginTop: 12,
                  border: `1.5px dashed ${dragOver ? T.sprout : T.borderStrong}`,
                  background: dragOver ? T.sproutMuted : T.layer1,
                  borderRadius: 12,
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ color: T.bone, fontSize: 15, marginBottom: 6 }}>
                  {fileName || "Arraste a planilha aqui ou clique para selecionar"}
                </div>
                <div style={{ color: T.fog, fontSize: 12, fontFamily: T.mono }}>.xlsx · .xls · .csv</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
              </div>
              {parseError && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{parseError}</div>}

              {parsed && (
                <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                  {sheetNames.length > 1 && (
                    <div>
                      <div style={{ ...sectionLabel, marginBottom: 6 }}>ABA</div>
                      <select style={selectStyle} value={parsed.sheetName} onChange={(e) => changeSheet(e.target.value)}>
                        {sheetNames.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <div style={kpiStyle}>{parsed.totalRows}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.fog }}>LINHAS</div>
                    </div>
                    <div>
                      <div style={kpiStyle}>{parsed.totalCols}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.fog }}>COLUNAS</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <button onClick={downloadTemplate} style={linkBtn}>
                  ↓ Baixar modelo
                </button>
              </div>
            </div>
          )}

          {/* ====== ETAPA 2 ====== */}
          {step === 2 && parsed && (
            <div>
              <div style={sectionLabel}>MAPEAMENTO DE COLUNAS</div>
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {parsed.headers.map((h) => {
                  const isAuto = autoFields[h] && autoFields[h] !== "ignorar" && autoFields[h] === mapping[h];
                  return (
                    <div
                      key={h}
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr auto 200px",
                        gap: 10,
                        alignItems: "center",
                        background: CARD_BG,
                        border: `1px solid ${T.border}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ color: T.bone, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {h}
                      </div>
                      <Tag
                        text={mapping[h] === "ignorar" ? "ignorar" : isAuto ? "auto" : "manual"}
                        color={mapping[h] === "ignorar" ? T.fog : isAuto ? T.sprout : T.yellow}
                      />
                      <select
                        style={selectStyle}
                        value={mapping[h] ?? "ignorar"}
                        onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as NexaField }))}
                      >
                        {NEXA_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====== ETAPA 3 ====== */}
          {step === 3 && parsed && (
            <div style={{ display: "grid", gap: 22 }}>
              <div>
                <div style={sectionLabel}>DE-PARA DE STATUS</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {distinctStatuses.map((d) => {
                    const current = statusOverrides[d.raw.toUpperCase()] ?? d.status;
                    return (
                      <div
                        key={d.raw || "(vazio)"}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr" : "1fr auto 180px",
                          gap: 10,
                          alignItems: "center",
                          background: CARD_BG,
                          border: `1px solid ${T.border}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ color: T.bone, fontSize: 13 }}>
                          <span style={{ fontFamily: T.mono, color: T.dust }}>{d.raw || "(vazio)"}</span>
                          <span style={{ color: T.fog, fontSize: 11, marginLeft: 8 }}>×{d.count}</span>
                          {d.revisar && <span style={{ marginLeft: 8 }}><Tag text="a revisar" color={T.yellow} /></span>}
                        </div>
                        <StatusChip status={current} />
                        <select
                          style={selectStyle}
                          value={current}
                          onChange={(e) =>
                            setStatusOverrides((s) => ({ ...s, [d.raw.toUpperCase()]: e.target.value as NegotiationStatus }))
                          }
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: T.terracotta }}>
                  Permutas entram marcadas (Vendida) e ficam FORA do VGV monetário.
                </div>
              </div>

              <div>
                <div style={sectionLabel}>CORRETORES — FUSÕES A CONFIRMAR</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {brokerMatches.map((m) => {
                    const dec = brokerDecisions[m.normalized] ?? { brokerId: m.existingId, brokerName: m.existingName ?? m.raw };
                    return (
                      <div
                        key={m.normalized}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr" : "1fr 220px",
                          gap: 10,
                          alignItems: "center",
                          background: CARD_BG,
                          border: `1px solid ${T.border}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ color: T.bone, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{m.raw}</span>
                          <span style={{ color: T.fog, fontSize: 11, marginLeft: 8 }}>×{m.count}</span>
                          {m.suggestion === "fuzzy" && (
                            <span style={{ marginLeft: 8 }}>
                              <Tag text={`~${Math.round(m.confidence * 100)}% ${m.existingName ?? ""}`} color={T.yellow} />
                            </span>
                          )}
                          {m.mergeWith.length > 0 && (
                            <span style={{ marginLeft: 8 }}>
                              <Tag text={`fundir com ${m.mergeWith.join(", ")}`} color={T.blue} />
                            </span>
                          )}
                        </div>
                        <select
                          style={selectStyle}
                          value={dec.brokerId ?? "__new__"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBrokerDecisions((s) => ({
                              ...s,
                              [m.normalized]:
                                val === "__new__"
                                  ? { brokerId: null, brokerName: m.raw }
                                  : {
                                      brokerId: val,
                                      brokerName: imp.brokers.find((b) => b.id === val)?.name ?? m.raw,
                                    },
                            }));
                          }}
                        >
                          <option value="__new__">Criar novo: {m.raw}</option>
                          {imp.brokers.map((b) => (
                            <option key={b.id} value={b.id}>
                              Vincular: {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {brokerMatches.length === 0 && (
                    <div style={{ color: T.fog, fontSize: 13 }}>Nenhum corretor identificado nas linhas.</div>
                  )}
                </div>
              </div>

              <div>
                <div style={sectionLabel}>DUPLICATAS</div>
                <select
                  style={{ ...selectStyle, marginTop: 8, maxWidth: 320 }}
                  value={dupStrategy}
                  onChange={(e) => setDupStrategy(e.target.value as "skip" | "update" | "create")}
                >
                  <option value="skip">Ignorar duplicatas (recomendado)</option>
                  <option value="update">Atualizar status da existente</option>
                  <option value="create">Criar mesmo assim</option>
                </select>
              </div>
            </div>
          )}

          {/* ====== ETAPA 4 ====== */}
          {step === 4 && (
            <div>
              <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
                <KPI value={approved.length} label="PRONTAS" color={T.sprout} />
                <KPI value={counts.revisar} label="A REVISAR" color={T.yellow} />
                <KPI value={counts.erros} label="SEM CLIENTE" color={T.red} />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, color: T.dust, fontSize: 13 }}>
                <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
                Mostrar apenas linhas a revisar
              </label>
              <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.layer1 }}>
                      {["#", "Cliente", "Corretor", "Q/L", "Status", "Data", "Sinais", "✓"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            fontFamily: T.mono,
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            color: T.fog,
                            position: "sticky",
                            top: 0,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((r) => (onlyReview ? r.flags.length > 0 : true))
                      .map((r) => (
                        <tr key={r.index} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td style={{ padding: "8px 10px", fontFamily: T.mono, color: T.fog }}>{r.index}</td>
                          <td style={{ padding: "8px 10px", color: T.bone }}>{r.clientName ?? <span style={{ color: T.red }}>—</span>}</td>
                          <td style={{ padding: "8px 10px", color: T.dust }}>{r.brokerName ?? "—"}</td>
                          <td style={{ padding: "8px 10px", fontFamily: T.mono, color: r.unitId ? T.sprout : T.fog }}>
                            {r.quadra && r.lote ? `Q${r.quadra}/L${r.lote}` : "—"}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <select
                              style={{ ...selectStyle, padding: "4px 6px", fontSize: 11 }}
                              value={r.status}
                              onChange={(e) =>
                                setRows((all) =>
                                  all.map((x) =>
                                    x.index === r.index
                                      ? {
                                          ...x,
                                          status: e.target.value as NegotiationStatus,
                                          statusClass: ["WON", "LOST", "CANCELLED"].includes(e.target.value)
                                            ? "arquivada"
                                            : "ativa",
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              {ALL_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "8px 10px", fontFamily: T.mono, color: T.fog }}>{r.createdAt ?? "—"}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {r.permuta && <Tag text="permuta" color={T.terracotta} />}
                              {r.flags
                                .filter((f) => f !== "permuta")
                                .map((f) => (
                                  <Tag key={f} text={ROW_FLAG_LABELS[f]} color={f === "sem_cliente" ? T.red : T.yellow} />
                                ))}
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <input
                              type="checkbox"
                              checked={r.approved}
                              onChange={(e) =>
                                setRows((all) => all.map((x) => (x.index === r.index ? { ...x, approved: e.target.checked } : x)))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: T.fog }}>Nada é gravado nesta etapa.</div>
            </div>
          )}

          {/* ====== ETAPA 5 ====== */}
          {step === 5 && !committed && (
            <div
              style={{
                background: CARD_BG,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: 24,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle at 30% 0%, rgba(74,222,128,0.06), transparent 60%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ ...sectionLabel, position: "relative" }}>RESUMO DA IMPORTAÇÃO</div>
              <div
                style={{
                  position: "relative",
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                  gap: 18,
                }}
              >
                <KPI value={approved.length} label="TOTAL" color={T.chalk} />
                <KPI value={counts.ativas} label="ATIVAS" color={T.sprout} />
                <KPI value={counts.arquivadas} label="ARQUIVADAS" color={T.fog} />
                <KPI value={counts.permutas} label="PERMUTAS" color={T.terracotta} />
                <KPI value={counts.novosCorretores} label="NOVOS CORRETORES" color={T.blue} />
                <KPI value={counts.unidades} label="UNIDADES CASADAS" color={T.purple} />
              </div>
            </div>
          )}

          {/* ====== ETAPA 5 — sucesso ====== */}
          {step === 5 && committed && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 20, color: T.chalk, fontFamily: "var(--font-serif, 'Instrument Serif', serif)", fontStyle: "italic" }}>
                Importado com sucesso
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
                <KPI value={committed.imported} label="IMPORTADAS" color={T.sprout} />
                <KPI value={committed.skipped} label="IGNORADAS" color={T.fog} />
                <KPI value={committed.duplicates} label="DUPLICATAS" color={T.yellow} />
                <KPI value={committed.errorsCount} label="ERROS" color={committed.errorsCount ? T.red : T.fog} />
              </div>
              {undoArchived !== null && (
                <div style={{ marginTop: 14, color: T.terracotta, fontSize: 13 }}>
                  Importação desfeita — {undoArchived} negociações arquivadas.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            padding: "14px 20px",
            borderTop: `1px solid ${T.border}`,
            paddingBottom: isMobile ? "max(14px, env(safe-area-inset-bottom))" : 14,
          }}
        >
          {!committed ? (
            <>
              <button onClick={step === 1 ? close : () => goTo(step - 1)} style={btnGhost}>
                {step === 1 ? "Cancelar" : "Voltar"}
              </button>
              {step < 5 ? (
                <button
                  onClick={() => goTo(step + 1)}
                  disabled={step === 1 && !parsed}
                  style={{ ...btnPrimary, opacity: step === 1 && !parsed ? 0.5 : 1 }}
                >
                  Continuar
                </button>
              ) : (
                <button onClick={doCommit} disabled={imp.isCommitting || approved.length === 0} style={btnPrimary}>
                  {imp.isCommitting ? "Importando…" : `Importar ${approved.length} negociações`}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={doUndo} disabled={imp.isUndoing || undoArchived !== null} style={btnGhost}>
                {imp.isUndoing ? "Desfazendo…" : "Desfazer importação"}
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={close} style={btnGhost}>
                  Fechar
                </button>
                <button
                  onClick={() => {
                    close();
                    navigate("/pipeline");
                  }}
                  style={btnPrimary}
                >
                  Ver no funil
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function KPI({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 28, color, fontWeight: 600 }}>{value}</div>
      <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.1em", color: T.fog }}>{label}</div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: T.sprout,
  color: T.ink,
  border: "none",
  borderRadius: 8,
  padding: "0 18px",
  height: 38,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: T.ui,
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: T.bone,
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 8,
  padding: "0 18px",
  height: 38,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: T.ui,
};
const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: T.sprout,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: T.mono,
  padding: 0,
};
