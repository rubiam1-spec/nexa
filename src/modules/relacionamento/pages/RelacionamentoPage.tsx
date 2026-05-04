import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import BirthdayBannerModal from "../components/BirthdayBannerModal";
import ConfiguracoesTab from "../components/ConfiguracoesTab";
import ReconhecimentosTab from "../components/ReconhecimentosTab";
import ComunicadosTab from "../components/ComunicadosTab";
import PlanejamentoTab from "../components/PlanejamentoTab";
import { type TextConfig } from "../components/BannerTemplateEditorModal";

// ── Tokens ──

const T = {
  ink: "var(--surface-base)",
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  sprout: "var(--interactive-primary)",
};

const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "'Outfit', sans-serif";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── Types ──

interface BrokerRow {
  id: string;
  name: string;
  phone: string | null;
  brokerage_name: string | null;
  data_nascimento: string | null;
  city: string | null;
}

interface BrandingData {
  accountLogo: string | null;
  accountLogoLight: string | null;
  devLogo: string | null;
  devLogoLight: string | null;
  corPrimaria: string;
  corSecundaria: string;
  accountName: string;
  devName: string;
  city: string;
  state: string;
  footerText: string;
}

interface BannerTemplate {
  id: string;
  name: string;
  background_url: string;
  text_config: TextConfig;
}

// ── Helpers ──

function parseBirthday(s: string | null): { day: number; month: number } | null {
  if (!s) return null;
  const parts = s.split("-");
  if (parts.length === 3) return { month: parseInt(parts[1]), day: parseInt(parts[2]) };
  if (parts.length === 2) return { month: parseInt(parts[0]), day: parseInt(parts[1]) };
  return null;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// ── Toast ──

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return createPortal(
    <div style={{
      position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
      background: T.sprout, color: T.ink, padding: "10px 24px",
      borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)", fontFamily: SANS,
    }}>
      {message}
    </div>,
    document.body,
  );
}

// ── Main Page ──

