import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import NexaBadge from "../../../shared/components/NexaBadge";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { timeAgo } from "../../../shared/utils/timeAgo";

interface ClientData {
  id: string; name: string; email: string | null; phone: string | null; cpf: string | null;
  city: string | null; profession: string | null; marital_status: string | null;
  observations: string | null; temperature: string | null; last_interaction_at: string | null;
  created_at: string;
}

interface ClientNegotiation {
  id: string; status: string; score: number | null; created_at: string; updated_at: string;
  unit_quadra: string | null; unit_lote: string | null; unit_valor: number | null;
  broker_name: string | null;
}

interface ClientActivity {
  id: string; type: string; title: string; status: string; activity_date: string;
  start_time: string | null; outcome: string | null; contact_name: string | null;
  duration_minutes: number;
}

interface ClientSimulation {
  id: string; valor_total: number; entrada_percentual: number; parcelas_quantidade: number;
  created_at: string; status: string; unit_quadra: string | null; unit_lote: string | null;
}

const T = {
  ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)",
  chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)",
  slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA",
  red: "#F87171", amber: "#FBBF24", purple: "#A78BFA",
};

const TEMP_COLORS: Record<string, string> = { hot: "#F87171", warm: "#FBBF24", cold: "#60A5FA" };
const TEMP_LABELS: Record<string, string> = { hot: "Quente", warm: "Morna", cold: "Fria" };
const TYPE_LABELS: Record<string, string> = { visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.", training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro" };

