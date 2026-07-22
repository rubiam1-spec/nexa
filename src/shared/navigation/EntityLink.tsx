import { Link, useLocation } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { entityRoute, routeLabel, type EntityKind } from "./entityRoutes";

// Link canônico para a casa de uma entidade (Lei 2). Estilo ÚNICO: cor neutra
// (herda — NUNCA azul-web), cursor e sublinhado sutil só no hover. Injeta a
// origem no state (Lei 3). stopPropagation p/ não disparar o onClick do container
// (ex.: card do Kanban que também navega).
const base: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer",
  borderBottom: "1px solid transparent",
  transition: "border-color 120ms ease",
};

export function EntityLink({
  entity, id, devId, children, title, style, onNavigate,
}: {
  entity: EntityKind;
  id: string;
  devId?: string;
  children: ReactNode;
  title?: string;
  style?: CSSProperties;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const to = entityRoute(entity, id, devId);
  return (
    <Link
      to={to}
      state={{ from: location.pathname + location.search, fromLabel: routeLabel(location.pathname) }}
      title={title}
      onClick={(e) => { e.stopPropagation(); onNavigate?.(); }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderBottomColor = "currentColor"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderBottomColor = "transparent"; }}
      style={{ ...base, ...style }}
    >
      {children}
    </Link>
  );
}

export default EntityLink;
