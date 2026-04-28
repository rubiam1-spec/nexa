// NEXA — Sprint F1.1 (Hub Configurações)
// Composição do shell administrativo: AdminHeader (44px) + AdminSidebar
// (260px) + Breadcrumb + container de conteúdo.
//
// Estrutura:
//   +--------------------------------------+
//   | AdminHeader (44px)                   |
//   +----------+---------------------------+
//   |          |                           |
//   |  Admin   |  Breadcrumb               |
//   | Sidebar  |                           |
//   |  (260px) |  {children}               |
//   |          |                           |
//   +----------+---------------------------+
//
// AdminHeader e AdminSidebar não scrollam. O container de conteúdo é
// o ancestral scrollável — children que usam `position: sticky`
// (ex: footer do SettingsSection) ancoram nele.
//
// Navegação do sidebar: mapeia `itemPath` (ex: "empreendimentos.vivendas.branding")
// para URL `/configuracoes/empreendimentos/vivendas/branding`. F1.2 vai
// criar essas rotas. Em F1.1 a navegação ainda é "fora-de-banda" porque
// nenhuma rota real existe — não há caller renderizando este Layout
// nesta sprint.

import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import Breadcrumb, { type BreadcrumbItem } from "../Breadcrumb";

const T = {
  contentBg: "var(--color-ink)",
};

interface SettingsLayoutProps {
  activeSidebarItem?: string;
  breadcrumb: BreadcrumbItem[];
  children: ReactNode;
  onExit?: () => void;
}

const shellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  background: T.contentBg,
};

const bodyStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
};

const contentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: "auto",
  padding: 32,
  background: T.contentBg,
};

function itemPathToUrl(itemPath: string): string {
  return "/configuracoes/" + itemPath.split(".").join("/");
}

export default function SettingsLayout({
  activeSidebarItem,
  breadcrumb,
  children,
  onExit,
}: SettingsLayoutProps) {
  const navigate = useNavigate();

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      navigate("/central");
    }
  };

  const handleSidebarNavigate = (itemPath: string) => {
    navigate(itemPathToUrl(itemPath));
  };

  return (
    <div style={shellStyle}>
      <AdminHeader onExit={handleExit} />
      <div style={bodyStyle}>
        <AdminSidebar activeItem={activeSidebarItem} onNavigate={handleSidebarNavigate} />
        <main style={contentStyle}>
          <Breadcrumb items={breadcrumb} />
          <div style={{ marginTop: 16 }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
