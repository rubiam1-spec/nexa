// NEXA — Engrenagem de Cônjuge v2 (Sprint A.1)
// Drawer slide-over que abre ao clicar VER FICHA no card hero do cônjuge.
// Mostra dados essenciais (nome, CPF, telefone, email, estado civil,
// regime). Footer com CTA para abrir a ficha completa.
//
// Padrão visual: 70% desktop / 100% mobile, createPortal, overlay com
// blur. Todos os hooks chamados ANTES de qualquer early return
// (Rules of Hooks).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { formatCPF, formatPhone } from "../../../shared/utils/masks";
import { getClientWithSpouse } from "../../../infra/repositories/clientsSupabaseRepository";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import type { Client } from "../../../shared/types/client";

// Token map local — mesmo padrão estabelecido em ClientDetailPage.tsx.
// T.mono não existe no T do ClientDetailPage; usar var(--font-mono)
// inline em fontFamily.
const T = {
  ink: "var(--surface-base)",
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  sprout: "var(--interactive-primary)",
  blue: "#60A5FA",
  red: "#F87171",
  amber: "#FBBF24",
  purple: "#A78BFA",
};

const REGIME_LABEL: Record<string, string> = {
  comunhao_parcial: "Comunhão parcial de bens",
  comunhao_universal: "Comunhão universal de bens",
  separacao_total: "Separação total de bens",
  participacao_final_aquestos: "Participação final nos aquestos",
};

const MARITAL_LABEL: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
};

// SVG icons inline — substituem emojis e evitam dep nova de lucide-react.
type IconProps = { size?: number; color?: string };

const Icon = {
  Heart: ({ size = 14, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  ),
  Phone: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Mail: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  ArrowRight: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
  X: ({ size = 16, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
};

interface SpousePeekProps {
  open: boolean;
  spouseId: string | null;
  onClose: () => void;
}

export default function SpousePeek({ open, spouseId, onClose }: SpousePeekProps) {
  const navigate = useNavigate();
  const screen = useScreen();
  const isMobile = screen.isMobile;

  const [spouse, setSpouse] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch quando abre + spouseId muda
  useEffect(() => {
    if (!open || !spouseId) {
      setSpouse(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await getClientWithSpouse(spouseId);
        if (!cancelled) {
          setSpouse(result?.client ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, spouseId]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleOpenFull = () => {
    if (!spouse?.id) return;
    onClose();
    navigate(`/contatos/${spouse.id}`);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(2px)",
        }}
      />
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: isMobile ? "100%" : "70%",
          maxWidth: isMobile ? "100%" : 720,
          height: "100%",
          background: T.ink,
          borderLeft: `1px solid ${T.stone}`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: 24,
            borderBottom: `1px solid ${T.stone}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                color: T.bone,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon.Heart size={14} color={T.bone} />
              CÔNJUGE
            </div>
            {loading && (
              <div style={{ color: T.bone, fontSize: 14 }}>Carregando...</div>
            )}
            {error && (
              <div style={{ color: T.amber, fontSize: 14 }}>{error}</div>
            )}
            {spouse && (
              <h2 style={{ fontSize: 24, fontWeight: 700, color: T.chalk, margin: 0, lineHeight: 1.2 }}>
                {spouse.fullName || spouse.name || "(sem nome)"}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              padding: 8,
              borderRadius: 6,
              border: `1px solid ${T.stone}`,
              background: "transparent",
              color: T.chalk,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon.X size={16} color={T.chalk} />
          </button>
        </header>

        {spouse && !loading && (
          <div style={{ padding: 24, flex: 1 }}>
            <section style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  color: T.bone,
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                DADOS PESSOAIS
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {spouse.cpf && <Field label="CPF" value={formatCPF(spouse.cpf)} />}
                {spouse.phone && (
                  <Field
                    label="Telefone"
                    value={formatPhone(spouse.phone)}
                    icon={<Icon.Phone size={12} color={T.bone} />}
                  />
                )}
                {spouse.email && (
                  <Field
                    label="Email"
                    value={spouse.email}
                    icon={<Icon.Mail size={12} color={T.bone} />}
                  />
                )}
              </div>
            </section>

            {spouse.maritalStatus && (
              <section style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 1.2,
                    color: T.bone,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  ESTADO CIVIL
                </div>
                <div style={{ color: T.chalk, fontSize: 14 }}>
                  {MARITAL_LABEL[spouse.maritalStatus] ?? spouse.maritalStatus}
                </div>
                {spouse.regimeCasamento && (
                  <div style={{ color: T.bone, fontSize: 13, marginTop: 4 }}>
                    {REGIME_LABEL[spouse.regimeCasamento] ?? spouse.regimeCasamento}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {spouse && !loading && (
          <footer
            style={{
              padding: 24,
              borderTop: `1px solid ${T.stone}`,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={handleOpenFull}
              style={{
                padding: "10px 20px",
                borderRadius: 6,
                border: "none",
                background: T.sprout,
                color: T.ink,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ABRIR FICHA COMPLETA
              <Icon.ArrowRight size={12} color={T.ink} />
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1,
          color: T.bone,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: T.chalk,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
