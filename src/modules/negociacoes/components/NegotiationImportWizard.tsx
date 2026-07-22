// Wizard de importação de negociações (Camada 1, sem IA).
// Modal via createPortal. Toda regra/normalização vem do serviço; aqui só UI/estado.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  rankBrokerOptions,
  rankClientOptions,
  rankUnitOptions,
  toCommitRows,
  STATUS_LABELS,
  ROW_FLAG_LABELS,
  type BrokerDecision,
  type BrokerMatch,
  type ColumnMapping,
  type NegotiationStatus,
  type NexaField,
  type ParsedSheet,
  type StagingRow,
} from "../../../services/negotiationImport";
import ImportCombobox, { type ComboOption } from "./ImportCombobox";
import type { CommitImportResult, UndoImportResult } from "../../../infra/repositories/negotiationImportsSupabaseRepository";

// Sentinelas de "criar novo" usadas pelos comboboxes.
const NEW_BROKER = "__new_broker__";
const NEW_CLIENT = "__new_client__";
// Campos NEXA que só aceitam UM header de origem (quadra_lote e observacao aceitam vários).
const SINGLE_DEST_FIELDS = new Set<NexaField>([
  "cliente",
  "corretor",
  "imobiliaria",
  "status",
  "data",
  "telefone",
  "cpf",
]);

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
  // padding-right generoso: o chevron nativo não pode encostar no texto
  padding: "8px 30px 8px 12px",
  color: T.bone,
  fontSize: 13,
  fontFamily: T.ui,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%239C9686' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
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