function fmtBRL(v: number | null) { return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"; }

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useAccount();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;

  const [client, setClient] = useState<ClientData | null>(null);
  const [negotiations, setNegotiations] = useState<ClientNegotiation[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [simulations, setSimulations] = useState<ClientSimulation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Client data
      const { data: cl } = await supabase.from("clients").select("*").eq("id", id).single();
      setClient(cl as ClientData | null);

      // Negotiations
      const { data: negs } = await supabase.from("negotiations").select("id, status, score, created_at, updated_at, units(quadra, lote, valor), brokers(name)").eq("client_id", id).eq("account_id", accountId).order("created_at", { ascending: false });
      setNegotiations((negs ?? []).map((n: Record<string, unknown>) => {
        const u = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null;
        const b = (Array.isArray(n.brokers) ? n.brokers[0] : n.brokers) as Record<string, unknown> | null;
        return { id: n.id as string, status: n.status as string, score: n.score as number | null, created_at: n.created_at as string, updated_at: n.updated_at as string, unit_quadra: u?.quadra as string | null, unit_lote: u?.lote as string | null, unit_valor: u?.valor as number | null, broker_name: b?.name as string | null };
      }));

      // Activities
      const { data: acts } = await supabase.from("activities").select("id, type, title, status, activity_date, start_time, outcome, contact_name, duration_minutes").eq("client_id", id).eq("account_id", accountId).order("activity_date", { ascending: false }).limit(20);
      setActivities((acts ?? []) as ClientActivity[]);

      // Simulations
      const { data: sims } = await supabase.from("pipeline_simulations").select("id, valor_total, entrada_percentual, parcelas_quantidade, created_at, status, units(quadra, lote)").eq("client_id", id).eq("account_id", accountId).order("created_at", { ascending: false }).limit(10);
      setSimulations((sims ?? []).map((s: Record<string, unknown>) => {
        const u = (Array.isArray(s.units) ? s.units[0] : s.units) as Record<string, unknown> | null;
        return { id: s.id as string, valor_total: s.valor_total as number, entrada_percentual: s.entrada_percentual as number, parcelas_quantidade: s.parcelas_quantidade as number, created_at: s.created_at as string, status: s.status as string, unit_quadra: u?.quadra as string | null, unit_lote: u?.lote as string | null };
      }));
    } catch (err) { console.error("ClientDetail load error:", err); }
    finally { setLoading(false); }
  }, [id, accountId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div style={{ padding: 32 }}><div style={{ fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div></div>;
  if (!client) return <div style={{ padding: 32 }}><div style={{ fontSize: 14, color: T.red }}>Cliente não encontrado.</div><button type="button" onClick={() => navigate("/clientes")} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← Voltar</button></div>;

  const tempColor = TEMP_COLORS[client.temperature ?? "warm"] ?? T.amber;
  const tempLabel = TEMP_LABELS[client.temperature ?? "warm"] ?? "—";
  void 0; // activeNegs removed

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button type="button" onClick={() => navigate("/clientes")} style={{ background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 8 }}>← Clientes</button>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.chalk, margin: 0 }}>{client.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 6, background: tempColor + "15", color: tempColor }}>{tempLabel}</span>
            {client.last_interaction_at && <span style={{ fontSize: 11, color: T.slate, fontFamily: "var(--font-mono)" }}>Último contato: {timeAgo(client.last_interaction_at)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => navigate(`/simulador?clientId=${client.id}`)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Simular</button>
          <button type="button" onClick={() => navigate("/atividades")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Atividade</button>
        </div>
      </div>

      {/* Contact info */}
      <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: isMobile ? 16 : 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>DADOS DO CLIENTE</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
          {[
            ["Telefone", client.phone || "—"],
            ["E-mail", client.email || "—"],
            ["CPF", client.cpf || "—"],
            ["Cidade", client.city || "—"],
            ["Profissão", client.profession || "—"],
            ["Estado civil", client.marital_status || "—"],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: T.slate, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, color: T.bone }}>{v}</div>
            </div>
          ))}
        </div>
        {client.observations && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.stone}`, fontSize: 13, color: T.fog }}>{client.observations}</div>}
      </div>

      {/* Negotiations */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        NEGOCIAÇÕES
        {negotiations.length > 0 && <span style={{ background: T.carbon, borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: T.fog }}>{negotiations.length}</span>}
      </div>
      {negotiations.length === 0 ? (
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "20px 16px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: T.fog }}>Nenhuma negociação com este cliente.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {negotiations.map((n) => (
            <Link key={n.id} to={`/negociacoes/${n.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, textDecoration: "none", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.bone }}>Q{n.unit_quadra} · L{n.unit_lote} — {fmtBRL(n.unit_valor)}</div>
                <div style={{ fontSize: 11, color: T.fog, marginTop: 2 }}>{n.broker_name || "—"} · {timeAgo(n.updated_at)}</div>
              </div>
              {n.score != null && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, fontFamily: "var(--font-mono)", background: (n.score > 70 ? "#4ADE80" : n.score >= 40 ? "#FBBF24" : "#F87171") + "15", color: n.score > 70 ? "#4ADE80" : n.score >= 40 ? "#FBBF24" : "#F87171" }}>{n.score}</span>}
              <NexaBadge entity="negotiation" status={n.status.toUpperCase() as never} label={getNegotiationStatusLabel(n.status.toUpperCase() as never)} />
            </Link>
          ))}
        </div>
      )}

      {/* Activities */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        ATIVIDADES RECENTES
        {activities.length > 0 && <span style={{ background: T.carbon, borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: T.fog }}>{activities.length}</span>}
      </div>
      {activities.length === 0 ? (
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "20px 16px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: T.fog }}>Nenhuma atividade registrada.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
          {activities.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", minWidth: 55, flexShrink: 0 }}>{new Date(a.activity_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: T.sprout + "15", color: T.sprout, whiteSpace: "nowrap" }}>{TYPE_LABELS[a.type] || a.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                {a.outcome && <div style={{ fontSize: 11, color: T.fog, marginTop: 1 }}>{a.outcome}</div>}
              </div>
              {a.duration_minutes > 0 && <span style={{ fontSize: 10, color: T.slate }}>{a.duration_minutes}min</span>}
            </div>
          ))}
        </div>
      )}

      {/* Simulations */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        SIMULAÇÕES
        {simulations.length > 0 && <span style={{ background: T.carbon, borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: T.fog }}>{simulations.length}</span>}
      </div>
      {simulations.length === 0 ? (
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "20px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.fog }}>Nenhuma simulação salva.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {simulations.map((s) => (
            <Link key={s.id} to={`/simulador?simulationId=${s.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, textDecoration: "none" }}>
              <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", minWidth: 55 }}>{new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.bone }}>{s.unit_quadra && s.unit_lote ? `Q${s.unit_quadra} · L${s.unit_lote}` : "—"} — {fmtBRL(s.valor_total)}</div>
                <div style={{ fontSize: 11, color: T.fog }}>Entrada {s.entrada_percentual}% · {s.parcelas_quantidade}× parcelas</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Footer info */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.stone}`, fontSize: 11, color: T.slate }}>
        Cliente cadastrado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
      </div>
    </div>
  );
}
