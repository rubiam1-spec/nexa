import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { type TextConfig } from "./BannerTemplateEditorModal";

// ── Types ──

export interface ComunicadoTipo {
  key: string;
  label: string;
  description: string;
  color: string;
  defaultTitle: string;
  defaultMessage: string;
}

interface BannerTemplate {
  id: string;
  name: string;
  background_url: string;
  text_config: TextConfig;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tipo: ComunicadoTipo;
  accountLogo: string | null;
  devLogo: string | null;
  accountName: string;
  footerText: string;
  customTemplates?: BannerTemplate[];
  onCreated?: (entry: { title: string; tipo: ComunicadoTipo }) => void;
}

// ── Helpers ──

function getFontFamily(ff: string): string {
  if (ff === "serif") return "'Instrument Serif', Georgia, serif";
  if (ff === "mono") return "'JetBrains Mono', monospace";
  return "'Outfit', sans-serif";
}

function contrastColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#1C1B18" : "#fff";
  } catch {
    return "#1C1B18";
  }
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Component ──

export default function ComunicadoBannerModal({
  isOpen, onClose, tipo, accountLogo, devLogo, accountName,
  footerText, customTemplates, onCreated,
}: Props) {
  const hasCustom = (customTemplates?.length ?? 0) > 0;
  const [title, setTitle] = useState(tipo.defaultTitle);
  const [message, setMessage] = useState(tipo.defaultMessage);
  const [logos, setLogos] = useState<{ acc: string | null; dev: string | null }>({ acc: null, dev: null });
  const [downloading, setDownloading] = useState(false);
  const [source, setSource] = useState<"nexa" | "custom">(hasCustom ? "custom" : "nexa");
  const [customIdx, setCustomIdx] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);
  const activeCustomTemplate = source === "custom" ? (customTemplates?.[customIdx] ?? null) : null;

  // Reset inputs when opened with a different tipo
  useEffect(() => {
    if (!isOpen) return;
    setTitle(tipo.defaultTitle);
    setMessage(tipo.defaultMessage);
    setCustomIdx(0);
  }, [isOpen, tipo.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load base64 logos (needed for html2canvas cross-origin)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function fetchLogos() {
      const [acc, dev] = await Promise.all([
        accountLogo ? urlToBase64(accountLogo) : Promise.resolve(null),
        devLogo ? urlToBase64(devLogo) : Promise.resolve(null),
      ]);
      if (!cancelled) setLogos({ acc, dev });
    }
    fetchLogos();
    return () => { cancelled = true; };
  }, [isOpen, accountLogo, devLogo]);

  const capture = async () => {
    if (!bannerRef.current) return null;
    return html2canvas(bannerRef.current, { scale: 2.25, useCORS: true, backgroundColor: null, logging: false });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      const link = document.createElement("a");
      const slug = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
      link.download = `comunicado-${slug}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      onCreated?.({ title, tipo });
    } catch (e) { console.error(e); }
    finally { setDownloading(false); }
  };

  const handleCopy = async () => {
    setDownloading(true);
    try {
      const canvas = await capture();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        onCreated?.({ title, tipo });
      });
    } catch (e) { console.error(e); }
    finally { setDownloading(false); }
  };

  if (!isOpen) return null;

  const MONO = "'JetBrains Mono', monospace";
  const SERIF = "'Instrument Serif', Georgia, serif";
  const SANS = "'Outfit', sans-serif";

  const LogoSection = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 22 }}>
      {logos.acc ? (
        <img src={logos.acc} alt={accountName} style={{ maxHeight: 26, maxWidth: 80, objectFit: "contain" }} />
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: "#9C9686", letterSpacing: "0.05em" }}>
          {accountName.toUpperCase()}
        </span>
      )}
      {logos.acc && logos.dev && (
        <>
          <div style={{ width: 1, height: 16, background: "#D4CFC4" }} />
          <img src={logos.dev} alt="" style={{ maxHeight: 22, maxWidth: 70, objectFit: "contain" }} />
        </>
      )}
    </div>
  );

  // NEXA template — real-time preview driven by title/message state
  const NexaTemplate = () => (
    <div style={{
      width: 480, height: 480, background: "#FDFBF7", flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "36px 44px", boxSizing: "border-box", position: "relative", overflow: "hidden",
    }}>
      {/* Accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: tipo.color }} />
      {/* Decoration circles */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: `${tipo.color}08`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: `${tipo.color}05`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <LogoSection />
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: tipo.color, letterSpacing: "4px", textTransform: "uppercase", marginBottom: 12 }}>
          {tipo.label.toUpperCase()}
        </div>
        <div style={{ width: 40, height: 2, background: tipo.color, marginBottom: 18 }} />
        <div style={{
          fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: "#2A2822",
          textAlign: "center", lineHeight: 1.2, marginBottom: 14, maxWidth: 360,
        }}>
          {title || tipo.defaultTitle}
        </div>
        <div style={{
          fontFamily: SANS, fontSize: 12, color: "#706B5F",
          textAlign: "center", lineHeight: 1.7, maxWidth: 340,
        }}>
          {message || tipo.defaultMessage}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 18, fontFamily: MONO, fontSize: 8, color: "#9C9686", letterSpacing: "0.15em" }}>
        {footerText}
      </div>
    </div>
  );

  // Custom template preview — title overlaid using text_config
  const CustomPreview = ({ tpl }: { tpl: BannerTemplate }) => {
    const cfg = tpl.text_config;
    return (
      <div style={{
        width: 480, height: 480, flexShrink: 0,
        backgroundImage: `url(${tpl.background_url})`,
        backgroundSize: "cover", backgroundPosition: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: `${cfg.position_y}%`, transform: "translateY(-50%)",
          textAlign: cfg.align, padding: "0 32px", pointerEvents: "none",
        }}>
          <span style={{
            fontFamily: getFontFamily(cfg.font_family),
            fontSize: `${cfg.font_size / 2.25}px`,
            fontWeight: cfg.font_weight,
            fontStyle: cfg.font_style,
            color: cfg.color,
            textTransform: cfg.text_transform,
            lineHeight: 1.15, display: "block",
          }}>
            {title || tipo.defaultTitle}
          </span>
        </div>
      </div>
    );
  };

  const INP: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(61,58,48,0.12)", border: "1px solid rgba(61,58,48,0.25)",
    borderRadius: 8, padding: "9px 13px",
    color: "#E8E5DE", fontSize: 13, fontFamily: SANS, outline: "none",
  };

  const btnTextColor = contrastColor(tipo.color);

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#1C1B18", border: "1px solid rgba(61,58,48,0.2)",
        borderRadius: 16, maxWidth: 560, width: "100%",
        maxHeight: "92vh", overflowY: "auto",
        padding: 24, display: "flex", flexDirection: "column", gap: 18,
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: tipo.color, flexShrink: 0 }} />
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: "#E8E5DE" }}>
              {tipo.label}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#706B5F", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Inputs — real-time editing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              Título
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tipo.defaultTitle}
              maxLength={80}
              style={INP}
            />
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              Mensagem
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={tipo.defaultMessage}
              rows={3}
              maxLength={220}
              style={{ ...INP, lineHeight: 1.6, resize: "vertical" }}
            />
          </div>
        </div>

        {/* Source toggle (only when custom templates exist) */}
        {hasCustom && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {(["custom", "nexa"] as const).map((s) => (
              <button key={s} onClick={() => setSource(s)} style={{
                flex: 1, padding: "7px 12px", borderRadius: 8,
                border: source === s ? `1.5px solid ${tipo.color}` : "1.5px solid rgba(61,58,48,0.3)",
                background: source === s ? `${tipo.color}15` : "transparent",
                color: source === s ? tipo.color : "#706B5F",
                fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 150ms ease",
              }}>
                {s === "custom" ? "Templates da empresa" : "Template NEXA"}
              </button>
            ))}
          </div>
        )}

        {/* Custom template thumbnail grid */}
        {source === "custom" && customTemplates && customTemplates.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            {customTemplates.map((tpl, idx) => (
              <button key={tpl.id} onClick={() => setCustomIdx(idx)} title={tpl.name} style={{
                width: 64, height: 64, borderRadius: 8, overflow: "hidden", padding: 0, cursor: "pointer",
                border: customIdx === idx ? `2.5px solid ${tipo.color}` : "2px solid rgba(61,58,48,0.3)",
                backgroundImage: `url(${tpl.background_url})`,
                backgroundSize: "cover", backgroundPosition: "center",
                transition: "border-color 150ms", flexShrink: 0,
              }} />
            ))}
          </div>
        )}

        {/* Banner preview */}
        <div style={{ display: "flex", justifyContent: "center", overflow: "hidden", borderRadius: 8, flexShrink: 0 }}>
          <div ref={bannerRef} style={{ flexShrink: 0 }}>
            {source === "nexa" && <NexaTemplate />}
            {source === "custom" && activeCustomTemplate && <CustomPreview tpl={activeCustomTemplate} />}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={handleDownload} disabled={downloading} style={{
            flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
            background: downloading ? `${tipo.color}80` : tipo.color,
            color: btnTextColor, fontFamily: SANS, fontSize: 13, fontWeight: 700,
            cursor: downloading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background 150ms",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? "Gerando..." : "Baixar PNG"}
          </button>
          <button onClick={handleCopy} disabled={downloading} style={{
            flex: 1, padding: "10px 16px", borderRadius: 8,
            border: "1.5px solid rgba(61,58,48,0.4)", background: "transparent",
            color: "#9C9686", fontFamily: SANS, fontSize: 13, fontWeight: 600,
            cursor: downloading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copiar
          </button>
        </div>

      </div>
    </div>,
    document.body,
  );
}
