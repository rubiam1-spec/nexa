import { useState, useEffect } from "react";
import ComunicadoBannerModal, { type ComunicadoTipo } from "./ComunicadoBannerModal";
import { type TextConfig } from "./BannerTemplateEditorModal";

// ── Types ──

interface BannerTemplate {
  id: string;
  name: string;
  background_url: string;
  text_config: TextConfig;
}

interface RecentComunicado {
  id: string;
  title: string;
  tipoKey: string;
  color: string;
  createdAt: string;
}

interface Props {
  accountId: string;
  accountLogo: string | null;
  devLogo: string | null;
  accountName: string;
  footerText: string;
  corPrimaria: string;
  customTemplates: BannerTemplate[];
}

// ── Constants ──

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Outfit', sans-serif";

function getComunicadoTypes(corPrimaria: string): ComunicadoTipo[] {
  return [
    {
      key: "launch",
      label: "Novo Lançamento",
      description: "Anuncie um novo empreendimento ou fase do projeto",
      color: corPrimaria,
      defaultTitle: "Novo Lançamento",
      defaultMessage: "Temos uma novidade incrível para você. Entre em contato e saiba mais!",
    },
    {
      key: "special",
      label: "Condição Especial",
      description: "Divulgue condição limitada ou oportunidade de fechamento",
      color: "#D97706",
      defaultTitle: "Condição Especial",
      defaultMessage: "Condição exclusiva por tempo limitado. Não perca esta oportunidade!",
    },
    {
      key: "training",
      label: "Treinamento",
      description: "Convide corretores para capacitação ou workshop",
      color: "#3B82F6",
      defaultTitle: "Treinamento",
      defaultMessage: "Participe do nosso próximo treinamento e leve suas vendas ao próximo nível.",
    },
    {
      key: "event",
      label: "Evento Exclusivo",
      description: "Convide para evento especial da incorporadora",
      color: "#8B5CF6",
      defaultTitle: "Evento Exclusivo",
      defaultMessage: "Você está convidado para um momento especial. Sua presença faz toda a diferença.",
    },
  ];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

// ── Component ──

export default function ComunicadosTab({
  accountId, accountLogo, devLogo, accountName, footerText, corPrimaria, customTemplates,
}: Props) {
  const tipos = getComunicadoTypes(corPrimaria);
  const [selectedTipo, setSelectedTipo] = useState<ComunicadoTipo | null>(null);
  const [recentComunicados, setRecentComunicados] = useState<RecentComunicado[]>([]);

  const storageKey = `nexa_comunicados_${accountId}`;

  // Load recent from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setRecentComunicados(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const handleCreated = ({ title, tipo }: { title: string; tipo: ComunicadoTipo }) => {
    const entry: RecentComunicado = {
      id: Date.now().toString(),
      title,
      tipoKey: tipo.key,
      color: tipo.color,
      createdAt: new Date().toISOString(),
    };
    setRecentComunicados((prev) => {
      const updated = [entry, ...prev].slice(0, 10); // keep last 10
      try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  };

  const reopenRecent = (recent: RecentComunicado) => {
    const tipo = tipos.find((t) => t.key === recent.tipoKey);
    if (tipo) setSelectedTipo({ ...tipo, defaultTitle: recent.title });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Section header */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
          Comunicados
        </div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Crie comunicados visuais para compartilhar com sua rede de corretores.
        </p>
      </div>

      {/* 2×2 tipo grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {tipos.map((tipo) => (
          <div key={tipo.key} style={{
            padding: "20px 20px 16px",
            background: "var(--surface-raised)",
            border: "1px solid var(--border-default)",
            borderTop: `3px solid ${tipo.color}`,
            borderRadius: 12,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: tipo.color, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {tipo.label}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, flex: 1 }}>
              {tipo.description}
            </div>
            <button
              onClick={() => setSelectedTipo(tipo)}
              style={{
                padding: "9px 16px", borderRadius: 8,
                border: `1px solid ${tipo.color}40`,
                background: `${tipo.color}08`,
                color: tipo.color,
                fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "background 150ms, border-color 150ms",
                textAlign: "left",
              }}
            >
              Criar comunicado
            </button>
          </div>
        ))}
      </div>

      {/* Recent comunicados */}
      {recentComunicados.length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
            Comunicados Recentes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentComunicados.map((c) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px",
                background: "var(--surface-raised)", border: "1px solid var(--border-default)",
                borderRadius: 10,
              }}>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.title}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    {formatDate(c.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => reopenRecent(c)}
                  style={{
                    padding: "5px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", background: "transparent",
                    color: "var(--text-muted)", fontFamily: SANS, fontSize: 12, cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Recriar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner modal */}
      {selectedTipo && (
        <ComunicadoBannerModal
          isOpen={!!selectedTipo}
          onClose={() => setSelectedTipo(null)}
          tipo={selectedTipo}
          accountLogo={accountLogo}
          devLogo={devLogo}
          accountName={accountName}
          footerText={footerText}
          customTemplates={customTemplates}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
