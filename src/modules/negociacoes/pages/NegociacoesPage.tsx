import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useNegotiationsBoard } from "../hooks/useNegotiationsBoard";
import KanbanPage from "./KanbanPage";
import NegotiationsListPage from "./NegotiationsPage";
import { FunnelView } from "./FunnelView";

// Módulo unificado "Negociações" — Funil/Kanban/Lista sobre a MESMA fonte de
// verdade (useNegotiationsBoard). Rota única (/pipeline redireciona para cá).
// Visão default = Kanban; última visão escolhida é lembrada (localStorage).
type ViewKey = "funil" | "kanban" | "lista";
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "funil", label: "Funil" },
  { key: "kanban", label: "Kanban" },
  { key: "lista", label: "Lista" },
];
const LS_KEY = "nexa:negociacoes:view";
const isView = (v: string | null): v is ViewKey => v === "funil" || v === "kanban" || v === "lista";

const MONO = "var(--font-mono)";

export default function NegociacoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewKey>(() => {
    const fromUrl = searchParams.get("view");
    if (isView(fromUrl)) return fromUrl;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(LS_KEY);
      if (isView(saved)) return saved;
    }
    return "kanban";
  });

  // Persiste e reflete na URL (deep-link estável).
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, view);
    if (searchParams.get("view") !== view) {
      const next = new URLSearchParams(searchParams);
      next.set("view", view);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div>
      {/* Alternador de visão */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border-default)", paddingBottom: 0 }}>
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <button key={v.key} type="button" onClick={() => setView(v.key)}
              style={{ padding: "9px 18px", background: "transparent", border: "none", borderBottom: active ? "2px solid var(--color-sprout)" : "2px solid transparent", color: active ? "var(--color-bone)" : "var(--color-fog)", fontFamily: MONO, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>
              {v.label}
            </button>
          );
        })}
      </div>

      {view === "kanban" ? <KanbanPage /> : null}
      {view === "lista" ? <NegotiationsListPage /> : null}
      {view === "funil" ? <FunilTab onOpenNegotiation={(id) => navigate(`/negociacoes/${id}`)} /> : null}
    </div>
  );
}

// Aba Funil — busca a MESMA fonte (board) e delega toda a lógica às funções puras.
function FunilTab({ onOpenNegotiation }: { onOpenNegotiation: (id: string) => void }) {
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { board, loading, error, thresholdDays } = useNegotiationsBoard({
    accountId: account?.accountId ?? null,
    developmentId: development?.developmentId ?? null,
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Negociações</h1>
        <p style={{ fontSize: 10.5, color: "var(--color-slate)", margin: "6px 0 0", fontFamily: MONO, letterSpacing: "0.05em" }}>
          {board.openCount} {board.openCount === 1 ? "aberta" : "abertas"} · {board.wonCount} {board.wonCount === 1 ? "venda" : "vendas"} · leitura de gestão
        </p>
      </div>
      {loading ? <div style={{ padding: 24, color: "var(--color-slate)", fontFamily: MONO, fontSize: 12 }}>Carregando…</div>
        : error ? <div style={{ padding: 24, color: "#F87171", fontSize: 14 }}>Erro: {error}</div>
        : <FunnelView board={board} thresholdDays={thresholdDays} onOpenNegotiation={onOpenNegotiation} />}
    </div>
  );
}
