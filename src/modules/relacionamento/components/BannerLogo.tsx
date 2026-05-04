import { useEffect, useState } from "react";
import { generateSlug } from "../../../shared/utils/generateSlug";

const MONO = "'JetBrains Mono', monospace";

type Props = {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  fallbackText: string;
  fallbackColor?: string;
  fallbackFontSize?: number;
};

export function BannerLogo({
  src,
  alt,
  width,
  height,
  fallbackText,
  fallbackColor = "#9C9686",
  fallbackFontSize = 9,
}: Props) {
  if (!src) {
    return (
      <span
        style={{
          fontFamily: MONO,
          fontSize: fallbackFontSize,
          fontWeight: 700,
          color: fallbackColor,
          letterSpacing: "0.05em",
        }}
      >
        {fallbackText.toUpperCase()}
      </span>
    );
  }
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

export function bannerFilenameSlug(input: string): string {
  return generateSlug(input).slice(0, 40) || "banner";
}

export function isLowResLogoUrl(url: string | null): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg") || lower.includes("image/svg")) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const max = Math.max(img.naturalWidth, img.naturalHeight);
      resolve(max > 0 && max < 800);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

type WarningProps = {
  show: boolean;
  accentColor: string;
};

export function LowResLogoWarning({ show, accentColor }: WarningProps) {
  if (!show) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(217, 119, 6, 0.08)",
        border: "1px solid rgba(217, 119, 6, 0.25)",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1, color: "#D97706" }}>⚠</span>
      <div style={{ fontFamily: MONO, fontSize: 10, lineHeight: 1.5, color: "#D9A056" }}>
        Logo em baixa resolução. O banner pode sair com o logo borrado.{" "}
        <a
          href="/configuracoes"
          style={{ color: accentColor, textDecoration: "underline" }}
        >
          Atualizar em Configurações →
        </a>
      </div>
    </div>
  );
}

export function WhatsAppHint() {
  return (
    <div
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: 11,
        color: "#706B5F",
        textAlign: "center",
        lineHeight: 1.5,
        marginTop: -4,
      }}
    >
      Para preservar a nitidez no WhatsApp, envie como{" "}
      <strong style={{ color: "#9C9686" }}>documento</strong> (não como foto). Foto é comprimida; documento mantém a qualidade original.
    </div>
  );
}

export function useLogoLowResWarning(urls: (string | null)[]): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all(urls.map((u) => isLowResLogoUrl(u))).then((results) => {
      if (cancelled) return;
      setShow(results.some(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [urls.join("|")]);  // eslint-disable-line react-hooks/exhaustive-deps
  return show;
}