export default function RelacionamentoPage() {
  const { user } = useAuth();
  const { account } = useAccount();
  const { development } = useDevelopment();

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;

  const [tab, setTab] = useState<"datas" | "reconhecimentos" | "comunicados" | "planejamento" | "configuracoes">("datas");
  const isManager = ["owner", "director", "manager"].includes(account?.role ?? "");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [bannerBroker, setBannerBroker] = useState<BrokerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [customBannerTemplates, setCustomBannerTemplates] = useState<BannerTemplate[]>([]);
  const [customRecTemplates, setCustomRecTemplates] = useState<BannerTemplate[]>([]);
  const [customAnnounceTemplates, setCustomAnnounceTemplates] = useState<BannerTemplate[]>([]);
  const [birthdayMsgTemplate, setBirthdayMsgTemplate] = useState<string | null>(null);

  const corPrimaria = branding?.corPrimaria ?? "#4ADE80";

  // Load sent from localStorage
  useEffect(() => {
    if (!accountId) return;
    const year = new Date().getFullYear();
    const key = `nexa_birthday_sent_${accountId}_${year}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSent(new Set(JSON.parse(raw)));
    } catch {
      // ignore
    }
  }, [accountId]);

  // Load branding
  useEffect(() => {
    if (!accountId || !developmentId || !supabase) return;
    let mounted = true;
    async function loadBranding() {
      try {
        const [accRes, devSettingsRes, devRes] = await Promise.all([
          supabase!.from("account_settings")
            .select("logo_url, logo_light_url, cor_primaria, cor_secundaria, nome_comercial, slogan")
            .eq("account_id", accountId)
            .maybeSingle(),
          supabase!.from("development_settings")
            .select("logo_empreendimento_url, logo_light_url")
            .eq("development_id", developmentId)
            .maybeSingle(),
          supabase!.from("developments")
            .select("name, city, state")
            .eq("id", developmentId)
            .maybeSingle(),
        ]);
        if (!mounted) return;
        const acc = accRes.data as any;
        const devSettings = devSettingsRes.data as any;
        const dev = devRes.data as any;
        setBranding({
          accountLogo: acc?.logo_url ?? null,
          accountLogoLight: acc?.logo_light_url ?? null,
          devLogo: devSettings?.logo_empreendimento_url ?? null,
          devLogoLight: devSettings?.logo_light_url ?? null,
          corPrimaria: acc?.cor_primaria ?? "#4ADE80",
          corSecundaria: acc?.cor_secundaria ?? "#2A2822",
          accountName: acc?.nome_comercial ?? account?.accountName ?? "",
          devName: dev?.name ?? development?.developmentName ?? "",
          city: dev?.city ?? "",
          state: dev?.state ?? "",
          footerText: acc?.slogan || acc?.nome_comercial || account?.accountName || "",
        });
      } catch (e) {
        console.error("Erro ao carregar branding:", e);
      }
    }
    loadBranding();
    return () => { mounted = false; };
  }, [accountId, developmentId, account?.accountName, development?.developmentName]);

  // Load brokers
  useEffect(() => {
    if (!accountId || !supabase) { setLoading(false); return; }
    let mounted = true;
    async function loadBrokers() {
      setLoading(true);
      try {
        const { data } = await supabase!
          .from("brokers")
          .select("id, name, phone, brokerage_name, data_nascimento, city")
          .eq("account_id", accountId)
          .not("data_nascimento", "is", null);
        if (!mounted) return;
        setBrokers((data as BrokerRow[]) ?? []);
      } catch (e) {
        console.error("Erro ao carregar corretores:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadBrokers();
    return () => { mounted = false; };
  }, [accountId]);

  // Load custom banner & message templates
  useEffect(() => {
    if (!accountId || !supabase) return;
    supabase
      .from("banner_templates")
      .select("id, name, background_url, text_config")
      .eq("account_id", accountId)
      .eq("type", "birthday")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setCustomBannerTemplates((data ?? []) as BannerTemplate[]));
    supabase
      .from("message_templates")
      .select("message_text")
      .eq("account_id", accountId)
      .eq("type", "birthday")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBirthdayMsgTemplate(data?.message_text ?? null));
    supabase
      .from("banner_templates")
      .select("id, name, background_url, text_config")
      .eq("account_id", accountId)
      .eq("type", "recognition")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setCustomRecTemplates((data ?? []) as BannerTemplate[]));
    supabase
      .from("banner_templates")
      .select("id, name, background_url, text_config")
      .eq("account_id", accountId)
      .eq("type", "announcement")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setCustomAnnounceTemplates((data ?? []) as BannerTemplate[]));
  }, [accountId]);

  // Computed
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) counts[m] = 0;
    for (const b of brokers) {
      const bd = parseBirthday(b.data_nascimento);
      if (bd) counts[bd.month] = (counts[bd.month] ?? 0) + 1;
    }
    return counts;
  }, [brokers]);

  const monthBirthdays = useMemo(() => {
    const list = brokers
      .map((b) => ({ broker: b, bd: parseBirthday(b.data_nascimento) }))
      .filter((x) => x.bd && x.bd.month === selectedMonth)
      .map((x) => ({
        broker: x.broker,
        day: x.bd!.day,
        month: x.bd!.month,
        isToday: x.bd!.day === todayDay && x.bd!.month === todayMonth,
        isPast: x.bd!.month < todayMonth || (x.bd!.month === todayMonth && x.bd!.day < todayDay),
      }));

    // Sort: today first, then upcoming, then past — within group by day
    const todays = list.filter((x) => x.isToday).sort((a, b) => a.day - b.day);
    const upcoming = list.filter((x) => !x.isToday && !x.isPast).sort((a, b) => a.day - b.day);
    const past = list.filter((x) => !x.isToday && x.isPast).sort((a, b) => a.day - b.day);
    return [...todays, ...upcoming, ...past];
  }, [brokers, selectedMonth, todayDay, todayMonth]);

  const toggleSent = (id: string) => {
    setSent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      const year = new Date().getFullYear();
      const key = `nexa_birthday_sent_${accountId}_${year}`;
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  };

  // ── Render ──

  const TABS: { key: "datas" | "reconhecimentos" | "comunicados" | "planejamento" | "configuracoes"; label: string }[] = [
    { key: "datas", label: "Datas Especiais" },
    { key: "reconhecimentos", label: "Reconhecimentos" },
    { key: "comunicados", label: "Comunicados" },
    { key: "planejamento", label: "Planejamento" },
    ...(isManager ? [{ key: "configuracoes" as const, label: "Configurações" }] : []),
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 840, margin: "0 auto", fontFamily: SANS }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 28, color: T.chalk, margin: 0, marginBottom: 6 }}>
          Relacionamento
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 11, color: T.slate, margin: 0 }}>
          Fortaleça o vínculo com sua rede de corretores
        </p>
      </div>

      {/* Tab pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: tab === t.key ? "none" : `1px solid ${T.stone}`,
              background: tab === t.key ? corPrimaria : "transparent",
              color: tab === t.key ? "#1C1B18" : T.bone,
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Datas Especiais ── */}
      {tab === "datas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Calendar grid */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: T.slate, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
              Calendário Anual
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const count = monthCounts[m] ?? 0;
                const isSelected = m === selectedMonth;
                const isCurrent = m === todayMonth;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: isSelected
                        ? `1.5px solid ${corPrimaria}`
                        : `1px solid ${T.stone}`,
                      background: isSelected ? `${corPrimaria}12` : T.carbon,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      position: "relative",
                      transition: "all 120ms ease",
                    }}
                  >
                    {isCurrent && (
                      <div style={{
                        position: "absolute", top: 6, right: 6,
                        width: 5, height: 5, borderRadius: "50%",
                        background: corPrimaria,
                      }} />
                    )}
                    <span style={{
                      fontFamily: SANS,
                      fontSize: 12,
                      fontWeight: 600,
                      color: isSelected ? corPrimaria : (count > 0 ? T.chalk : T.slate),
                    }}>
                      {MONTH_NAMES[m - 1]}
                    </span>
                    {count > 0 && (
                      <span style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: isSelected ? corPrimaria : T.fog,
                        fontWeight: 500,
                      }}>
                        {count} aniv.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Birthday list */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: T.slate, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
              Aniversariantes · {MONTH_NAMES[selectedMonth - 1]}
            </div>

            {loading ? (
              <div style={{ fontFamily: MONO, fontSize: 11, color: T.slate, padding: "20px 0" }}>
                Carregando...
              </div>
            ) : monthBirthdays.length === 0 ? (
              <div style={{
                padding: "32px 20px", textAlign: "center",
                background: T.carbon, borderRadius: 12,
                border: `1px solid ${T.stone}`,
              }}>
                <div style={{ fontFamily: SANS, fontSize: 14, color: T.fog, marginBottom: 6 }}>
                  Nenhum aniversariante em {MONTH_NAMES[selectedMonth - 1]}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: T.slate }}>
                  Adicione a data de nascimento dos corretores em seus cadastros
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {monthBirthdays.map(({ broker, day, isToday, isPast }) => {
                  const isSent = sent.has(broker.id);
                  const phoneClean = formatPhone(broker.phone);
                  const firstName = broker.name.split(" ")[0];
                  const msgText = birthdayMsgTemplate
                    ? birthdayMsgTemplate
                        .replace(/\{\{NOME\}\}/g, firstName)
                        .replace(/\{\{MES\}\}/g, MONTH_NAMES[selectedMonth - 1])
                        .replace(/\{\{EMPREENDIMENTO\}\}/g, branding?.devName ?? "")
                    : `Olá ${firstName}! 🎂 Feliz aniversário! Desejamos um dia maravilhoso e um ano repleto de conquistas. — ${branding?.devName ?? ""}`;
                  const waText = encodeURIComponent(msgText);
                  return (
                    <div
                      key={broker.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: isToday ? `${corPrimaria}08` : T.carbon,
                        border: isToday
                          ? `1px solid ${corPrimaria}40`
                          : `1px solid ${T.stone}`,
                        borderLeft: isToday ? `3px solid ${corPrimaria}` : `1px solid ${T.stone}`,
                        opacity: isPast ? 0.5 : 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        transition: "opacity 150ms ease",
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: `${corPrimaria}20`,
                          color: corPrimaria,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: SANS, fontSize: 14, fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {broker.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: T.chalk }}>
                              {broker.name}
                            </span>
                            {broker.brokerage_name && (
                              <span style={{ fontFamily: MONO, fontSize: 9, color: T.slate }}>· {broker.brokerage_name}</span>
                            )}
                            <span style={{ fontFamily: MONO, fontSize: 9, color: T.fog }}>
                              {day.toString().padStart(2, "0")}/{selectedMonth.toString().padStart(2, "0")}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                            {isToday && (
                              <span style={{
                                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                                color: corPrimaria, background: `${corPrimaria}20`,
                                padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
                              }}>
                                HOJE
                              </span>
                            )}
                            {isSent && (
                              <span style={{
                                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                                color: "#5B8C51", background: "#5B8C5120",
                                padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
                              }}>
                                ENVIADO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action row */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {phoneClean && (
                          <a
                            href={`https://wa.me/55${phoneClean}?text=${waText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "6px 12px", borderRadius: 6,
                              background: "#25D36620", border: "1px solid #25D36640",
                              color: "#25D366",
                              fontFamily: SANS, fontSize: 12, fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </a>
                        )}

                        <button
                          onClick={() => setBannerBroker(broker)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6,
                            background: `${corPrimaria}15`, border: `1px solid ${corPrimaria}40`,
                            color: corPrimaria,
                            fontFamily: SANS, fontSize: 12, fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                          Gerar Banner
                        </button>

                        <button
                          onClick={() => {
                            toggleSent(broker.id);
                            if (!sent.has(broker.id)) setToast(`Marcado como enviado para ${broker.name.split(" ")[0]}!`);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6,
                            background: isSent ? "#5B8C5120" : "transparent",
                            border: isSent ? "1px solid #5B8C5140" : `1px solid ${T.stone}`,
                            color: isSent ? "#5B8C51" : T.fog,
                            fontFamily: SANS, fontSize: 12, fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                          }}
                        >
                          {isSent ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                          )}
                          {isSent ? "Enviado" : "Marcar enviado"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Reconhecimentos ── */}
      {tab === "reconhecimentos" && accountId && (
        <ReconhecimentosTab
          accountId={accountId}
          corPrimaria={corPrimaria}
          accountLogo={branding?.accountLogoLight || branding?.accountLogo || null}
          accountName={branding?.accountName ?? ""}
          footerText={branding?.footerText ?? ""}
          customTemplates={customRecTemplates}
        />
      )}

      {/* ── Tab: Comunicados ── */}
      {tab === "comunicados" && (
        <ComunicadosTab
          accountId={accountId ?? ""}
          accountLogo={branding?.accountLogoLight || branding?.accountLogo || null}
          devLogo={branding?.devLogoLight || branding?.devLogo || null}
          accountName={branding?.accountName ?? ""}
          devName={branding?.devName ?? development?.developmentName ?? ""}
          footerText={branding?.footerText ?? ""}
          corPrimaria={corPrimaria}
          customTemplates={customAnnounceTemplates}
        />
      )}

      {/* ── Tab: Planejamento ── */}
      {tab === "planejamento" && accountId && developmentId && (
        <PlanejamentoTab
          accountId={accountId}
          developmentId={developmentId}
          userId={user?.id ?? ""}
          userRole={account?.role ?? ""}
          devName={branding?.devName ?? development?.developmentName ?? ""}
          corPrimaria={corPrimaria}
        />
      )}

      {/* ── Tab: Configurações ── */}
      {tab === "configuracoes" && isManager && accountId && (
        <ConfiguracoesTab
          accountId={accountId}
          developmentId={developmentId}
          userId={user?.id ?? null}
          corPrimaria={corPrimaria}
          devName={branding?.devName ?? ""}
        />
      )}

      {/* Banner modal */}
      {bannerBroker && branding && (
        <BirthdayBannerModal
          isOpen={!!bannerBroker}
          onClose={() => setBannerBroker(null)}
          name={bannerBroker.name}
          brokerage={bannerBroker.brokerage_name}
          accountLogo={branding.accountLogoLight || branding.accountLogo}
          devLogo={branding.devLogoLight || branding.devLogo}
          devName={branding.devName}
          accountName={branding.accountName}
          corPrimaria={branding.corPrimaria}
          corSecundaria={branding.corSecundaria}
          city={branding.city}
          state={branding.state}
          footerText={branding.footerText}
          customTemplates={customBannerTemplates}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
