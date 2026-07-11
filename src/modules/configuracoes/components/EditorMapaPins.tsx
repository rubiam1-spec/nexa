import { useState } from "react";
import { useMapaPins } from "../../units/hooks/useMapaPins";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { Unidade } from "../../../domain/unidade/Unidade";
import { alinharPorGrade, posicionarAutomaticamente, type PinAlinhado, type PinComMetadata } from "../utils/alinharPins";
import { alinharPinsComIA } from "../utils/alinharPinsComIA";
import { NexaSelect } from "../../../shared/ui/NexaSelect";

const DOT_COLORS: Record<string, string> = {
  [UnidadeStatus.DISPONIVEL]: "#4ade80",
  [UnidadeStatus.EM_NEGOCIACAO]: "#fb923c",
  [UnidadeStatus.RESERVADO]: "#60a5fa",
  [UnidadeStatus.VENDIDO]: "#6b7280",
};

interface Props {
  mapaUrl: string;
  units: Unidade[];
  developmentId: string;
  accountId: string;
  labelAgrupamento: string;
  labelUnidade: string;
}

export default function EditorMapaPins({ mapaUrl, units, developmentId, accountId, labelAgrupamento, labelUnidade }: Props) {
  const { pins, salvarPin, removerPin } = useMapaPins(developmentId);
  const [editando, setEditando] = useState(false);
  const [unitParaVincular, setUnitParaVincular] = useState<Unidade | null>(null);
  const [pinsPreview, setPinsPreview] = useState<PinAlinhado[] | null>(null);
  const [processandoIA, setProcessandoIA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "erro" } | null>(null);

  const semPin = units.filter((u) => !pins.find((p) => p.unitId === u.id));

  // IA progress
  const [iaProgress, setIaProgress] = useState({ step: "Iniciando...", progress: 0 });

  function showToast(msg: string, tipo: "ok" | "erro") { setToast({ msg, tipo }); setTimeout(() => setToast(null), 4000); }

  function handleClickMapa(e: React.MouseEvent<HTMLDivElement>) {
    if (!editando || !unitParaVincular || pinsPreview) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100;
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100;
    void salvarPin({ unitId: unitParaVincular.id, xPct, yPct, developmentId, accountId });
    const next = semPin.filter((u) => u.id !== unitParaVincular.id);
    setUnitParaVincular(next[0] ?? null);
  }

  function getPinsComMeta(): PinComMetadata[] {
    return pins.map((p) => { const u = units.find((x) => x.id === p.unitId); return { ...p, quadra: u?.quadra ?? "1", lote: u?.lote ?? "1" }; });
  }

  function handleAlinharGrade() {
    const alinhados = alinharPorGrade(getPinsComMeta());
    setPinsPreview(alinhados);
  }

  async function handleAlinharIA() {
    setProcessandoIA(true);
    setIaProgress({ step: "Iniciando...", progress: 0 });
    try {
      const alinhados = await alinharPinsComIA(
        getPinsComMeta(),
        (step, progress) => setIaProgress({ step, progress }),
      );
      setPinsPreview(alinhados);
      showToast(`IA posicionou ${alinhados.length} unidades! Ajuste manualmente se necessário.`, "ok");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Erro ao processar com IA. Use alinhamento por grade.", "erro"); }
    finally { setProcessandoIA(false); }
  }

  function handlePosicionarAuto() {
    const all = units.map((u) => ({ id: u.id, quadra: u.quadra, lote: u.lote }));
    const resultado = posicionarAutomaticamente(all);
    setPinsPreview(resultado);
    showToast(`${resultado.length} pins posicionados! Ajuste e salve.`, "ok");
  }

  async function handleConfirmarAlinhamento() {
    if (!pinsPreview) return;
    setSalvando(true);
    try {
      await Promise.all(pinsPreview.map((p) => salvarPin({ unitId: p.unitId, xPct: p.xPct, yPct: p.yPct, developmentId, accountId })));
      setPinsPreview(null);
      showToast(`${pinsPreview.length} pins alinhados com sucesso`, "ok");
    } catch { showToast("Erro ao salvar. Tente novamente.", "erro"); }
    finally { setSalvando(false); }
  }

  // Determine rendered positions: preview overrides originals
  const pinsRenderizados = pins.map((p) => {
    if (pinsPreview) {
      const novo = pinsPreview.find((pv) => pv.unitId === p.unitId);
      if (novo) return { ...p, xPct: novo.xPct, yPct: novo.yPct, emPreview: true };
    }
    return { ...p, emPreview: false };
  });

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`@keyframes pinPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } } @keyframes iaSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast ? (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 300, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: toast.tipo === "ok" ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.tipo === "ok" ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.tipo === "ok" ? "#4ade80" : "#ef4444" }}>
          {toast.msg}
        </div>
      ) : null}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>Editor de Mapa</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)" }}>{pins.length} de {units.length} unidades posicionadas</div>
        </div>
        <button type="button" onClick={() => { setEditando(!editando); setPinsPreview(null); if (!editando && semPin.length > 0) setUnitParaVincular(semPin[0]); }}
          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: editando ? "1px solid var(--color-sprout)" : "1px solid var(--color-stone)", background: editando ? "rgba(74,222,128,0.1)" : "transparent", color: editando ? "var(--color-sprout)" : "var(--color-fog)" }}>
          {editando ? "Finalizar edição" : "Editar posições"}
        </button>
      </div>

      {/* Toolbar */}
      {editando ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: "10px 0", borderTop: "1px solid var(--color-stone)", flexWrap: "wrap" }}>
          <button type="button" onClick={handlePosicionarAuto} disabled={!!pinsPreview || processandoIA}
            style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, padding: "7px 14px", color: "var(--color-sprout)", fontSize: 12, fontWeight: 600, cursor: pinsPreview ? "not-allowed" : "pointer", opacity: pinsPreview ? 0.4 : 1 }}>
            Posicionar todas ({units.length})
          </button>
          {pins.length >= 2 ? (
            <button type="button" onClick={handleAlinharGrade} disabled={!!pinsPreview}
              style={{ background: "transparent", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "7px 14px", color: "var(--color-dust)", fontSize: 12, fontWeight: 600, cursor: pinsPreview ? "not-allowed" : "pointer", opacity: pinsPreview ? 0.4 : 1 }}>
              Alinhar por grade
            </button>
          ) : null}
          {pins.length >= 3 ? (
            <button type="button" onClick={() => void handleAlinharIA()} disabled={processandoIA || !!pinsPreview}
              style={{ background: "transparent", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "7px 14px", color: "var(--color-fog)", fontSize: 12, fontWeight: 600, cursor: processandoIA || !!pinsPreview ? "not-allowed" : "pointer", opacity: processandoIA || !!pinsPreview ? 0.4 : 1 }}>
              {processandoIA ? "IA processando..." : "Refinar com IA"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Preview approval bar */}
      {pinsPreview ? (
        <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-sprout)" }}>Prévia do alinhamento</div>
            <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>Confirme para salvar ou descarte para manter o original.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => setPinsPreview(null)}
              style={{ background: "transparent", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "6px 14px", color: "var(--color-fog)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Descartar
            </button>
            <button type="button" onClick={() => void handleConfirmarAlinhamento()} disabled={salvando}
              style={{ background: "var(--color-sprout)", border: "none", borderRadius: 8, padding: "6px 14px", color: "var(--color-ink)", fontSize: 12, fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer" }}>
              {salvando ? "Salvando..." : "Confirmar e salvar"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Select unit */}
      {editando && !pinsPreview ? (
        <div style={{ marginBottom: 12, padding: 12, background: "var(--color-ink)", borderRadius: 8, border: "1px solid var(--color-stone)" }}>
          <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 8 }}>Selecione uma unidade e clique no mapa:</div>
          <NexaSelect
            value={unitParaVincular?.id ?? ""}
            onChange={(v) => { const u = units.find((x) => x.id === v); setUnitParaVincular(u ?? null); }}
            placeholder={semPin.length === 0 ? "Todas posicionadas" : "Selecione..."}
            ariaLabel="Selecionar unidade"
            allowClear
            options={semPin.map((u) => ({ value: u.id, label: `${labelAgrupamento} ${u.quadra} · ${labelUnidade} ${u.lote}` }))}
          />
          {unitParaVincular ? <div style={{ fontSize: 11, color: "var(--color-sprout)", marginTop: 6 }}>Clique no mapa para posicionar: {labelAgrupamento} {unitParaVincular.quadra} · {labelUnidade} {unitParaVincular.lote}</div> : null}
        </div>
      ) : null}

      {/* Map container */}
      <div style={{ position: "relative", display: "inline-block", width: "100%", cursor: editando && unitParaVincular && !pinsPreview ? "crosshair" : "default", borderRadius: 8, overflow: "hidden" }}
        onClick={editando && unitParaVincular && !pinsPreview ? handleClickMapa : undefined}>
        <img src={mapaUrl} alt="Planta" style={{ width: "100%", display: "block", userSelect: "none", pointerEvents: "none" }} draggable={false} />

        {/* IA Loading overlay */}
        {processandoIA ? (
          <div style={{ position: "absolute", inset: 0, background: "rgba(18,17,15,0.85)", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, borderRadius: 8 }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(74,222,128,0.2)", borderTopColor: "#4ADE80", borderRadius: "50%", animation: "iaSpin 1s linear infinite" }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>{iaProgress.step}</div>
            <div style={{ width: 200, height: 6, borderRadius: 3, background: "rgba(74,222,128,0.15)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${iaProgress.progress}%`, background: "var(--interactive-primary)", borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-disabled)" }}>{iaProgress.progress}% — processando quadra por quadra</div>
          </div>
        ) : null}

        {pinsRenderizados.map((pin) => {
          const unit = units.find((u) => u.id === pin.unitId);
          if (!unit) return null;
          const color = DOT_COLORS[unit.status] ?? "#4ade80";
          return (
            <div key={pin.id} style={{ position: "absolute", left: `${pin.xPct}%`, top: `${pin.yPct}%`, transform: "translate(-50%, -50%)", zIndex: 10, transition: pin.emPreview ? "left 0.5s ease, top 0.5s ease" : "none" }}
              title={`${labelAgrupamento} ${unit.quadra} · ${labelUnidade} ${unit.lote}`}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: pin.emPreview ? "rgba(74,222,128,0.3)" : color,
                border: pin.emPreview ? "2px dashed rgba(74,222,128,0.8)" : "2px solid rgba(255,255,255,0.8)",
                boxShadow: pin.emPreview ? "0 0 8px rgba(74,222,128,0.4)" : "0 1px 4px rgba(0,0,0,0.4)",
                cursor: editando && !pinsPreview ? "pointer" : "default",
                transition: "transform 0.15s",
                animation: pin.emPreview ? "pinPulse 1s ease-in-out infinite" : "none",
              }}
                onClick={(ev) => { ev.stopPropagation(); if (editando && !pinsPreview) void removerPin(pin.unitId); }}
                onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.transform = "scale(1.4)"; }}
                onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = "scale(1)"; }} />
            </div>
          );
        })}
      </div>

      {editando && !pinsPreview ? <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 8, textAlign: "center" }}>Clique no mapa para posicionar · Clique em uma bolinha para remover</div> : null}
    </div>
  );
}
