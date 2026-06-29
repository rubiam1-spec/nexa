// Captura rápida (Onda 1) — folha inferior única acionada pelo FAB e pelo
// "+ adicionar à coluna" no mobile. Reusa parseQuickCapture (mesmo parser do
// quick-add do Quadro) e converge para onCreate (otimista) ou onMoreOptions
// (abre o editor completo já preenchido). Sem regra de negócio aqui.
import { useEffect, useMemo, useState } from "react";
import { BottomSheet, TypeChipGrid } from "./mobileKit";
import { parseQuickCapture, type QuickParsed } from "../config/quickParse";
import type { ActivityKind } from "../../../infra/repositories/activityKindsRepository";

type GroupedKinds = {
  comercial: ActivityKind[];
  interno: ActivityKind[];
  operacional: ActivityKind[];
  byKey: Record<string, ActivityKind>;
};

const T = {
  ink: "var(--surface-base)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  sprout: "var(--interactive-primary)",
};
const MONO = "var(--font-mono)";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowHHMM() {
  const n = new Date();
  const r = Math.round(n.getMinutes() / 15) * 15;
  const h = r >= 60 ? n.getHours() + 1 : n.getHours();
  return `${String(h).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
}
function fmtDayMonth(s: string) { const [, m, d] = s.split("-"); return `${d}/${m}`; }

export default function QuickCaptureSheet({
  open,
  onClose,
  kinds,
  teamProfiles,
  initialMode = "done",
  columnName,
  onCreate,
  onMoreOptions,
}: {
  open: boolean;
  onClose: () => void;
  kinds: GroupedKinds;
  teamProfiles: { id: string; name: string }[];
  initialMode?: "plan" | "done";
  columnName?: string | null;
  onCreate: (parsed: QuickParsed & { title: string }, mode: "plan" | "done") => void | Promise<void>;
  onMoreOptions: (prefill: { title: string; kind: ActivityKind | null; mode: "plan" | "done" }) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"plan" | "done">(initialMode);
  const [manualKind, setManualKind] = useState<ActivityKind | null>(null);
  const [override, setOverride] = useState<{ date?: string; time?: string }>({});
  const [busy, setBusy] = useState(false);

  // Reset ao abrir.
  useEffect(() => {
    if (open) { setText(""); setManualKind(null); setOverride({}); setMode(initialMode); setBusy(false); }
  }, [open, initialMode]);

  // Parse com debounce só para os chips de feedback.
  const [parsed, setParsed] = useState<QuickParsed>({ kind: null });
  useEffect(() => {
    if (!text.trim()) { setParsed({ kind: null }); return; }
    const id = setTimeout(() => setParsed(parseQuickCapture(text, kinds.byKey, teamProfiles)), 200);
    return () => clearTimeout(id);
  }, [text, kinds.byKey, teamProfiles]);

  const effKind = manualKind ?? parsed.kind;
  const effDate = override.date ?? parsed.date ?? todayStr();
  const effTime = override.time ?? parsed.time ?? (mode === "done" ? nowHHMM() : undefined);
  const canCreate = text.trim().length > 0 && !busy;

  const buildParsed = (): QuickParsed & { title: string } => ({
    kind: effKind ?? kinds.byKey.other ?? null,
    date: effDate,
    time: effTime,
    participant: parsed.participant,
    title: text.trim(),
  });

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      await onCreate(buildParsed(), mode);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const usingNow = useMemo(
    () => !override.date && !parsed.date && !override.time && !parsed.time,
    [override, parsed],
  );

  const seg = (m: "plan" | "done", label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      style={{
        flex: 1,
        minHeight: 44,
        border: "none",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        color: mode === m ? "var(--surface-base)" : T.fog,
        background: mode === m ? T.sprout : "transparent",
      }}
    >
      {label}
    </button>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    background: "var(--surface-base)",
    border: `1px solid ${T.stone}`,
    borderRadius: 10,
    padding: "12px 14px",
    color: T.chalk,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Captura rápida"
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => onMoreOptions({ title: text.trim(), kind: effKind ?? null, mode })}
            style={{ flex: 1, minHeight: 48, borderRadius: 10, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Mais opções
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canCreate}
            style={{ flex: 2, minHeight: 48, borderRadius: 10, border: "none", background: T.sprout, color: "var(--surface-base)", fontSize: 14, fontWeight: 700, cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : 0.5 }}
          >
            {busy ? "Criando…" : mode === "plan" ? "Planejar" : "Registrar"}
          </button>
        </div>
      }
    >
      {/* Já feita / Planejar */}
      <div style={{ display: "flex", border: `1px solid ${T.stone}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
        {seg("done", "Já feita")}
        <div style={{ width: 1, background: T.stone }} />
        {seg("plan", "Planejar")}
      </div>
      {columnName && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: T.fog, marginBottom: 8 }}>
          Coluna: <span style={{ color: T.bone }}>{columnName}</span>
        </div>
      )}

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
        placeholder="Ex: ligar pro João amanhã 10h"
        rows={2}
        style={{ ...inputStyle, resize: "none" }}
      />

      {/* Chips de interpretação + Agora */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setOverride({ date: todayStr(), time: mode === "done" ? nowHHMM() : undefined })}
          style={{ minHeight: 36, padding: "6px 12px", borderRadius: 16, border: `1px solid ${usingNow ? T.sprout : T.stone}`, background: usingNow ? "rgba(74,222,128,0.12)" : "transparent", color: usingNow ? T.sprout : T.bone, fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: "pointer" }}
        >
          Agora
        </button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: T.fog }}>
          {effDate === todayStr() ? "Hoje" : fmtDayMonth(effDate)}{effTime ? ` · ${effTime}` : ""}
        </span>
        {parsed.participant && (
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: T.sprout, background: "rgba(74,222,128,0.12)", border: `1px solid ${T.sprout}30`, borderRadius: 12, padding: "2px 8px" }}>
            @{parsed.participant.name.split(" ")[0]}
          </span>
        )}
      </div>

      {/* Tipo (catálogo) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontWeight: 600 }}>Tipo</div>
        <TypeChipGrid kinds={kinds} selectedKey={effKind?.key ?? null} onPick={(k) => setManualKind(k)} />
      </div>
    </BottomSheet>
  );
}