// Chip do estado fechado de um combobox (Vinculado / Criar novo / unidade).
function PickChip({ tone, children }: { tone: "blue" | "sprout"; children: React.ReactNode }) {
  const color = tone === "blue" ? T.blue : T.sprout;
  const bg = tone === "blue" ? "rgba(96,165,250,0.12)" : T.sproutMuted;
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: "100%",
        fontFamily: T.mono,
        fontSize: 11,
        color,
        background: bg,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: "2px 8px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

// Botão SECUNDÁRIO de ação em massa (etapa de corretores).
// Fonte de UI (Outfit), tom sprout suave — não compete com o primário "Continuar".
const bulkBtn: React.CSSProperties = {
  fontFamily: T.ui,
  fontSize: 13,
  padding: "9px 14px",
  borderRadius: 8,
  background: T.sproutMuted,
  color: T.sprout,
  border: "1px solid rgba(74,222,128,0.3)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
function BulkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...bulkBtn,
        background: hover ? "rgba(74,222,128,0.2)" : T.sproutMuted,
        borderColor: hover ? "rgba(74,222,128,0.45)" : "rgba(74,222,128,0.3)",
      }}
    >
      {children}
    </button>
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
  const isSmall = screen.width < 480; // < 480: Revisão vira cards expansíveis
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleExpand = (i: number) => setExpandedRows((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
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
  const [showResolvedBrokers, setShowResolvedBrokers] = useState(false);
  const [confirmedBrokers, setConfirmedBrokers] = useState<Record<string, boolean>>({});
  const [mapWarning, setMapWarning] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [committed, setCommitted] = useState<CommitImportResult | null>(null);
  const [undoResult, setUndoResult] = useState<UndoImportResult | null>(null);

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
    setShowResolvedBrokers(false);
    setConfirmedBrokers({});
    setParseError(null);
    setCommitted(null);
    setUndoResult(null);
  }, []);

  const doClose = useCallback(() => {
    reset();
    setConfirmClose(false);
    onClose();
  }, [reset, onClose]);

  // Tarefa longa: nunca descartar sem confirmação. Só fecha direto se não há
  // trabalho (sem arquivo) ou já foi commitado.
  const requestClose = useCallback(() => {
    if (committed || !parsed) doClose();
    else setConfirmClose(true);
  }, [committed, parsed, doClose]);

  // Esc segue o mesmo caminho do X — mas deixa o combobox tratar o seu próprio Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="listbox"]')) return; // dropdown aberto trata o Esc
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

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
        // impede destino duplicado já no auto-detect (campos single → 2º vira ignorar)
        const usedSingle = new Set<NexaField>();
        for (const h of p.headers) {
          const f = auto[h];
          if (f !== "ignorar" && SINGLE_DEST_FIELDS.has(f)) {
            if (usedSingle.has(f)) auto[h] = "ignorar";
            else usedSingle.add(f);
          }
        }
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

  // imobiliárias distintas → chips de filtro do combobox de corretor
  const brokerageFilters = useMemo(() => {
    const set = new Set<string>();
    for (const b of imp.brokers) if (b.brokerageName) set.add(b.brokerageName);
    return [...set].sort().map((n) => ({ label: n, value: n }));
  }, [imp.brokers]);

  // três grupos honestos:
  // auto = vínculo automático (exato/quase) → único colapsável
  // confirm = sugestão fuzzy a confirmar (visível) | new = sem candidato, criar (visível)
  const autoBrokers = useMemo(
    () => brokerMatches.filter((m) => m.suggestion === "existing"),
    [brokerMatches],
  );
  const confirmBrokers = useMemo(
    () => brokerMatches.filter((m) => m.suggestion === "fuzzy"),
    [brokerMatches],
  );
  const newBrokers = useMemo(
    () => brokerMatches.filter((m) => m.suggestion === "new"),
    [brokerMatches],
  );
  const brokerSummary = useMemo(
    () => ({ auto: autoBrokers.length, aConfirmar: confirmBrokers.length, novos: newBrokers.length }),
    [autoBrokers, confirmBrokers, newBrokers],
  );
  // pendência: fuzzy/new ainda não confirmados explicitamente pelo usuário
  const pendingBrokers = useMemo(
    () => [...confirmBrokers, ...newBrokers].filter((m) => !confirmedBrokers[m.normalized]).length,
    [confirmBrokers, newBrokers, confirmedBrokers],
  );
  const confirmBrokerKey = useCallback(
    (normalized: string) => setConfirmedBrokers((c) => ({ ...c, [normalized]: true })),
    [],
  );
  // bulk: só aceita cegamente alta confiança. fuzzy fraco (< minConfidence) e que não
  // seja "novo" continua exigindo um toque individual.
  const HIGH_CONF = 0.7;
  const confirmAllBrokers = useCallback((list: BrokerMatch[], minConfidence = 0) => {
    setConfirmedBrokers((c) => {
      const next = { ...c };
      for (const m of list) {
        if (m.suggestion === "new" || m.confidence >= minConfidence) next[m.normalized] = true;
      }
      return next;
    });
  }, []);
  // contagens dos botões em massa: só o que o clique vai efetivamente vincular/criar.
  // "Aceitar sugestões" toca apenas os fuzzy ≥ HIGH_CONF ainda pendentes.
  const acceptSuggestionCount = useMemo(
    () =>
      confirmBrokers.filter((m) => m.confidence >= HIGH_CONF && !confirmedBrokers[m.normalized])
        .length,
    [confirmBrokers, confirmedBrokers],
  );
  // "Criar novos" toca os sem candidato ainda pendentes.
  const createNewCount = useMemo(
    () => newBrokers.filter((m) => !confirmedBrokers[m.normalized]).length,
    [newBrokers, confirmedBrokers],
  );

  // ---------- helpers de combobox (options vêm do service) ----------
  const brokerOptions = useCallback(
    (raw: string): ComboOption[] => [
      ...rankBrokerOptions(raw, imp.brokers),
      { id: NEW_BROKER, label: `Criar novo: ${raw}`, isCreateNew: true },
    ],
    [imp.brokers],
  );
  const setBrokerDecision = useCallback(
    (normalized: string, raw: string, id: string) => {
      const b = imp.brokers.find((x) => x.id === id);
      setBrokerDecisions((s) => ({
        ...s,
        [normalized]:
          id === NEW_BROKER || !b
            ? { brokerId: null, brokerName: raw }
            : { brokerId: b.id, brokerName: b.name, brokerageName: b.brokerageName ?? null },
      }));
      // escolher no combobox conta como confirmação explícita
      confirmBrokerKey(normalized);
    },
    [imp.brokers, confirmBrokerKey],
  );

  const unitOptions = useCallback(
    (row: StagingRow): ComboOption[] => rankUnitOptions(row.quadra, row.lote, imp.units),
    [imp.units],
  );
  const setRowUnit = useCallback((index: number, unitId: string) => {
    setRows((all) => all.map((x) => (x.index === index ? { ...x, unitId } : x)));
  }, []);

  const clientOptions = useCallback(
    (row: StagingRow): ComboOption[] => [
      ...rankClientOptions(row.clientName, imp.clients),
      { id: NEW_CLIENT, label: `Criar novo: ${row.clientName ?? "contato"}`, isCreateNew: true },
    ],
    [imp.clients],
  );
  const setRowClient = useCallback((index: number, id: string) => {
    setRows((all) =>
      all.map((x) => (x.index === index ? { ...x, clientId: id === NEW_CLIENT ? null : id } : x)),
    );
  }, []);

  // mapeamento: impede dois headers no mesmo destino (campos single)
  const setFieldMapping = useCallback(
    (header: string, field: NexaField) => {
      if (field !== "ignorar" && SINGLE_DEST_FIELDS.has(field)) {
        const conflict = Object.entries(mapping).find(([h2, f2]) => h2 !== header && f2 === field);
        setMapWarning(
          conflict ? `Campo já usado em "${conflict[0]}" — mantido em "${header}".` : null,
        );
      } else {
        setMapWarning(null);
      }
      setMapping((m) => {
        const next = { ...m, [header]: field };
        if (field !== "ignorar" && SINGLE_DEST_FIELDS.has(field)) {
          for (const h2 of Object.keys(next)) {
            if (h2 !== header && next[h2] === field) next[h2] = "ignorar";
          }
        }
        return next;
      });
    },
    [mapping],
  );

  const unitLabel = useCallback(
    (id: string | null) => {
      const u = imp.units.find((x) => x.id === id);
      return u ? `Q${u.quadra} · L${u.lote}` : "Unidade";
    },
    [imp.units],
  );

  // linha de resolução de corretor. needsConfirm: fuzzy/new exigem confirmação explícita.
  const renderBrokerRow = (m: BrokerMatch, needsConfirm = false) => {
    const dec = brokerDecisions[m.normalized];
    const linked = dec?.brokerId ?? null;
    const confirmed = !!confirmedBrokers[m.normalized];
    return (
      <div
        key={m.normalized}
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : needsConfirm ? "1fr 240px 116px" : "1fr 260px",
          gap: 10,
          alignItems: "center",
          background: CARD_BG,
          border: `1px solid ${needsConfirm && !confirmed ? "rgba(251,191,36,0.25)" : T.border}`,
          borderRadius: 10,
          padding: "10px 12px",
        }}
      >
        <div style={{ color: T.bone, fontSize: 13, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{m.raw}</span>
          <span style={{ color: T.fog, fontSize: 11, marginLeft: 8 }}>×{m.count}</span>
          {m.suggestion === "fuzzy" && m.existingName && (
            <span style={{ marginLeft: 8 }}>
              <Tag text={`~${Math.round(m.confidence * 100)}% ${m.existingName}`} color={T.yellow} />
            </span>
          )}
          {m.suggestion === "new" && (
            <span style={{ marginLeft: 8 }}>
              <Tag text="sem correspondência" color={T.fog} />
            </span>
          )}
          {m.mergeWith.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              <Tag text={`fundir com ${m.mergeWith.join(", ")}`} color={T.blue} />
            </span>
          )}
        </div>
        <ImportCombobox
          options={brokerOptions(m.raw)}
          value={linked ?? NEW_BROKER}
          onChange={(id) => setBrokerDecision(m.normalized, m.raw, id)}
          placeholder="Buscar corretor ou imobiliária…"
          filters={brokerageFilters}
          closedLabel={
            linked ? (
              <PickChip tone="blue">Vinculado: {dec?.brokerName}</PickChip>
            ) : (
              <PickChip tone="sprout">Criar novo: {dec?.brokerName ?? m.raw}</PickChip>
            )
          }
          ariaLabel={`Resolver corretor ${m.raw}`}
        />
        {needsConfirm && (
          <button
            type="button"
            onClick={() => confirmBrokerKey(m.normalized)}
            disabled={confirmed}
            style={{
              height: 38,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: T.ui,
              cursor: confirmed ? "default" : "pointer",
              color: confirmed ? T.sprout : T.ink,
              background: confirmed ? "transparent" : T.sprout,
              border: confirmed ? `1px solid ${T.borderStrong}` : "none",
            }}
          >
            {confirmed ? "✓ Confirmado" : "Confirmar"}
          </button>
        )}
      </div>
    );
  };

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
    const fresh = buildStaging({
      parsed,
      mapping,
      existingBrokers: imp.brokers,
      units: imp.units,
      clients: imp.clients,
      statusOverrides,
      brokerDecisions,
    });
    // preserva edições manuais feitas na revisão ao ir-e-voltar entre passos
    setRows((prev) => {
      if (prev.length === 0) return fresh;
      const byIndex = new Map(prev.map((r) => [r.index, r]));
      return fresh.map((f) => {
        const old = byIndex.get(f.index);
        return old
          ? {
              ...f,
              unitId: old.unitId ?? f.unitId,
              clientId: old.clientId,
              status: old.status,
              statusClass: old.statusClass,
              approved: old.approved,
            }
          : f;
      });
    });
  }, [parsed, mapping, imp.brokers, imp.units, imp.clients, statusOverrides, brokerDecisions]);

  // ---------- navegação entre etapas (6 passos) ----------
  // 1 upload · 2 mapeamento · 3 status · 4 corretores · 5 revisão · 6 confirmar
  const goTo = useCallback(
    (next: number) => {
      if (next === 4) initBrokerDecisions();
      if (next === 5) recomputeRows();
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
    const result = await imp.runUndo(committed.batchId);
    if (result !== null) {
      setUndoResult(result);
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

  const STEPS = ["Upload", "Mapeamento", "Status", "Corretores", "Revisão", "Confirmar"];

  const panelStyle: React.CSSProperties = isMobile
    ? {
        width: "100vw",
        height: "100dvh",
        maxHeight: "none",
        display: "flex",
        flexDirection: "column",
        background: CARD_BG,
        borderRadius: 0,
        overflow: "hidden",
      }
    : {
        width: "min(1040px, 92vw)",
        maxHeight: "88vh",
        display: "flex",
        flexDirection: "column",
        background: CARD_BG,
        border: `1px solid ${T.borderStrong}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 24,
        background: "rgba(0,0,0,0.6)",
        fontFamily: T.ui,
      }}
    >
      {/* Tarefa longa: clicar fora NÃO fecha (evita descartar trabalho por engano). */}
      <div style={panelStyle}>
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
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
              {developmentName ? developmentName.toUpperCase() : "EMPREENDIMENTO ATIVO"} · ETAPA {step}/{STEPS.length} · {STEPS[step - 1].toUpperCase()}
            </div>
          </div>
          <button
            onClick={requestClose}
            style={{ background: "transparent", border: "none", color: T.fog, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Stepper */}
        <div style={{ flexShrink: 0, display: "flex", gap: 4, padding: "10px 20px 0" }}>
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

        {/* Body — a rolagem fica aqui, não na página */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
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
              {mapWarning && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: T.yellow,
                    background: "rgba(251,191,36,0.1)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  {mapWarning}
                </div>
              )}
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {parsed.headers.map((h) => {
                  const field = mapping[h] ?? "ignorar";
                  const ignored = field === "ignorar";
                  const isAuto = !ignored && autoFields[h] === field;
                  // "ignorar" é neutro (intencional); só auto/manual nos campos usados
                  const tagText = ignored ? "ignorar" : isAuto ? "auto" : "manual";
                  const tagColor = ignored ? T.fog : isAuto ? T.sprout : T.blue;
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
                        opacity: ignored ? 0.7 : 1,
                      }}
                    >
                      <div style={{ color: T.bone, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {h}
                      </div>
                      <Tag text={tagText} color={tagColor} />
                      <select
                        style={selectStyle}
                        value={field}
                        onChange={(e) => setFieldMapping(h, e.target.value as NexaField)}
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

          {/* ====== ETAPA 3 — STATUS ====== */}
          {step === 3 && parsed && (
            <div>
              <div style={sectionLabel}>DE-PARA DE STATUS</div>
              <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 11, color: T.dust }}>
                {distinctStatuses.length} valores distintos
              </div>
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
          )}

          {/* ====== ETAPA 4 — CORRETORES ====== */}
          {step === 4 && parsed && (
            <div>
                <div style={sectionLabel}>CORRETORES</div>
                <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 11, color: T.dust }}>
                  <span style={{ color: T.sprout }}>{brokerSummary.auto} vinculados automaticamente</span> ·{" "}
                  <span style={{ color: brokerSummary.aConfirmar ? T.yellow : T.fog }}>
                    {brokerSummary.aConfirmar} a confirmar
                  </span>{" "}
                  ·{" "}
                  <span style={{ color: brokerSummary.novos ? T.blue : T.fog }}>
                    {brokerSummary.novos} novos a criar
                  </span>
                </div>

                {brokerMatches.length === 0 && (
                  <div style={{ marginTop: 10, color: T.fog, fontSize: 13 }}>
                    Nenhum corretor identificado nas linhas.
                  </div>
                )}

                {/* A confirmar (visível) */}
                {confirmBrokers.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.yellow, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        A confirmar · {confirmBrokers.length}
                      </div>
                      {acceptSuggestionCount > 0 && (
                        <BulkButton onClick={() => confirmAllBrokers(confirmBrokers, HIGH_CONF)}>
                          Aceitar sugestões ({acceptSuggestionCount})
                        </BulkButton>
                      )}
                    </div>
                    {acceptSuggestionCount > 0 && (
                      <div style={{ marginTop: 4, fontSize: 12, color: T.fog }}>
                        Vincula as correspondências mais prováveis; as duvidosas você confirma uma a uma.
                      </div>
                    )}
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      {confirmBrokers.map((m) => renderBrokerRow(m, true))}
                    </div>
                  </div>
                )}

                {/* Novos a criar (sempre visível) */}
                {newBrokers.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.blue, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Novos a criar · {newBrokers.length}
                      </div>
                      {createNewCount > 0 && (
                        <BulkButton onClick={() => confirmAllBrokers(newBrokers)}>
                          Criar novos ({createNewCount})
                        </BulkButton>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: T.fog }}>
                      Sem correspondência entre os {imp.brokers.length} corretores da conta. Busque para
                      vincular a um existente ou confirme para criar.
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      {newBrokers.map((m) => renderBrokerRow(m, true))}
                    </div>
                  </div>
                )}

                {/* Vinculados automaticamente (único colapsável) */}
                {autoBrokers.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <button onClick={() => setShowResolvedBrokers((p) => !p)} style={linkBtn}>
                      {showResolvedBrokers ? "Ocultar" : "Ver"} vinculados automaticamente ({autoBrokers.length})
                    </button>
                    {showResolvedBrokers && (
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        {autoBrokers.map((m) => renderBrokerRow(m, false))}
                      </div>
                    )}
                  </div>
                )}
              </div>
          )}

          {/* ====== ETAPA 5 — REVISÃO ====== */}
          {step === 5 && (
            <div>
              <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
                <KPI value={approved.length} label="PRONTAS" color={T.sprout} />
                <KPI value={counts.revisar} label="A REVISAR" color={T.yellow} />
                <KPI value={counts.erros} label="SEM CLIENTE" color={T.red} />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                }}
              >
                <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.dust, fontSize: 13 }}>
                  <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
                  Mostrar apenas linhas a revisar
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.dust, fontSize: 12 }}>
                  Duplicatas:
                  <select
                    style={{ ...selectStyle, width: "auto", minWidth: 200, padding: "6px 30px 6px 10px" }}
                    value={dupStrategy}
                    onChange={(e) => setDupStrategy(e.target.value as "skip" | "update" | "create")}
                  >
                    <option value="skip">Ignorar duplicatas (recomendado)</option>
                    <option value="update">Atualizar status da existente</option>
                    <option value="create">Criar mesmo assim</option>
                  </select>
                </label>
              </div>
              {isSmall ? (
                /* <480px: cada linha vira um card (resumo + tap expande edição vertical) */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rows.filter((r) => (onlyReview ? r.flags.length > 0 : true)).map((r) => {
                    const expanded = expandedRows.has(r.index);
                    const ql = r.quadra && r.lote ? `Q${r.quadra}/L${r.lote}` : "—";
                    const linkCliente = r.clientLinkSuggested;
                    const escolherUnidade = r.flags.includes("unidade_nao_encontrada") || r.flags.includes("multiplos_lotes");
                    return (
                      <div key={r.index} style={{ border: `1px solid ${T.border}`, borderRadius: 10, background: T.layer1, overflow: "hidden" }}>
                        {/* RESUMO — tap expande */}
                        <button type="button" onClick={() => toggleExpand(r.index)} style={{ width: "100%", minHeight: 44, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                          <input type="checkbox" checked={r.approved} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); setRows((all) => all.map((x) => (x.index === r.index ? { ...x, approved: e.target.checked } : x))); }} style={{ width: 20, height: 20, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: r.clientName ? T.bone : T.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.index}. {r.clientName || "sem cliente"}</span>
                            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 3, fontFamily: T.mono, fontSize: 10.5, color: T.fog }}>
                              <span>{ql}</span><span>· {STATUS_LABELS[r.status]}</span>
                              {r.permuta && <Tag text="permuta" color={T.terracotta} />}
                              {r.flags.filter((f) => f !== "permuta").map((f) => <Tag key={f} text={ROW_FLAG_LABELS[f]} color={f === "sem_cliente" ? T.red : T.yellow} />)}
                            </span>
                          </span>
                          <span style={{ color: T.fog, fontSize: 12, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
                        </button>
                        {/* EDIÇÃO VERTICAL */}
                        {expanded && (
                          <div style={{ display: "grid", gap: 12, padding: "4px 12px 14px", borderTop: `1px solid ${T.border}` }}>
                            {linkCliente && (
                              <label style={{ display: "grid", gap: 4, fontSize: 11, color: T.fog }}>Vincular contato
                                <ImportCombobox options={clientOptions(r)} value={r.clientId ?? NEW_CLIENT} onChange={(id) => setRowClient(r.index, id)} placeholder="Vincular a contato…" closedLabel={r.clientId ? <PickChip tone="blue">Vinculado</PickChip> : <PickChip tone="sprout">Criar novo</PickChip>} ariaLabel={`Vincular cliente linha ${r.index}`} />
                              </label>
                            )}
                            {escolherUnidade && (
                              <label style={{ display: "grid", gap: 4, fontSize: 11, color: T.fog }}>Unidade
                                <ImportCombobox options={unitOptions(r)} value={r.unitId} onChange={(id) => setRowUnit(r.index, id)} placeholder="Buscar quadra/lote…" closedLabel={r.unitId ? <PickChip tone="sprout">{unitLabel(r.unitId)}</PickChip> : <span style={{ color: T.yellow, fontFamily: T.mono, fontSize: 11 }}>{ql} ?</span>} ariaLabel={`Escolher unidade linha ${r.index}`} />
                              </label>
                            )}
                            <label style={{ display: "grid", gap: 4, fontSize: 11, color: T.fog }}>Status
                              <select style={{ ...selectStyle, minHeight: 40 }} value={r.status} onChange={(e) => setRows((all) => all.map((x) => (x.index === r.index ? { ...x, status: e.target.value as NegotiationStatus, statusClass: ["WON", "LOST", "CANCELLED"].includes(e.target.value) ? "arquivada" : "ativa" } : x)))}>
                                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                              </select>
                            </label>
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: T.mono, fontSize: 11, color: T.dust }}>
                              <span>Corretor: {r.brokerName ?? "—"}</span>
                              <span>Data: {r.createdAt ?? "—"}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
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
                          <td style={{ padding: "8px 10px", color: T.bone, minWidth: r.clientLinkSuggested ? 210 : undefined }}>
                            {r.clientName ? (
                              r.clientLinkSuggested ? (
                                <div style={{ display: "grid", gap: 4 }}>
                                  <span>{r.clientName}</span>
                                  <ImportCombobox
                                    options={clientOptions(r)}
                                    value={r.clientId ?? NEW_CLIENT}
                                    onChange={(id) => setRowClient(r.index, id)}
                                    placeholder="Vincular a contato…"
                                    closedLabel={
                                      r.clientId ? (
                                        <PickChip tone="blue">Vinculado</PickChip>
                                      ) : (
                                        <PickChip tone="sprout">Criar novo</PickChip>
                                      )
                                    }
                                    ariaLabel={`Vincular cliente linha ${r.index}`}
                                  />
                                </div>
                              ) : (
                                r.clientName
                              )
                            ) : (
                              <span style={{ color: T.red }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", color: T.dust }}>{r.brokerName ?? "—"}</td>
                          <td style={{ padding: "8px 10px" }}>
                            {r.flags.includes("unidade_nao_encontrada") || r.flags.includes("multiplos_lotes") ? (
                              <div style={{ minWidth: 190 }}>
                                <ImportCombobox
                                  options={unitOptions(r)}
                                  value={r.unitId}
                                  onChange={(id) => setRowUnit(r.index, id)}
                                  placeholder="Buscar quadra/lote…"
                                  closedLabel={
                                    r.unitId ? (
                                      <PickChip tone="sprout">{unitLabel(r.unitId)}</PickChip>
                                    ) : (
                                      <span style={{ color: T.yellow, fontFamily: T.mono, fontSize: 11 }}>
                                        {r.quadra && r.lote ? `Q${r.quadra}/L${r.lote} ?` : "escolher"}
                                      </span>
                                    )
                                  }
                                  ariaLabel={`Escolher unidade linha ${r.index}`}
                                />
                              </div>
                            ) : (
                              <span style={{ fontFamily: T.mono, color: r.unitId ? T.sprout : T.fog }}>
                                {r.quadra && r.lote ? `Q${r.quadra}/L${r.lote}` : "—"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <select
                              style={{ ...selectStyle, padding: "4px 22px 4px 8px", fontSize: 11, minHeight: 30, backgroundPosition: "right 8px center" }}
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
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: T.fog }}>Nada é gravado nesta etapa.</div>
            </div>
          )}

          {/* ====== ETAPA 6 — CONFIRMAR ====== */}
          {step === 6 && !committed && (
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

          {/* ====== ETAPA 6 — sucesso ====== */}
          {step === 6 && committed && (
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
              {undoResult !== null && (
                <div style={{ marginTop: 14, color: T.terracotta, fontSize: 13 }}>
                  Importação desfeita — {undoResult.deleted} negociações removidas.
                  {" "}
                  {undoResult.clientsKept} contatos e {undoResult.brokersKept} corretores preservados.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — sempre visível na base do painel */}
        <div
          style={{
            flexShrink: 0,
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
              <button onClick={step === 1 ? requestClose : () => goTo(step - 1)} style={btnGhost}>
                {step === 1 ? "Cancelar" : "Voltar"}
              </button>
              {step < 6 ? (
                (() => {
                  const blocked = (step === 1 && !parsed) || (step === 4 && pendingBrokers > 0);
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {step === 4 && pendingBrokers > 0 && (
                        <span style={{ fontSize: 12, color: T.yellow }}>
                          {pendingBrokers} corretor(es) a confirmar
                        </span>
                      )}
                      {step === 4 && pendingBrokers === 0 && newBrokers.length > 0 && (
                        <span style={{ fontSize: 12, color: T.fog }}>
                          {newBrokers.length} novo(s) corretor(es) serão criados
                        </span>
                      )}
                      <button
                        onClick={() => goTo(step + 1)}
                        disabled={blocked}
                        style={{
                          ...btnPrimary,
                          opacity: blocked ? 0.5 : 1,
                          cursor: blocked ? "not-allowed" : "pointer",
                        }}
                      >
                        Continuar
                      </button>
                    </div>
                  );
                })()
              ) : (
                <button onClick={doCommit} disabled={imp.isCommitting || approved.length === 0} style={btnPrimary}>
                  {imp.isCommitting ? "Importando…" : `Importar ${approved.length} negociações`}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={doUndo} disabled={imp.isUndoing || undoResult !== null} style={btnGhost}>
                {imp.isUndoing ? "Desfazendo…" : "Desfazer importação"}
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={doClose} style={btnGhost}>
                  Fechar
                </button>
                <button
                  onClick={() => {
                    doClose();
                    navigate("/negociacoes");
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

      {/* Confirmação de descarte — só some o trabalho após o usuário confirmar */}
      {confirmClose && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              width: "min(420px, 92vw)",
              background: CARD_BG,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ fontFamily: "var(--font-serif, 'Instrument Serif', serif)", fontStyle: "italic", fontSize: 19, color: T.chalk }}>
              Descartar importação?
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: T.dust }}>
              Você vai perder o mapeamento e as resoluções feitas.
            </div>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setConfirmClose(false)} style={btnGhost}>
                Continuar editando
              </button>
              <button onClick={doClose} style={{ ...btnPrimary, background: T.red, color: T.chalk }}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
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
