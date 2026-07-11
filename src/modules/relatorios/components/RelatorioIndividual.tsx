// Relatório Individual — recorte por PESSOA (atividades + negócios).
// Componente só renderiza: toda regra/agregação vem de useRelatorioIndividual e
// todo acesso a dados de relatorioIndividualSupabaseRepository.
// Comportamento por perfil:
//   - commercial_consultant: trava no próprio profile (sem seletor).
//   - manager/director/owner: seletor de membro (default = o próprio, se elegível).
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useRelatorioIndividual } from "../hooks/useRelatorioIndividual";
import {
  fetchMembrosElegiveis,
  type MembroElegivel,
} from "../repositories/relatorioIndividualSupabaseRepository";
import { gerarPdfRelatorioIndividual } from "../utils/gerarPdfRelatorio";
import { NexaSelect } from "../../../shared/ui/NexaSelect";

const T = {
  ink: "var(--surface-base)",
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  sprout: "var(--interactive-primary)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  blue: "#60A5FA",
  purple: "#A78BFA",
  amber: "#FBBF24",
  red: "#F87171",
};
const MONO = "var(--font-mono)";
const V7_BG = "linear-gradient(168deg, rgba(34,33,28,0.5) 0%, rgba(18,17,14,0.15) 100%)";
const V7_BORDER = "1px solid rgba(61,58,48,0.08)";

const ROLE_LABELS: Record<string, string> = {
  manager: "Gestor",
  commercial_consultant: "Consultora",
  broker: "Corretor",
  director: "Diretor",
  owner: "Diretor",
};

