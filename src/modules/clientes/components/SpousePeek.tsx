// NEXA — Engrenagem de Cônjuge v2 (Sprint A.2)
// Drawer slide-over que abre ao clicar VER FICHA no card hero do cônjuge.
// Sprint A.2: passa a mostrar a "Ficha do Casal" — visão unificada de
// principal + cônjuge com identidade, dados em 2 colunas, negociações
// da família e qualificação (pendências de cadastro de ambos).
//
// Padrão visual: 70% desktop / 100% mobile, createPortal, overlay com
// blur. Todos os hooks chamados ANTES de qualquer early return
// (Rules of Hooks).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { formatCPF, formatPhone } from "../../../shared/utils/masks";
import { getClientWithSpouse } from "../../../infra/repositories/clientsSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import type { Client } from "../../../shared/types/client";
import type { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { openActionLabel } from "../../../shared/navigation/entityRoutes";

// Token map local — mesmo padrão estabelecido em ClientDetailPage.tsx.
// T.mono não existe; usar var(--font-mono) inline em fontFamily.
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
  Users: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  User: ({ size = 12, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  CheckCircle: ({ size = 14, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  AlertTriangle: ({ size = 14, color = "currentColor" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
};

// Tipo estrutural mínimo do principal — evita exportar ClientData de
// ClientDetailPage e mantém o contrato narrow.
interface PrincipalClient {
  id: string;
  name: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  regime_casamento: string | null;
}

interface SpousePeekProps {
  open: boolean;
  principalClient: PrincipalClient;
  spouseId: string | null;
  onClose: () => void;
}

interface NegRow {
  id: string;
  status: string;
  unit_id: string | null;
  client_id: string;
  temperature: string | null;
  created_at: string;
  parties: Array<{ client_id: string; role: string }>;
}

function badgeFamilia(neg: NegRow, principalId: string, spouseId: string): "JUNTOS" | "INDIVIDUAL" {
  const ids = new Set<string>();
  ids.add(neg.client_id);
  for (const p of neg.parties ?? []) ids.add(p.client_id);
  return ids.has(principalId) && ids.has(spouseId) ? "JUNTOS" : "INDIVIDUAL";
}

function pendencias(c: { cpf: string | null; phone: string | null; email: string | null }): string[] {
  const items: string[] = [];
  if (!c.cpf) items.push("CPF não cadastrado");
  if (!c.phone) items.push("Telefone não cadastrado");
  if (!c.email) items.push("Email não cadastrado");
  return items;
}

export default function SpousePeek({ open, principalClient, spouseId, onClose }: SpousePeekProps) {
  const navigate = useNavigate();
  const screen = useScreen();
  const isMobile = screen.isMobile;

  const [spouse, setSpouse] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [negociacoes, setNegociacoes] = useState<NegRow[]>([]);
  const [negociacoesLoading, setNegociacoesLoading] = useState(false);

  // Fetch quando abre + spouseId muda
  useEffect(() => {
    if (!open || !spouseId) {
      setSpouse(null);
      setError(null);
      setNegociacoes([]);
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

    // Carregar negociações da família em paralelo
    if (supabase) {
      setNegociacoesLoading(true);
      (async () => {
        try {
          const ids = [principalClient.id, spouseId];
          const [partyRes, directRes] = await Promise.all([
            supabase!.from("negotiation_parties").select("negotiation_id").in("client_id", ids),
            supabase!.from("negotiations").select("id").in("client_id", ids),
          ]);
          const negIds = new Set<string>();
          for (const r of (partyRes.data ?? []) as Array<{ negotiation_id: string }>) {
            negIds.add(r.negotiation_id);
          }
          for (const r of (directRes.data ?? []) as Array<{ id: string }>) {
            negIds.add(r.id);
          }
          if (negIds.size === 0) {
            if (!cancelled) setNegociacoes([]);
            return;
          }
          const { data: rows } = await supabase!
            .from("negotiations")
            .select("id, status, unit_id, client_id, temperature, created_at, parties:negotiation_parties(client_id, role)")
            .in("id", Array.from(negIds))
            .order("created_at", { ascending: false });
          if (!cancelled) setNegociacoes((rows ?? []) as unknown as NegRow[]);
        } catch (err) {
          console.error("[SpousePeek] Falha ao carregar negociações da família:", err);
          if (!cancelled) setNegociacoes([]);
        } finally {
          if (!cancelled) setNegociacoesLoading(false);
        }
      })();
    }

    return () => { cancelled = true; };
  }, [open, spouseId, principalClient.id]);

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

  const handleOpenNeg = (id: string) => {
    onClose();
    navigate(`/negociacoes/${id}`);
  };

  const principalName = principalClient.full_name || principalClient.name || "(sem nome)";
  const spouseName = spouse ? (spouse.fullName || spouse.name || "(sem nome)") : "";
  const regime = principalClient.regime_casamento;
  const pendPrincipal = pendencias(principalClient);
  const pendSpouse = spouse
    ? pendencias({ cpf: spouse.cpf, phone: spouse.phone || null, email: spouse.email || null })
    : [];
  const totalPendencias = pendPrincipal.length + pendSpouse.length;

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
        {/* HEADER */}
        <header
          style={{
            padding: 24,
            borderBottom: `1px solid ${T.stone}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <PilulaCaps icon={<Icon.Heart size={14} color={T.bone} />}>FICHA DO CASAL</PilulaCaps>
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

        {loading && !spouse && (
          <div style={{ padding: 24, color: T.bone, fontSize: 14 }}>Carregando...</div>
        )}
        {error && (
          <div style={{ padding: 24, color: T.amber, fontSize: 14 }}>{error}</div>
        )}

        {spouse && (
          <div style={{ padding: 24, flex: 1 }}>
            {/* IDENTIDADE */}
            <section style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: T.chalk,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {principalName} <span style={{ color: T.fog, fontWeight: 400 }}>+</span> {spouseName}
              </h2>
              <div style={{ color: T.bone, fontSize: 13, marginTop: 6 }}>
                Casados{regime ? ` · ${REGIME_LABEL[regime] ?? regime}` : ""}
              </div>
            </section>

            {/* DADOS PESSOAIS */}
            <section style={{ marginBottom: 28 }}>
              <PilulaCaps>DADOS PESSOAIS</PilulaCaps>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: isMobile ? 16 : 24,
                  marginTop: 12,
                }}
              >
                <ColunaPessoa
                  label="COMPRADOR PRINCIPAL"
                  name={principalName}
                  cpf={principalClient.cpf}
                  phone={principalClient.phone}
                  email={principalClient.email}
                />
                <ColunaPessoa
                  label="CÔNJUGE"
                  name={spouseName}
                  cpf={spouse.cpf}
                  phone={spouse.phone || null}
                  email={spouse.email || null}
                />
              </div>
            </section>

            {/* NEGOCIAÇÕES DA FAMÍLIA */}
            <section style={{ marginBottom: 28 }}>
              <PilulaCaps>NEGOCIAÇÕES DA FAMÍLIA · {negociacoes.length}</PilulaCaps>
              {negociacoesLoading && (
                <div style={{ color: T.bone, fontSize: 13, marginTop: 12 }}>Carregando negociações...</div>
              )}
              {!negociacoesLoading && negociacoes.length === 0 && (
                <div style={{ color: T.bone, fontSize: 13, marginTop: 12 }}>Nenhuma negociação registrada</div>
              )}
              {!negociacoesLoading && negociacoes.length > 0 && (
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {negociacoes.map((neg) => {
                    const tag = badgeFamilia(neg, principalClient.id, spouseId!);
                    return (
                      <div
                        key={neg.id}
                        style={{
                          background: T.carbon,
                          border: `1px solid ${T.stone}`,
                          borderRadius: 8,
                          padding: 14,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: isMobile ? "column" : "row",
                            justifyContent: "space-between",
                            alignItems: isMobile ? "flex-start" : "center",
                            gap: 8,
                          }}
                        >
                          <strong style={{ color: T.chalk, fontSize: 14 }}>
                            {neg.unit_id ? `Lote — ${neg.unit_id.slice(0, 8)}` : "(unidade não definida)"}
                          </strong>
                          <Badge variant={tag} />
                        </div>
                        <div style={{ color: T.bone, fontSize: 12, marginTop: 4 }}>
                          Status: {getNegotiationStatusLabel(neg.status as NegotiationStatus) ?? neg.status}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenNeg(neg.id)}
                          style={{
                            marginTop: 10,
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: `1px solid ${T.stone}`,
                            background: "transparent",
                            color: T.chalk,
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Ver negociação
                          <Icon.ArrowRight size={12} color={T.chalk} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* QUALIFICAÇÃO DO CASAL */}
            <section style={{ marginBottom: 8 }}>
              <PilulaCaps>QUALIFICAÇÃO DO CASAL</PilulaCaps>
              <div
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: totalPendencias === 0 ? T.sprout : T.amber,
                }}
              >
                {totalPendencias === 0 ? (
                  <>
                    <Icon.CheckCircle size={14} color={T.sprout} />
                    Dados completos
                  </>
                ) : (
                  <>
                    <Icon.AlertTriangle size={14} color={T.amber} />
                    {totalPendencias} {totalPendencias === 1 ? "item pendente" : "itens pendentes"}
                  </>
                )}
              </div>
              {totalPendencias > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 16,
                    marginTop: 12,
                  }}
                >
                  {pendPrincipal.length > 0 && (
                    <ListaPendencias nome={principalName} items={pendPrincipal} />
                  )}
                  {pendSpouse.length > 0 && (
                    <ListaPendencias nome={spouseName} items={pendSpouse} />
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* FOOTER */}
        {spouse && (
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
              {openActionLabel("contact")}
              <Icon.ArrowRight size={12} color={T.ink} />
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function PilulaCaps({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: 1.2,
        color: T.bone,
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {children}
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1,
          color: T.fog,
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
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 6,
          wordBreak: "break-word",
        }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

function ColunaPessoa({
  label,
  name,
  cpf,
  phone,
  email,
}: {
  label: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          color: T.fog,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: T.chalk, margin: "0 0 10px" }}>{name}</h3>
      <div style={{ display: "grid", gap: 8 }}>
        <Field label="CPF" value={cpf ? formatCPF(cpf) : "—"} />
        <Field label="Telefone" value={phone ? formatPhone(phone) : "—"} icon={<Icon.Phone size={12} color={T.bone} />} />
        <Field label="Email" value={email || "—"} icon={<Icon.Mail size={12} color={T.bone} />} />
      </div>
    </div>
  );
}

function Badge({ variant }: { variant: "JUNTOS" | "INDIVIDUAL" }) {
  const isJuntos = variant === "JUNTOS";
  const color = isJuntos ? T.sprout : T.fog;
  const bg = isJuntos ? "rgba(74,222,128,0.10)" : "rgba(156,150,134,0.10)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 100,
        background: bg,
        color,
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: 0.5,
      }}
    >
      {isJuntos ? <Icon.Users size={12} color={color} /> : <Icon.User size={12} color={color} />}
      {variant}
    </span>
  );
}

function ListaPendencias({ nome, items }: { nome: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk, marginBottom: 6 }}>
        {nome} <span style={{ color: T.fog, fontWeight: 400 }}>({items.length})</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: T.bone, fontSize: 12, lineHeight: 1.7 }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
