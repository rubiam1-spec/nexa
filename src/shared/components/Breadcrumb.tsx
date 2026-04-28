// NEXA — Sprint F1.1 (Hub Configurações)
// Breadcrumb shared global. Resolve débito identificado na auditoria
// onde 4+ páginas reimplementam breadcrumb inline.
//
// Item com href: clicável (react-router Link)
// Item sem href: atual (último, não clicável, color Bone)

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

const T = {
  intermediate: "var(--color-slate)",
  current: "var(--color-bone)",
  separator: "var(--color-clay)",
  fontMono: "var(--font-mono)",
};

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const containerStyle: CSSProperties = {
  fontFamily: T.fontMono,
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  padding: "8px 0",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
};

const intermediateLinkStyle: CSSProperties = {
  color: T.intermediate,
  textDecoration: "none",
  transition: "color 120ms ease",
};

const currentStyle: CSSProperties = {
  color: T.current,
  fontWeight: 500,
};

const separatorStyle: CSSProperties = {
  color: T.separator,
  userSelect: "none",
};

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="breadcrumb" style={containerStyle}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const showSeparator = !isLast;
        return (
          <span key={`${item.label}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {item.href && !isLast ? (
              <Link
                to={item.href}
                style={intermediateLinkStyle}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={isLast ? currentStyle : intermediateLinkStyle}>{item.label}</span>
            )}
            {showSeparator ? <span style={separatorStyle}>›</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
