import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { type TextConfig } from "./BannerTemplateEditorModal";

// ── Types ──

interface BannerTemplate {
  id: string;
  name: string;
  background_url: string;
  text_config: TextConfig;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  brokerage: string | null;
  accountLogo: string | null;
  devLogo: string | null;
  devName: string;
  accountName: string;
  corPrimaria: string;
  corSecundaria: string;
  city: string;
  state: string;
  footerText: string;
  customTemplates?: BannerTemplate[];
}

function getDisplayName(full: string): { first: string; display: string } {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? full;
  if (parts.length <= 2) return { first, display: full };
  const last = parts[parts.length - 1];
  return { first, display: `${first} ${last}` };
}

function getFontFamily(ff: string): string {
  if (ff === "serif") return "'Instrument Serif', Georgia, serif";
  if (ff === "mono") return "'JetBrains Mono', monospace";
  return "'Outfit', sans-serif";
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

export default function BirthdayBannerModal({
  isOpen,
  onClose,
  name,
  brokerage: _brokerage,
  accountLogo,
  devLogo,
  devName: _devName,
  accountName,
  corPrimaria,
  corSecundaria: _corSecundaria,
  city: _city,
  state: _state,
  footerText,
  customTemplates,
}: Props) {
  const hasCustom = (customTemplates?.length ?? 0) > 0;
  const [template, setTemplate] = useState<1 | 2 | 3>(1);
  const [logos, setLogos] = useState<{ acc: string | null; dev: string | null }>({ acc: null, dev: null });
  const [downloading, setDownloading] = useState(false);
  const [source, setSource] = useState<"nexa" | "custom">(hasCustom ? "custom" : "nexa");
  const [customIdx, setCustomIdx] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);
  const activeCustomTemplate = source === "custom" ? (customTemplates?.[customIdx] ?? null) : null;

  const { first } = getDisplayName(name);

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

  const handleDownload = async () => {
    if (!bannerRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(bannerRef.current, {
        scale: 2.25,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `parabens-${first.toLowerCase().replace(/\s/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!bannerRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(bannerRef.current, {
        scale: 2.25,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  const MONO = "'JetBrains Mono', monospace";
  const SERIF = "'Instrument Serif', Georgia, serif";
  const SANS = "'Outfit', sans-serif";

  const LogoSection = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 18 }}>
      {logos.acc ? (
        <img src={logos.acc} alt={accountName} style={{ maxHeight: 28, maxWidth: 80, objectFit: "contain" }} />
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#9C9686", letterSpacing: "0.05em" }}>
          {accountName.toUpperCase()}
        </span>
      )}
      <div style={{ width: 1, height: 20, background: "#D4CFC4" }} />
      {logos.dev ? (
        <img src={logos.dev} alt={_devName} style={{ maxHeight: 28, maxWidth: 80, objectFit: "contain" }} />
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#9C9686", letterSpacing: "0.05em" }}>
          {_devName.toUpperCase()}
        </span>
      )}
    </div>
  );

  const Template1 = () => (
    <div
      style={{
        width: 480,
        height: 480,
        background: "#FDFBF7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 48px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* decoration circles */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `${corPrimaria}0D`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: `${corPrimaria}08`, pointerEvents: "none" }} />

      <LogoSection />

      <div style={{ fontFamily: MONO, fontSize: 10, color: "#9C9686", letterSpacing: "4px", textTransform: "uppercase", marginBottom: 10 }}>
        Feliz Aniversário
      </div>

      <div style={{ width: 40, height: 2, background: corPrimaria, marginBottom: 14 }} />

      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: "#2A2822", textAlign: "center", lineHeight: 1.1, marginBottom: 16 }}>
        {first}
      </div>

      <div style={{ fontFamily: SANS, fontSize: 12, color: "#9C9686", textAlign: "center", lineHeight: 1.8, maxWidth: 320 }}>
        Que este novo ciclo seja repleto de conquistas e realizações. Estamos juntos nessa jornada!
      </div>

      <div style={{ position: "absolute", bottom: 20, fontFamily: MONO, fontSize: 8, color: "#9C9686", letterSpacing: "0.1em" }}>
        {footerText}
      </div>
    </div>
  );

  const Template2 = () => (
    <div
      style={{
        width: 480,
        height: 480,
        background: "linear-gradient(160deg, #F7F9F3, #EAF0E2)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 48px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #5B8C51, #7AA86E)" }} />

      <LogoSection />

      <div style={{ fontFamily: SANS, fontSize: 10, color: "#5B8C51", letterSpacing: "5px", textTransform: "uppercase", marginBottom: 14 }}>
        Parabéns
      </div>

      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 48, color: "#2F3B2D", textAlign: "center", lineHeight: 1.05, marginBottom: 20 }}>
        {first}
      </div>

      <div style={{ width: 32, height: 2, background: "#5B8C51", opacity: 0.4, marginBottom: 20 }} />

      <div style={{ fontFamily: SANS, fontSize: 12, color: "#5B8C51", opacity: 0.7, textAlign: "center", lineHeight: 1.8, maxWidth: 320 }}>
        Que a vida continue florescendo com saúde, prosperidade e muitas conquistas!
      </div>

      <div style={{ position: "absolute", bottom: 20, fontFamily: MONO, fontSize: 8, color: "#5B8C51", opacity: 0.5, letterSpacing: "0.1em" }}>
        {footerText}
      </div>
    </div>
  );

  const Template3 = () => (
    <div
      style={{
        width: 480,
        height: 480,
        background: "linear-gradient(160deg, #FEF9F4, #F6E4CF)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 48px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: corPrimaria }} />

      <LogoSection />

      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: corPrimaria, letterSpacing: "0.05em", marginBottom: 10 }}>
        Feliz Aniversário
      </div>

      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 48, color: "#3D2B1A", textAlign: "center", lineHeight: 1.05, marginBottom: 20 }}>
        {first}
      </div>

      <div style={{ width: 32, height: 1, background: corPrimaria, opacity: 0.3, marginBottom: 20 }} />

      <div style={{ fontFamily: SANS, fontSize: 12, color: "#706B5F", textAlign: "center", lineHeight: 1.8, maxWidth: 320 }}>
        Desejamos um dia tão especial quanto você. Que venham muitas realizações nesse novo ano!
      </div>

      <div style={{ position: "absolute", bottom: 20, fontFamily: MONO, fontSize: 8, color: "#9C9686", letterSpacing: "0.1em" }}>
        {footerText}
      </div>
    </div>
  );

  const CustomPreview = ({ tpl, firstName }: { tpl: BannerTemplate; firstName: string }) => {
    const cfg = tpl.text_config;
    const displayFontSize = cfg.font_size / 2.25;
    return (
      <div style={{
        width: 480, height: 480,
        backgroundImage: `url(${tpl.background_url})`,
        backgroundSize: "cover", backgroundPosition: "center",
        position: "relative", overflow: "hidden", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: `${cfg.position_y}%`, transform: "translateY(-50%)",
          textAlign: cfg.align,
          padding: "0 32px",
          pointerEvents: "none",
        }}>
          <span style={{
            fontFamily: getFontFamily(cfg.font_family),
            fontSize: `${displayFontSize}px`,
            fontWeight: cfg.font_weight,
            fontStyle: cfg.font_style,
            color: cfg.color,
            textTransform: cfg.text_transform,
            lineHeight: 1.1, display: "block",
          }}>
            {firstName}
          </span>
        </div>
      </div>
    );
  };

  const templates: { id: 1 | 2 | 3; label: string }[] = [
    { id: 1, label: "Sofisticado" },
    { id: 2, label: "Natureza" },
    { id: 3, label: "Caloroso" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#1C1B18",
          border: "1px solid rgba(61,58,48,0.2)",
          borderRadius: 16,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#E8E5DE" }}>
            Gerar Banner de Aniversário{" "}
            <span style={{ color: corPrimaria }}>{first}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#706B5F", padding: 4, display: "flex", alignItems: "center" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Source toggle — only shown when custom templates exist */}
        {hasCustom && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSource("custom")} style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: source === "custom" ? `1.5px solid ${corPrimaria}` : "1.5px solid rgba(61,58,48,0.3)",
              background: source === "custom" ? `${corPrimaria}15` : "transparent",
              color: source === "custom" ? corPrimaria : "#706B5F",
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 150ms ease",
            }}>
              Templates da empresa
            </button>
            <button onClick={() => setSource("nexa")} style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: source === "nexa" ? `1.5px solid ${corPrimaria}` : "1.5px solid rgba(61,58,48,0.3)",
              background: source === "nexa" ? `${corPrimaria}15` : "transparent",
              color: source === "nexa" ? corPrimaria : "#706B5F",
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 150ms ease",
            }}>
              Templates NEXA
            </button>
          </div>
        )}

        {/* NEXA template selector */}
        {source === "nexa" && (
          <div style={{ display: "flex", gap: 8 }}>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: template === t.id ? `1.5px solid ${corPrimaria}` : "1.5px solid rgba(61,58,48,0.3)",
                  background: template === t.id ? `${corPrimaria}15` : "transparent",
                  color: template === t.id ? corPrimaria : "#706B5F",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Custom template thumbnail selector */}
        {source === "custom" && customTemplates && customTemplates.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {customTemplates.map((tpl, idx) => (
              <button
                key={tpl.id}
                onClick={() => setCustomIdx(idx)}
                title={tpl.name}
                style={{
                  width: 64, height: 64, borderRadius: 8, overflow: "hidden",
                  padding: 0, cursor: "pointer",
                  border: customIdx === idx ? `2.5px solid ${corPrimaria}` : "2px solid rgba(61,58,48,0.3)",
                  backgroundImage: `url(${tpl.background_url})`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  transition: "border-color 150ms",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* Banner preview */}
        <div style={{ display: "flex", justifyContent: "center", overflow: "hidden", borderRadius: 8 }}>
          <div ref={bannerRef} style={{ flexShrink: 0 }}>
            {source === "nexa" && (
              <>
                {template === 1 && <Template1 />}
                {template === 2 && <Template2 />}
                {template === 3 && <Template3 />}
              </>
            )}
            {source === "custom" && activeCustomTemplate && (
              <CustomPreview tpl={activeCustomTemplate} firstName={first} />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: downloading ? `${corPrimaria}80` : corPrimaria,
              color: "#1C1B18",
              fontFamily: "'Outfit', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: downloading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? "Gerando..." : "Baixar PNG"}
          </button>
          <button
            onClick={handleCopy}
            disabled={downloading}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: `1.5px solid rgba(61,58,48,0.4)`,
              background: "transparent",
              color: "#9C9686",
              fontFamily: "'Outfit', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: downloading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copiar
          </button>
        </div>
      </div>
    </div>
  );
}
