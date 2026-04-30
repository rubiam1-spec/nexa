import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";

export interface TextConfig {
  position_y: number;
  align: "left" | "center" | "right";
  font_family: "serif" | "sans" | "mono";
  font_size: number;
  font_weight: number;
  font_style: "normal" | "italic";
  color: string;
  text_transform: "none" | "uppercase";
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  developmentId: string | null;
  userId: string | null;
  editingId?: string | null;
  editingData?: {
    name: string;
    type: string;
    background_url: string;
    text_config: TextConfig;
  } | null;
  corPrimaria: string;
  onSaved: () => void;
}

const TEMPLATE_TYPES = [
  { value: "birthday", label: "Aniversário" },
  { value: "recognition", label: "Reconhecimento" },
  { value: "welcome", label: "Boas-vindas" },
  { value: "announcement", label: "Comunicado" },
  { value: "custom", label: "Personalizado" },
];

export const DEFAULT_TEXT_CONFIG: TextConfig = {
  position_y: 55,
  align: "center",
  font_family: "serif",
  font_size: 48,
  font_weight: 400,
  font_style: "italic",
  color: "#2A2822",
  text_transform: "none",
};

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Outfit', sans-serif";
const SERIF = "'Instrument Serif', Georgia, serif";

const INP: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(0,0,0,0.25)", border: "1px solid rgba(61,58,48,0.3)",
  borderRadius: 8, padding: "8px 12px",
  color: "#E8E5DE", fontSize: 13, fontFamily: SANS, outline: "none",
};

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleGroup({ options, value, onChange, corPrimaria }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  corPrimaria: string;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
          flex: 1, padding: "6px 0", borderRadius: 6,
          border: value === o.value ? `1.5px solid ${corPrimaria}` : "1.5px solid rgba(61,58,48,0.25)",
          background: value === o.value ? `${corPrimaria}18` : "transparent",
          color: value === o.value ? corPrimaria : "#706B5F",
          fontFamily: SANS, fontSize: 11, fontWeight: 600, cursor: "pointer",
          transition: "all 100ms",
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function BannerTemplateEditorModal({
  isOpen, onClose, accountId, developmentId, userId,
  editingId, editingData, corPrimaria, onSaved,
}: Props) {
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("birthday");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [config, setConfig] = useState<TextConfig>(DEFAULT_TEXT_CONFIG);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(360);

  useEffect(() => {
    if (!isOpen) return;
    if (editingData) {
      setTemplateName(editingData.name);
      setTemplateType(editingData.type);
      setBackgroundUrl(editingData.background_url);
      setConfig(editingData.text_config ?? DEFAULT_TEXT_CONFIG);
    } else {
      setTemplateName("");
      setTemplateType("birthday");
      setBackgroundUrl(null);
      setConfig(DEFAULT_TEXT_CONFIG);
    }
    setErrorMsg(null);
  }, [isOpen, editingData]);

  useEffect(() => {
    if (!isOpen || !previewRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPreviewWidth(w);
    });
    obs.observe(previewRef.current);
    return () => obs.disconnect();
  }, [isOpen]);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { setErrorMsg("Apenas imagens"); return; }
    if (file.size > 5 * 1024 * 1024) { setErrorMsg("Máximo 5MB"); return; }
    if (!supabase) return;
    setUploading(true); setErrorMsg(null);
    const path = `templates/${accountId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { setErrorMsg("Erro no upload: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    setBackgroundUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!backgroundUrl) { setErrorMsg("Suba uma arte primeiro"); return; }
    if (!templateName.trim()) { setErrorMsg("Informe o nome do template"); return; }
    if (!supabase) return;
    setSaving(true); setErrorMsg(null);
    const payload = {
      account_id: accountId,
      development_id: developmentId ?? null,
      type: templateType,
      name: templateName.trim(),
      background_url: backgroundUrl,
      text_config: config,
      is_active: true,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await supabase.from("banner_templates").update(payload).eq("id", editingId)
      : await supabase.from("banner_templates").insert(payload);
    setSaving(false);
    if (error) { setErrorMsg("Erro ao salvar: " + error.message); return; }
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  const fontFamilyValue =
    config.font_family === "serif" ? SERIF
    : config.font_family === "mono" ? MONO
    : SANS;

  const UploadArea = () => (
    <label style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10,
      cursor: uploading ? "default" : "pointer",
      background: "rgba(28,27,24,0.85)",
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3D3A30" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
      <span style={{ fontFamily: SANS, fontSize: 12, color: "#5C5647" }}>
        {uploading ? "Enviando..." : "Clique para subir a arte"}
      </span>
      <input type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        disabled={uploading}
      />
    </label>
  );

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
      zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#1C1B18", border: "1px solid rgba(61,58,48,0.2)",
        borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "92vh",
        overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(61,58,48,0.12)", flexShrink: 0 }}>
          <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: "#E8E5DE" }}>
            {editingId ? "Editar Template" : "Novo Template de Arte"}
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#706B5F", display: "flex", padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left: Preview */}
          <div style={{ flex: "0 0 50%", padding: 24, borderRight: "1px solid rgba(61,58,48,0.1)", display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
              Preview em tempo real
            </div>
            <div ref={previewRef} style={{
              width: "100%", aspectRatio: "1/1", borderRadius: 10, overflow: "hidden",
              position: "relative", flexShrink: 0,
              background: backgroundUrl ? "transparent" : "#252421",
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
              backgroundSize: "cover", backgroundPosition: "center",
              border: "1px solid rgba(61,58,48,0.15)",
            }}>
              {!backgroundUrl && <UploadArea />}
              {backgroundUrl && (
                <>
                  <div style={{
                    position: "absolute", left: 0, right: 0,
                    top: `${config.position_y}%`, transform: "translateY(-50%)",
                    textAlign: config.align, padding: "0 20px", pointerEvents: "none",
                  }}>
                    <span style={{
                      fontFamily: fontFamilyValue,
                      fontSize: `${config.font_size * (previewWidth / 1080)}px`,
                      fontWeight: config.font_weight,
                      fontStyle: config.font_style,
                      color: config.color,
                      textTransform: config.text_transform,
                      lineHeight: 1.1, display: "block",
                    }}>
                      Exemplo
                    </span>
                  </div>
                  <label style={{
                    position: "absolute", top: 8, right: 8, cursor: "pointer",
                    background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 6,
                    padding: "4px 10px", color: "#E8E5DE", fontSize: 10, fontFamily: SANS, display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {uploading ? "Enviando..." : "Trocar"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                      disabled={uploading}
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div style={{ flex: "0 0 50%", padding: 24, overflowY: "auto" }}>
            <LabelRow label="Nome do template">
              <input style={INP} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: Aniversário Padrão" />
            </LabelRow>

            <LabelRow label="Tipo">
              <select style={INP} value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </LabelRow>

            <LabelRow label={`Posição vertical — ${config.position_y}%`}>
              <input type="range" min={20} max={80} value={config.position_y}
                onChange={(e) => setConfig((c) => ({ ...c, position_y: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: corPrimaria, cursor: "pointer" }}
              />
            </LabelRow>

            <LabelRow label="Alinhamento">
              <ToggleGroup corPrimaria={corPrimaria}
                options={[{ value: "left", label: "Esq" }, { value: "center", label: "Centro" }, { value: "right", label: "Dir" }]}
                value={config.align} onChange={(v) => setConfig((c) => ({ ...c, align: v as typeof c.align }))}
              />
            </LabelRow>

            <LabelRow label="Fonte">
              <ToggleGroup corPrimaria={corPrimaria}
                options={[{ value: "serif", label: "Serif" }, { value: "sans", label: "Sans" }, { value: "mono", label: "Mono" }]}
                value={config.font_family} onChange={(v) => setConfig((c) => ({ ...c, font_family: v as typeof c.font_family }))}
              />
            </LabelRow>

            <LabelRow label={`Tamanho — ${config.font_size}px`}>
              <input type="range" min={24} max={80} value={config.font_size}
                onChange={(e) => setConfig((c) => ({ ...c, font_size: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: corPrimaria, cursor: "pointer" }}
              />
            </LabelRow>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Peso</div>
                <ToggleGroup corPrimaria={corPrimaria}
                  options={[{ value: "400", label: "Normal" }, { value: "700", label: "Bold" }]}
                  value={String(config.font_weight)} onChange={(v) => setConfig((c) => ({ ...c, font_weight: Number(v) }))}
                />
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Estilo</div>
                <ToggleGroup corPrimaria={corPrimaria}
                  options={[{ value: "normal", label: "Normal" }, { value: "italic", label: "Itálico" }]}
                  value={config.font_style} onChange={(v) => setConfig((c) => ({ ...c, font_style: v as typeof c.font_style }))}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Cor do texto</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={config.color}
                    onChange={(e) => setConfig((c) => ({ ...c, color: e.target.value }))}
                    style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid rgba(61,58,48,0.3)", cursor: "pointer", background: "transparent", padding: 2 }}
                  />
                  <input style={{ ...INP, flex: 1 }} value={config.color}
                    onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setConfig((c) => ({ ...c, color: e.target.value })); }}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Caixa</div>
                <ToggleGroup corPrimaria={corPrimaria}
                  options={[{ value: "none", label: "Normal" }, { value: "uppercase", label: "CAPS" }]}
                  value={config.text_transform} onChange={(v) => setConfig((c) => ({ ...c, text_transform: v as typeof c.text_transform }))}
                />
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, color: "#EF4444", fontFamily: SANS, marginBottom: 14 }}>
                {errorMsg}
              </div>
            )}

            <button type="button" onClick={handleSave} disabled={saving || uploading}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
                background: (saving || uploading) ? `${corPrimaria}80` : corPrimaria,
                color: "#1C1B18", fontFamily: SANS, fontSize: 13, fontWeight: 700,
                cursor: (saving || uploading) ? "not-allowed" : "pointer",
                transition: "opacity 150ms",
              }}
            >
              {saving ? "Salvando..." : editingId ? "Atualizar template" : "Salvar template"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