function Kpi({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c = color || "#FAF9F6";
  return (
    <div style={{ background: V7_BG, borderRadius: 12, padding: "16px 18px", border: V7_BORDER, borderLeft: `3px solid ${c}60`, flex: 1, minWidth: 100, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: -12, right: -12, width: 50, height: 50, borderRadius: "50%", background: c, opacity: 0.06, filter: "blur(18px)", pointerEvents: "none" }} />
      <div style={{ fontSize: 8, color: "#5C5647", textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c === "#FAF9F6" ? "#FAF9F6" : c, marginTop: 8, overflowWrap: "break-word", fontFamily: MONO }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#5C5647", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Sec({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, fontFamily: MONO, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12, marginTop: 28, fontWeight: 600 }}>{children}</div>;
}

// Barras horizontais — mesmo estilo da "Distribuição por tipo" da página.
function Bars({ items, color }: { items: { label: string; count: number }[]; color: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: T.fog, width: 110, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
          <div style={{ flex: 1, height: 8, background: T.stone, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(it.count / max) * 100}%`, background: color, borderRadius: 4, minWidth: it.count > 0 ? 8 : 0, transition: "width 0.4s" }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: T.chalk, width: 36, textAlign: "right" }}>{it.count}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  fromDate: string;
  toDate: string;
  fromISO: string;
  toISO: string;
  periodoLabel: string;
  filter: React.ReactNode;
  back: React.ReactNode;
  isMobile: boolean;
}

export default function RelatorioIndividual({ fromDate, toDate, fromISO, toISO, periodoLabel, filter, back, isMobile }: Props) {
  const { account, isConsultant } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const selfId = authenticatedProfile?.id ?? null;

  const [members, setMembers] = useState<MembroElegivel[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfing, setPdfing] = useState(false);

  // Consultor: trava no próprio profile, sem buscar lista.
  // Demais: carrega elegíveis (conta ativa) e default = o próprio, se na lista.
  useEffect(() => {
    let cancelled = false;
    if (isConsultant) {
      setSelectedId(selfId);
      return;
    }
    if (!accountId) return;
    setMembersLoading(true);
    setMembersError(false);
    fetchMembrosElegiveis({ accountId })
      .then((list) => {
        if (cancelled) return;
        setMembers(list);
        setSelectedId((prev) => {
          if (prev && list.some((m) => m.id === prev)) return prev;
          if (selfId && list.some((m) => m.id === selfId)) return selfId;
          return list[0]?.id ?? null;
        });
        setMembersLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[RelatorioIndividual] membros error", err);
        setMembersError(true);
        setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isConsultant, accountId, selfId]);

  const membroNome = useMemo(() => {
    if (isConsultant) return authenticatedProfile?.fullName ?? "—";
    return members.find((m) => m.id === selectedId)?.name ?? "—";
  }, [isConsultant, authenticatedProfile, members, selectedId]);

  const { data, loading, error } = useRelatorioIndividual({
    accountId,
    developmentId,
    profileId: selectedId,
    membroNome,
    empreendimentoNome: development?.developmentName ?? "",
    periodoLabel,
    fromDate,
    toDate,
    fromISO,
    toISO,
    enabled: Boolean(selectedId),
  });

  async function handlePdf() {
    if (!data) return;
    setPdfing(true);
    try {
      await gerarPdfRelatorioIndividual(
        {
          membroNome: data.meta.membroNome,
          period: periodoLabel,
          contaNome: account?.accountName ?? "NEXA",
          empreendimentoNome: development?.developmentName ?? "",
        },
        { atividades: data.atividades, negocios: data.negocios },
      );
    } finally {
      setPdfing(false);
    }
  }

  const cols = isMobile ? 2 : 4;
  const selectedRole = isConsultant
    ? "commercial_consultant"
    : members.find((m) => m.id === selectedId)?.role ?? null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {back}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: T.chalk, margin: 0 }}>Relatório Individual</h1>
          <p style={{ fontSize: 13, color: T.fog, margin: "4px 0 0" }}>
            {membroNome}{selectedRole ? ` · ${ROLE_LABELS[selectedRole] ?? selectedRole}` : ""} · {development?.developmentName} · {periodoLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filter}
          <button type="button" disabled={pdfing || !data} onClick={handlePdf} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: T.ink, fontSize: 13, fontWeight: 600, cursor: pdfing || !data ? "not-allowed" : "pointer", opacity: pdfing || !data ? 0.6 : 1, minHeight: 44 }}>
            {pdfing ? "Gerando..." : "Gerar PDF"}
          </button>
        </div>
      </div>

      {/* Seletor de membro — apenas para quem vê a equipe */}
      {!isConsultant && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label htmlFor="ri-membro" style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.12em", textTransform: "uppercase" }}>Membro</label>
          {membersError ? (
            <span style={{ fontSize: 13, color: T.red }}>Falha ao carregar membros.</span>
          ) : (
            <div style={{ minWidth: 220, maxWidth: "100%" }}>
              <NexaSelect
                id="ri-membro"
                value={selectedId ?? ""}
                onChange={(v) => setSelectedId(v || null)}
                options={members.map((m) => ({ value: m.id, label: `${m.name} · ${ROLE_LABELS[m.role] ?? m.role}` }))}
                placeholder="Selecionar membro..."
                emptyLabel="Nenhum membro elegível"
                loading={membersLoading}
                disabled={membersLoading || members.length === 0}
                ariaLabel="Membro"
              />
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ color: T.fog, fontFamily: MONO, fontSize: 13, padding: 20 }}>Carregando dados...</p>}
      {error && !loading && <p style={{ color: T.red, fontSize: 13, padding: 20 }}>Erro ao carregar o relatório. Tente novamente.</p>}

      {!loading && !error && data && (
        <>
          {/* ── Atividades ── */}
          <Sec>Atividades</Sec>
          {data.atividades.total === 0 ? (
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: T.fog }}>Sem atividades no período</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12, marginBottom: 16 }}>
                <Kpi label="Atividades" value={data.atividades.total} sub="no período" color="#4ADE80" />
                <Kpi label="Concluídas" value={data.atividades.concluidas} color="#60A5FA" />
                <Kpi label="Taxa" value={`${data.atividades.taxaConclusao}%`} sub="conclusão" color="#A78BFA" />
                <Kpi label="Pendentes" value={data.atividades.pendentes} color="#FBBF24" />
              </div>
              {data.atividades.porTipo.length > 0 && (
                <>
                  <Sec>Distribuição por tipo</Sec>
                  <Bars items={data.atividades.porTipo.map((t) => ({ label: t.label, count: t.count }))} color={T.sprout} />
                </>
              )}
              {data.atividades.porSemana.length > 0 && (
                <>
                  <Sec>Evolução semanal</Sec>
                  <Bars items={data.atividades.porSemana.map((s) => ({ label: s.semana, count: s.count }))} color={T.blue} />
                </>
              )}
            </>
          )}

          {/* ── Negócios ── */}
          <Sec>Negócios</Sec>
          {data.negocios.total === 0 ? (
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: T.fog }}>
              Sem negócios no período
              {data.negocios.semDono > 0 && (
                <div style={{ fontSize: 12, color: T.slate, marginTop: 8 }}>{data.negocios.semDono} negociações sem responsável atribuído não foram contabilizadas.</div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobile ? 2 : 5}, minmax(0, 1fr))`, gap: 12, marginBottom: 16 }}>
                <Kpi label="Ativas" value={data.negocios.ativas} color="#60A5FA" />
                <Kpi label="Propostas" value={data.negocios.propostas} color="#A78BFA" />
                <Kpi label="Reservas" value={data.negocios.reservas} color="#D97706" />
                <Kpi label="Vendas" value={data.negocios.vendas} color="#4ADE80" />
                <Kpi label="Conversão" value={`${data.negocios.conversao}%`} color="#FBBF24" />
              </div>
              <Sec>Funil pessoal por status</Sec>
              <Bars items={data.negocios.porStatus.map((s) => ({ label: s.label, count: s.count }))} color={T.purple} />
              {data.negocios.semDono > 0 && (
                <div style={{ fontSize: 12, color: T.fog, marginTop: 12, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
                  {data.negocios.semDono} negociações sem responsável atribuído não foram contabilizadas.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
