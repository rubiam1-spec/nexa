import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { Unidade } from "../../../domain/unidade/Unidade";
import type { MapaPin } from "../hooks/useMapaPins";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { imageAspectRatio } from "../../../shared/utils/mapGeometry";

const CFG: Record<string, { bg: string; text: string; glow: string; label: string }> = {
  [UnidadeStatus.DISPONIVEL]: { bg: "#4ADE80", text: "#12110F", glow: "rgba(74,222,128,0.35)", label: "Disponível" },
  [UnidadeStatus.EM_NEGOCIACAO]: { bg: "#F59E0B", text: "#12110F", glow: "rgba(245,158,11,0.35)", label: "Em negociação" },
  [UnidadeStatus.RESERVADO]: { bg: "#F59E0B", text: "#12110F", glow: "rgba(245,158,11,0.35)", label: "Reservado" },
  [UnidadeStatus.VENDIDO]: { bg: "#E24B4A", text: "#FFFFFF", glow: "rgba(226,75,74,0.3)", label: "Vendido" },
};
const fmtK = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${v}`;

interface Props {
  mapaUrl: string; units: Unidade[]; pins: MapaPin[];
  labelAgrupamento: string; labelUnidade: string;
  quadras: string[]; selectedQuadra: string | null; onQuadraChange: (q: string | null) => void;
  // Desktop toolbar props
  logoUrl?: string | null; developmentName?: string;
  activeView?: string; onViewChange?: (v: "mapa" | "interativo" | "tabela") => void; hasPlanta?: boolean;
  /**
   * Callback chamado quando o usuário tapa/clica em um pin ou numa linha
   * da lista lateral. Quando definido, o detalhe da unidade é exibido pelo
   * pai (UnitsPage) via seu painel único, e NÃO pelo popup/sheet interno
   * deste componente. Evita duplicação de sheets.
   */
  onSelectUnit?: (unitId: string) => void;
}

interface MapTransform { scale: number; x: number; y: number }
const IDENTITY: MapTransform = { scale: 1, x: 0, y: 0 };

export default function MapaInterativo({ mapaUrl, units, pins, labelAgrupamento, labelUnidade, quadras, selectedQuadra, onQuadraChange, logoUrl, developmentName, activeView, onViewChange, hasPlanta, onSelectUnit }: Props) {
  const isMobile = useIsMobile();
  // Estado interno mantido apenas para destacar o pin clicado quando não há
  // onSelectUnit (fallback). Quando o callback externo está ativo, delegamos
  // o ciclo de vida do detalhe ao pai.
  const [sel, setSel] = useState<Unidade | null>(null);
  const [, setSelPin] = useState<MapaPin | null>(null);
  // Aspect ratio real da imagem do mapa (naturalWidth/naturalHeight). Usado
  // para forçar o container a ter a mesma proporção — garantindo que pins
  // calibrados em % fiquem alinhados com o desenho em qualquer viewport.
  const [mapRatio, setMapRatio] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [transform, setTransform] = useState<MapTransform>(IDENTITY);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ startScale: 1, startX: 0, startY: 0, startDist: 0, midX: 0, midY: 0, lastCount: 0 });

  const handlePinClick = useCallback((unit: Unidade, pin: MapaPin) => {
    if (onSelectUnit) {
      onSelectUnit(unit.id);
      return;
    }
    setSel(unit);
    setSelPin(pin);
  }, [onSelectUnit]);
  const handleClose = useCallback(() => { setSel(null); setSelPin(null); }, []);
  useEffect(() => { if (highlightId) { const t = setTimeout(() => setHighlightId(null), 2000); return () => clearTimeout(t); } }, [highlightId]);

  // ── Counts ──
  // Counts per quadra
  const quadraCounts = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const u of units) {
      if (!m[u.quadra]) m[u.quadra] = {};
      m[u.quadra][u.status] = (m[u.quadra][u.status] || 0) + 1;
    }
    return m;
  }, [units]);

  // Visible counts (filtered)
  const visibleCounts = useMemo(() => {
    const src = selectedQuadra ? units.filter((u) => u.quadra === selectedQuadra) : units;
    const c: Record<string, number> = {};
    for (const u of src) c[u.status] = (c[u.status] || 0) + 1;
    return c;
  }, [units, selectedQuadra]);

  // ── Desktop: show ALL pins, fade non-selected quadra. Mobile: filter. ──
  const visiblePins = useMemo(() => {
    if (isMobile && selectedQuadra) {
      const ids = new Set(units.filter((u) => u.quadra === selectedQuadra).map((u) => u.id));
      return pins.filter((p) => ids.has(p.unitId));
    }
    return pins; // Desktop: show all, use opacity for fade
  }, [pins, units, selectedQuadra, isMobile]);

  const visibleUnits = useMemo(() => selectedQuadra ? units.filter((u) => u.quadra === selectedQuadra) : units, [units, selectedQuadra]);
  const sortedVisibleUnits = useMemo(() => [...visibleUnits].sort((a, b) => { const na = parseInt(a.lote), nb = parseInt(b.lote); return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote); }), [visibleUnits]);

  // ── Pin config — use filtered count (not total visible which includes faded pins on desktop) ──
  const activePinCount = useMemo(() => {
    if (!selectedQuadra) return pins.length;
    const ids = new Set(units.filter((u) => u.quadra === selectedQuadra).map((u) => u.id));
    return pins.filter((p) => ids.has(p.unitId)).length;
  }, [pins, units, selectedQuadra]);

  const pinCfg = useMemo(() => {
    if (activePinCount <= 35) return { size: 28, h: 24, fontSize: 10, showLabel: true, showArrow: true };
    if (activePinCount <= 80) return { size: 22, h: 20, fontSize: 9, showLabel: true, showArrow: false };
    return { size: 16, h: 16, fontSize: 0, showLabel: false, showArrow: false };
  }, [activePinCount]);

  // ── Zoom ──
  const zoomToQuadra = useCallback((quadra: string | null) => {
    if (!quadra) { setIsAnimating(true); setTransform(IDENTITY); setTimeout(() => setIsAnimating(false), 500); return; }
    const qPins = pins.filter((p) => { const u = units.find((u2) => u2.id === p.unitId); return u && u.quadra === quadra; });
    if (qPins.length === 0) return;
    const xs = qPins.map((p) => p.xPct), ys = qPins.map((p) => p.yPct);
    const margin = 6;
    const minX = Math.max(0, Math.min(...xs) - margin), maxX = Math.min(100, Math.max(...xs) + margin);
    const minY = Math.max(0, Math.min(...ys) - margin), maxY = Math.min(100, Math.max(...ys) + margin);
    const clampedScale = Math.max(Math.min(100 / (maxX - minX), 100 / (maxY - minY), 5) * 0.85, 1);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const el = containerRef.current; if (!el) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const tx = cw / 2 - (cx / 100) * cw * clampedScale;
    const inner = innerRef.current; const imgH = inner ? inner.scrollHeight : ch;
    const tyImg = ch / 2 - (cy / 100) * imgH * clampedScale;
    setIsAnimating(true); setTransform({ scale: clampedScale, x: tx, y: tyImg }); setTimeout(() => setIsAnimating(false), 500);
  }, [pins, units]);

  const handleQuadraChange = useCallback((q: string | null) => { onQuadraChange(q); handleClose(); setTimeout(() => zoomToQuadra(q), 50); }, [onQuadraChange, handleClose, zoomToQuadra]);
  const resetZoom = useCallback(() => { setIsAnimating(true); setTransform(IDENTITY); onQuadraChange(null); setTimeout(() => setIsAnimating(false), 500); }, [onQuadraChange]);

  // ── Touch gestures ──
  useEffect(() => {
    const el = containerRef.current; if (!el || !isMobile) return;
    const getDist = (t1: Touch, t2: Touch) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const onTS = (e: TouchEvent) => { const tr = touchRef.current; if (e.touches.length === 2) { e.preventDefault(); const d = getDist(e.touches[0], e.touches[1]); tr.startScale = transform.scale; tr.startX = transform.x; tr.startY = transform.y; tr.startDist = d; tr.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2; tr.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2; } else if (e.touches.length === 1 && transform.scale > 1) { tr.startX = transform.x; tr.startY = transform.y; tr.midX = e.touches[0].clientX; tr.midY = e.touches[0].clientY; } tr.lastCount = e.touches.length; };
    const onTM = (e: TouchEvent) => { const tr = touchRef.current; if (e.touches.length === 2) { e.preventDefault(); const d = getDist(e.touches[0], e.touches[1]); const ns = Math.min(Math.max(tr.startScale * (d / tr.startDist), 1), 6); const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2; const my = (e.touches[0].clientY + e.touches[1].clientY) / 2; setTransform({ scale: ns, x: tr.startX + (mx - tr.midX), y: tr.startY + (my - tr.midY) }); } else if (e.touches.length === 1 && transform.scale > 1 && tr.lastCount === 1) { setTransform((p) => ({ ...p, x: tr.startX + (e.touches[0].clientX - tr.midX), y: tr.startY + (e.touches[0].clientY - tr.midY) })); } };
    const onTE = (e: TouchEvent) => { touchRef.current.lastCount = e.touches.length; setTransform((p) => p.scale < 1.05 ? IDENTITY : p); };
    el.addEventListener("touchstart", onTS, { passive: false }); el.addEventListener("touchmove", onTM, { passive: false }); el.addEventListener("touchend", onTE);
    return () => { el.removeEventListener("touchstart", onTS); el.removeEventListener("touchmove", onTM); el.removeEventListener("touchend", onTE); };
  }, [isMobile, transform.scale, transform.x, transform.y]);

  // ── Quadra pills with availability counts ──
  const quadraPills = (compact: boolean) => (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", paddingBottom: 2 }} className="qpills">
      <style>{`.qpills::-webkit-scrollbar{display:none}@keyframes slideUpSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <button type="button" onClick={() => handleQuadraChange(null)} style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: !selectedQuadra ? 600 : 400, background: !selectedQuadra ? "#4ADE80" : "rgba(255,255,255,0.06)", color: !selectedQuadra ? "#12110F" : "rgba(255,255,255,0.7)", border: !selectedQuadra ? "none" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", minHeight: 32 }}>Todas</button>
      {quadras.map((q) => {
        const avail = quadraCounts[q]?.[UnidadeStatus.DISPONIVEL] || 0;
        const active = selectedQuadra === q;
        const countColor = active ? "#12110F" : avail >= 10 ? "#4ADE80" : avail >= 3 ? "#F59E0B" : "#E24B4A";
        return (
          <button key={q} type="button" onClick={() => handleQuadraChange(q)} style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: active ? 600 : 400, background: active ? "#4ADE80" : "rgba(255,255,255,0.06)", color: active ? "#12110F" : "rgba(255,255,255,0.7)", border: active ? "none" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", whiteSpace: "nowrap", minHeight: 32 }}>
            {compact ? `Q${q}` : `${labelAgrupamento} ${q}`}
            <span style={{ fontSize: 10, marginLeft: 4, color: countColor, fontWeight: 700 }}>{avail}</span>
          </button>
        );
      })}
    </div>
  );

  // ── Legend inline ──
  const legendDots = (full: boolean) => (
    <div style={{ display: "flex", gap: full ? 14 : 10, alignItems: "center" }}>
      {Object.entries(CFG).map(([st, c]) => { const n = visibleCounts[st] || 0; if (n === 0) return null; return <div key={st} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: c.bg }} /><span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)" }}>{full ? `${c.label} (${n})` : n}</span></div>; })}
    </div>
  );

  const counterScale = 1 / transform.scale;
  const transformStyle: React.CSSProperties = { transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: "0 0", transition: isAnimating ? "transform 0.5s cubic-bezier(0.25,0.1,0.25,1)" : "none" };

  // ── Render pin ──
  function renderPin(pin: MapaPin) {
    const unit = units.find((u) => u.id === pin.unitId);
    if (!unit) return null;
    const c = CFG[unit.status] ?? CFG[UnidadeStatus.DISPONIVEL];
    const isSelected = sel?.id === unit.id;
    const isHighlighted = highlightId === unit.id;
    const z = isSelected ? 100 : isHighlighted ? 90 : 10;
    // Desktop fade: pins of non-selected quadras get low opacity
    const faded = !isMobile && selectedQuadra && unit.quadra !== selectedQuadra;
    const hlScale = isHighlighted ? counterScale * 1.3 : counterScale;
    return (
      <div key={pin.id} onClick={faded ? undefined : () => handlePinClick(unit, pin)} onTouchEnd={faded ? undefined : (e) => { e.preventDefault(); handlePinClick(unit, pin); }}
        style={{ position: "absolute", left: `${pin.xPct}%`, top: `${pin.yPct}%`, transform: `translate(-50%, -100%) scale(${hlScale})`, transformOrigin: "bottom center", zIndex: faded ? 1 : z, cursor: faded ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", transition: isAnimating ? "transform 0.3s, opacity 0.3s" : "opacity 0.3s", opacity: faded ? 0.15 : 1, pointerEvents: faded ? "none" : "auto", touchAction: "manipulation" }}>
        <div style={{ minWidth: pinCfg.size, height: pinCfg.h, borderRadius: pinCfg.size > 20 ? 5 : 3, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: pinCfg.showLabel ? "0 3px" : 0, fontSize: pinCfg.fontSize, fontWeight: 700, fontFamily: "var(--font-mono)", color: c.text, boxShadow: isHighlighted ? "0 0 0 4px rgba(255,255,255,0.6), 0 2px 10px rgba(0,0,0,0.4)" : isSelected ? `0 0 0 3px ${c.glow}, 0 2px 10px rgba(0,0,0,0.4)` : "0 1px 4px rgba(0,0,0,0.35)", border: (isSelected || isHighlighted) ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(0,0,0,0.15)", transition: "box-shadow 0.15s, transform 0.15s" }}
          onMouseEnter={(e) => { if (!isMobile && !faded) { const el = e.currentTarget as HTMLElement; el.style.transform = "scale(1.15)"; el.style.boxShadow = `0 0 0 2px ${c.glow}, 0 2px 8px rgba(0,0,0,0.3)`; } }}
          onMouseLeave={(e) => { if (!isMobile) { const el = e.currentTarget as HTMLElement; el.style.transform = "scale(1)"; el.style.boxShadow = ""; } }}>
          {pinCfg.showLabel ? `L${unit.lote}` : ""}
        </div>
        {pinCfg.showArrow && <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `5px solid ${c.bg}`, marginTop: -1 }} />}
      </div>
    );
  }

  // Container do mapa: width 100% + aspect-ratio carregado da imagem.
  // Com isso, o div INTERNO (onde os pins são posicionados em %) tem
  // EXATAMENTE a proporção da img renderizada. Pins em xPct/yPct alinham
  // com o desenho do mapa em qualquer viewport.
  const mapImageAndPins = (
    <div
      ref={innerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: mapRatio ?? "auto",
        background: mapRatio ? "rgba(0,0,0,0.3)" : undefined,
      }}
    >
      <img
        src={mapaUrl}
        alt="Mapa"
        onLoad={(e) => {
          const el = e.currentTarget;
          const ratio = imageAspectRatio(el.naturalWidth, el.naturalHeight);
          if (ratio != null) setMapRatio(ratio);
        }}
        style={{
          width: "100%",
          height: mapRatio ? "100%" : "auto",
          display: "block",
          objectFit: "fill",
          userSelect: "none",
        }}
        draggable={false}
      />
      {visiblePins.map(renderPin)}
    </div>
  );

  const mobileSplitView = selectedQuadra && isMobile;

  // Bottom sheet (mobile) e popup (desktop) foram removidos: quem mostra o
  // detalhe da unidade agora é o painel único do UnitsPage via onSelectUnit.

  return (
    <div>
      {isMobile ? (
        mobileSplitView ? (
          /* ── MOBILE SPLIT: map 45% + list 55% ──
             Altura disponivel = 100dvh - topbar (56) - bottom nav (56) - safe area.
             100dvh (em vez de 100vh) reage ao show/hide da toolbar do Safari. */
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 56px - 56px - env(safe-area-inset-bottom))" }}>
            <div ref={containerRef} style={{ height: "45%", position: "relative", overflow: "hidden", background: "#12110F", touchAction: "none", flexShrink: 0 }}>
              <div style={transformStyle}>{mapImageAndPins}</div>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(to bottom, rgba(18,17,15,0.85) 0%, rgba(18,17,15,0.4) 80%, transparent 100%)", zIndex: 20 }}>{quadraPills(true)}</div>
              {transform.scale > 1.1 && <button type="button" onClick={resetZoom} style={{ position: "absolute", bottom: 8, right: 8, zIndex: 20, background: "rgba(18,17,15,0.85)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Reset</button>}
            </div>
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", background: "var(--surface-base, #12110F)", borderTop: "1px solid var(--border-default, #2A2926)" }}>
              <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-base, #12110F)", zIndex: 5, borderBottom: "1px solid var(--border-default, #2A2926)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>{labelAgrupamento.toUpperCase()} {selectedQuadra} · {visibleUnits.length} lotes</span>
                <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                  {visibleCounts[UnidadeStatus.DISPONIVEL] ? <span style={{ color: "#4ADE80" }}>● {visibleCounts[UnidadeStatus.DISPONIVEL]}</span> : null}
                  {(visibleCounts[UnidadeStatus.RESERVADO] || 0) + (visibleCounts[UnidadeStatus.EM_NEGOCIACAO] || 0) > 0 ? <span style={{ color: "#F59E0B" }}>● {(visibleCounts[UnidadeStatus.RESERVADO] || 0) + (visibleCounts[UnidadeStatus.EM_NEGOCIACAO] || 0)}</span> : null}
                  {visibleCounts[UnidadeStatus.VENDIDO] ? <span style={{ color: "#E24B4A" }}>● {visibleCounts[UnidadeStatus.VENDIDO]}</span> : null}
                </div>
              </div>
              <div style={{ padding: 8 }}>
                {sortedVisibleUnits.map((unit) => { const c = CFG[unit.status] ?? CFG[UnidadeStatus.DISPONIVEL]; const pin = pins.find((p) => p.unitId === unit.id); return (
                  <div key={unit.id} onClick={() => { if (pin) handlePinClick(unit, pin); else { setSel(unit); setSelPin(null); } }} onTouchEnd={(e) => { e.preventDefault(); setHighlightId(null); if (pin) handlePinClick(unit, pin); else { setSel(unit); setSelPin(null); } }} onTouchStart={() => setHighlightId(unit.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", marginBottom: 4, borderRadius: 8, background: c.bg + "0A", cursor: "pointer", minHeight: 44, borderLeft: `3px solid ${c.bg}`, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 28, borderRadius: 4, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: c.text }}>L{unit.lote}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>{labelAgrupamento} {unit.quadra} / {labelUnidade} {unit.lote}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {unit.status === UnidadeStatus.DISPONIVEL && unit.valor > 0 ? <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#4ADE80" }}>{fmtK(unit.valor)}</span> : unit.status === UnidadeStatus.DISPONIVEL ? <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Consultar</span> : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: c.bg + "15", color: c.bg, fontWeight: 500 }}>{c.label}</span>}
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          </div>
        ) : (
          /* ── MOBILE FULLSCREEN ──
             100dvh - topbar (56) - bottom nav (56) - safe area.
             Container é flex column para que o mapa (com aspect-ratio interno)
             ocupe o topo e o fundo escuro preencha o resto. */
          <div ref={containerRef} style={{ position: "relative", width: "100%", height: "calc(100dvh - 56px - 56px - env(safe-area-inset-bottom))", overflow: "hidden", background: "#12110F", touchAction: "none" }}>
            <div style={transformStyle}>{mapImageAndPins}</div>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(to bottom, rgba(18,17,15,0.85) 0%, rgba(18,17,15,0.4) 80%, transparent 100%)", zIndex: 20 }}>{quadraPills(true)}</div>
            <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 20, background: "rgba(18,17,15,0.8)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "6px 10px" }}>{legendDots(false)}</div>
            {transform.scale > 1.1 && <button type="button" onClick={resetZoom} style={{ position: "absolute", bottom: 12, right: 12, zIndex: 20, background: "rgba(18,17,15,0.85)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "8px 14px", color: "#fff", fontSize: 12, cursor: "pointer", backdropFilter: "blur(8px)", minHeight: 36 }}>Reset</button>}
          </div>
        )
      ) : (
        /* ── DESKTOP: compact toolbar + map ── */
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--border-default, #2A2926)", background: "var(--surface-raised, #1C1B18)", borderRadius: "12px 12px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {logoUrl ? <img src={logoUrl} alt={developmentName} style={{ height: 48, width: "auto", objectFit: "contain" }} /> : <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>{developmentName}</span>}
              <div style={{ paddingLeft: 16, borderLeft: "1px solid var(--border-default, #2A2926)", fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{units.length} unidades</div>
              <div style={{ paddingLeft: 12, borderLeft: "1px solid var(--border-default, #2A2926)" }}>{legendDots(false)}</div>
            </div>
            {onViewChange && (
              <div style={{ display: "flex", gap: 2, background: "var(--surface-base, #12110F)", borderRadius: 8, padding: 3 }}>
                {([{ k: "mapa" as const, l: "Mapa" }, ...(hasPlanta ? [{ k: "interativo" as const, l: "Planta" }] : []), { k: "tabela" as const, l: "Tabela" }]).map((v) => (
                  <button key={v.k} type="button" onClick={() => onViewChange(v.k)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: activeView === v.k ? "#4ADE80" : "transparent", color: activeView === v.k ? "#12110F" : "var(--text-muted)", fontSize: 12, fontWeight: activeView === v.k ? 600 : 400, cursor: "pointer", transition: "all 0.2s" }}>{v.l}</button>
                ))}
              </div>
            )}
          </div>
          {/* Quadra filters */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-default, #2A2926)", background: "var(--surface-raised, #1C1B18)" }}>{quadraPills(false)}</div>
          {/* Map */}
          <div ref={containerRef} style={{ position: "relative", width: "100%", borderRadius: "0 0 12px 12px", overflow: "hidden", background: "#12110F" }}>
            <div style={transformStyle}>{mapImageAndPins}</div>
            <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 20, background: "rgba(18,17,15,0.8)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "8px 14px" }}>{legendDots(true)}</div>
            {transform.scale > 1.1 && <button type="button" onClick={resetZoom} style={{ position: "absolute", bottom: 10, right: 10, zIndex: 20, background: "rgba(18,17,15,0.85)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Reset zoom</button>}
          </div>
        </div>
      )}

      {visiblePins.length === 0 && pins.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--color-fog)", fontSize: 13 }}>Nenhuma unidade posicionada no mapa. Configure em Configurações.</div>}
    </div>
  );
}
