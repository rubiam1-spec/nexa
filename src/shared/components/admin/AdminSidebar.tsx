// NEXA — Sprint F1.1 (Hub Configurações)
// Sidebar interna do hub. 6 categorias HARDCODED nesta sprint;
// F1.2 vai dinamizar (consumir empreendimentos do banco em vez
// de "Vivendas do Bosque" fixo).

import type { CSSProperties } from "react";

const T = {
  bg: "rgba(28,27,24,0.6)",
  borderRight: "rgba(61,58,48,0.4)",
  categoryHeader: "var(--color-slate)",
  subheader: "var(--color-fog)",
  itemActive: "var(--color-bone)",
  itemInactive: "var(--color-fog)",
  itemActiveBg: "rgba(74,222,128,0.06)",
  itemActiveBorder: "var(--color-sprout)",
  hoverBg: "rgba(255,255,255,0.04)",
  fontMono: "var(--font-mono)",
  fontSans: "var(--font-sans)",
};

type SidebarItemDef =
  | { kind: "item"; label: string; path: string; indent?: boolean }
  | { kind: "subheader"; label: string };

interface SidebarCategory {
  label: string;
  items: SidebarItemDef[];
}

const CATEGORIES: SidebarCategory[] = [
  {
    label: "Conta",
    items: [
      { kind: "item", label: "Identidade", path: "conta.identidade" },
      { kind: "item", label: "Contato", path: "conta.contato" },
      { kind: "item", label: "Plano e billing", path: "conta.billing" },
      { kind: "item", label: "Auditoria", path: "conta.auditoria" },
      { kind: "item", label: "Backup e exportação", path: "conta.backup" },
    ],
  },
  {
    label: "Empreendimentos",
    items: [
      { kind: "item", label: "Lista de empreendimentos", path: "empreendimentos.list" },
      { kind: "subheader", label: "Vivendas do Bosque" },
      { kind: "item", label: "Dados gerais", path: "empreendimentos.vivendas.dados", indent: true },
      { kind: "item", label: "Branding", path: "empreendimentos.vivendas.branding", indent: true },
      { kind: "item", label: "Regras comerciais", path: "empreendimentos.vivendas.regras", indent: true },
      { kind: "item", label: "Reserva", path: "empreendimentos.vivendas.reserva", indent: true },
      { kind: "item", label: "Fila de unidade", path: "empreendimentos.vivendas.fila", indent: true },
      { kind: "item", label: "Documentos requeridos", path: "empreendimentos.vivendas.documentos", indent: true },
      { kind: "item", label: "PDF e Propostas", path: "empreendimentos.vivendas.pdf", indent: true },
      { kind: "item", label: "Cadências e alertas", path: "empreendimentos.vivendas.cadencias", indent: true },
      { kind: "item", label: "Mapa de lotes", path: "empreendimentos.vivendas.mapa", indent: true },
      { kind: "item", label: "Labels customizadas", path: "empreendimentos.vivendas.labels", indent: true },
    ],
  },
  {
    label: "Regras Comerciais",
    items: [
      { kind: "item", label: "Negociação", path: "regras.negociacao" },
      { kind: "item", label: "Proposta", path: "regras.proposta" },
      { kind: "item", label: "Reserva (geral)", path: "regras.reserva" },
      { kind: "item", label: "Fila (geral)", path: "regras.fila" },
      { kind: "item", label: "Venda", path: "regras.venda" },
      { kind: "item", label: "Documentos da venda", path: "regras.documentos" },
    ],
  },
  {
    label: "Imóveis de Terceiros",
    items: [
      { kind: "item", label: "Configurações gerais", path: "imoveis.gerais" },
      { kind: "item", label: "Documentos por tipo", path: "imoveis.documentos" },
      { kind: "item", label: "Avaliação e descontos", path: "imoveis.avaliacao" },
      { kind: "item", label: "Fluxo de aprovação", path: "imoveis.aprovacao" },
      { kind: "item", label: "Apresentação ao mercado", path: "imoveis.apresentacao" },
    ],
  },
  {
    label: "Pessoas e Permissões",
    items: [
      { kind: "item", label: "Equipe", path: "pessoas.equipe" },
      { kind: "item", label: "Convites e onboarding", path: "pessoas.convites" },
      { kind: "item", label: "Permissões", path: "pessoas.permissoes" },
      { kind: "item", label: "Segurança", path: "pessoas.seguranca" },
      { kind: "item", label: "LGPD e privacidade", path: "pessoas.lgpd" },
    ],
  },
  {
    label: "Personalização e Integrações",
    items: [
      { kind: "item", label: "Cadências (transversal)", path: "personalizacao.cadencias" },
      { kind: "item", label: "Personalizar Central", path: "personalizacao.central" },
      { kind: "item", label: "Templates de mensagem", path: "personalizacao.templates" },
      { kind: "item", label: "Integrações", path: "personalizacao.integracoes" },
      { kind: "item", label: "Webhooks", path: "personalizacao.webhooks" },
    ],
  },
];

interface AdminSidebarProps {
  activeItem?: string;
  onNavigate: (itemPath: string) => void;
}

const sidebarStyle: CSSProperties = {
  width: 260,
  flexShrink: 0,
  background: T.bg,
  borderRight: `1px solid ${T.borderRight}`,
  padding: "24px 16px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const categoryHeaderStyle: CSSProperties = {
  fontFamily: T.fontMono,
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: T.categoryHeader,
  fontWeight: 600,
  marginBottom: 8,
  paddingLeft: 8,
};

const subheaderStyle: CSSProperties = {
  fontFamily: T.fontMono,
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: T.subheader,
  fontWeight: 600,
  marginTop: 8,
  marginBottom: 4,
  paddingLeft: 8,
};

function buildItemStyle(active: boolean, indent: boolean): CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: active ? T.itemActiveBg : "transparent",
    border: "none",
    borderLeft: active ? `2px solid ${T.itemActiveBorder}` : "2px solid transparent",
    color: active ? T.itemActive : T.itemInactive,
    fontFamily: T.fontSans,
    fontSize: 13.5,
    fontWeight: active ? 500 : 400,
    padding: "6px 8px 6px 8px",
    paddingLeft: indent ? 20 : 8,
    cursor: "pointer",
    transition: "background 120ms ease, color 120ms ease",
    borderRadius: 0,
  };
}

interface SidebarGroupProps {
  category: SidebarCategory;
  activeItem?: string;
  onNavigate: (itemPath: string) => void;
}

function SidebarGroup({ category, activeItem, onNavigate }: SidebarGroupProps) {
  return (
    <div>
      <div style={categoryHeaderStyle}>{category.label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {category.items.map((item, idx) => {
          if (item.kind === "subheader") {
            return (
              <div key={`sub-${idx}`} style={subheaderStyle}>
                {item.label}
              </div>
            );
          }
          const active = activeItem === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              style={buildItemStyle(active, Boolean(item.indent))}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = T.hoverBg;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminSidebar({ activeItem, onNavigate }: AdminSidebarProps) {
  return (
    <aside style={sidebarStyle}>
      {CATEGORIES.map((cat) => (
        <SidebarGroup
          key={cat.label}
          category={cat}
          activeItem={activeItem}
          onNavigate={onNavigate}
        />
      ))}
    </aside>
  );
}
