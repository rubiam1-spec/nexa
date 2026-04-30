import { useRef, useState } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";
import { useIsMobile } from "../hooks/useIsMobile";

interface UploadImagemProps {
  label: string;
  value: string | null;
  onChange: (url: string) => void;
  bucket?: string;
  accept?: string;
  maxSizeMB?: number;
  preview?: "avatar" | "banner";
  disabled?: boolean;
}

export default function UploadImagem({
  label, value, onChange, bucket = "logos",
  accept = "image/png,image/jpeg,image/svg+xml",
  maxSizeMB = 2, preview = "avatar", disabled = false,
}: UploadImagemProps) {
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  async function handleFile(file: File) {
    setErro(null);
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErro(`Arquivo muito grande. Maximo: ${maxSizeMB}MB`);
      return;
    }
    if (!supabase) {
      setErro("Supabase nao configurado.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onChange(data.publicUrl);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  // Desktop: preview pequeno ao lado + texto.
  // Mobile: preview 80x80 centralizado em cima, texto abaixo, CTA full-width.
  const w = isMobile ? 80 : preview === "avatar" ? 64 : 120;
  const h = isMobile ? 80 : preview === "avatar" ? 64 : 48;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 8 }}>{label}</div>
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !disabled) void handleFile(f); }}
        style={{
          border: "1px dashed var(--color-stone)", borderRadius: 10, padding: isMobile ? 14 : 16,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: isMobile ? 10 : 16,
          background: "var(--color-ink)", transition: "border-color 0.15s", opacity: disabled ? 0.5 : 1,
        }}
      >
        {value ? (
          <img src={value} alt={label} style={{ width: w, height: h, objectFit: "contain", borderRadius: 6, background: "#fff", padding: 4, flexShrink: 0 }} />
        ) : (
          <div style={{ width: w, height: h, borderRadius: 6, background: "var(--color-stone)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--color-fog)", flexShrink: 0 }}>
            +
          </div>
        )}
        <div style={{ flex: 1, width: isMobile ? "100%" : "auto", textAlign: isMobile ? "center" : "left", minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-bone)",
              fontWeight: 600,
              marginBottom: 2,
              minHeight: isMobile ? 44 : "auto",
              display: isMobile ? "flex" : "block",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? "0 8px" : 0,
            }}
          >
            {uploading ? "Enviando..." : value ? "Clique para alterar" : "Clique ou arraste aqui"}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-fog)" }}>
            PNG, JPG ou SVG · max {maxSizeMB}MB
          </div>
          {value ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              style={{
                fontSize: 11,
                color: "var(--color-red)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: isMobile ? "6px 8px" : 0,
                marginTop: 4,
              }}
            >
              Remover
            </button>
          ) : null}
        </div>
      </div>
      {erro ? <p style={{ fontSize: 11, color: "var(--color-red)", marginTop: 4 }}>{erro}</p> : null}
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
    </div>
  );
}
