import type { CSSProperties } from "react";
import type { LoginMuralItem } from "../types/loginMural";

const BADGE_COLORS: Record<string, string> = {
  sprout: "#4ADE80",
  terracotta: "#D97706",
  blue: "#60A5FA",
  purple: "#A78BFA",
  red: "#F87171",
  yellow: "#FBBF24",
};

function resolveBadgeColor(color: string | null | undefined): string {
  if (!color) return "#4ADE80";
  return BADGE_COLORS[color] ?? color; // aceita token nome ou hex direto
}

interface LoginMuralProps {
  item: LoginMuralItem;
  /** Mobile: tipografia menor, CTA omitido. */
  compact?: boolean;
}

export default function LoginMural({ item, compact = false }: LoginMuralProps) {
  const hasBadge = Boolean(item.badge_label);
  const hasCta = !compact && Boolean(item.cta_label);
  const badgeColor = resolveBadgeColor(item.badge_color ?? null);

  const headlineStyle: CSSProperties = compact
    ? {
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontStyle: "italic",
        fontSize: 22,
        lineHeight: 1.3,
        fontWeight: 400,
        color: "#FAF9F6",
        margin: 0,
      }
    : {
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontStyle: "italic",
        fontSize: 34,
        lineHeight: 1.22,
        letterSpacing: "-0.01em",
        fontWeight: 400,
        color: "#FAF9F6",
        margin: 0,
      };

  const sublineStyle: CSSProperties = {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 300,
    fontSize: compact ? 13 : 14,
    lineHeight: 1.55,
    color: "#9C9686",
    margin: "14px 0 0",
    maxWidth: compact ? undefined : 440,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14, maxWidth: compact ? undefined : 480 }}>
      {hasBadge ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            padding: "6px 14px",
            borderRadius: 999,
            background: `${badgeColor}14`,
            border: `1px solid ${badgeColor}3d`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: badgeColor,
              boxShadow: `0 0 8px ${badgeColor}80`,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              color: badgeColor,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {item.badge_label}
          </span>
        </div>
      ) : null}

      <h2 style={headlineStyle}>{item.headline}</h2>

      {item.subline ? <p style={sublineStyle}>{item.subline}</p> : null}

      {hasCta ? (
        <a
          href={item.cta_url ?? "#"}
          target={item.cta_url?.startsWith("http") ? "_blank" : undefined}
          rel={item.cta_url?.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#4ADE80",
            textDecoration: "none",
            padding: "6px 0",
          }}
        >
          {item.cta_label}
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
            →
          </span>
        </a>
      ) : null}
    </div>
  );
}
