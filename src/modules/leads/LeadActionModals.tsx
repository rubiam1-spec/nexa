// L1.8 — Modais de ação de lead COMPARTILHADOS (tela /leads + colunas do Kanban).
// Atribuir (2 grupos + imobiliária + carga) e Descartar. Zero lógica de dados.
import { useMemo, useState } from "react";
import type { LeadView } from "./useLeads";
import {
  groupAssignableMembers,
  brokerageSelectOptions,
  pendingBrokersLabel,
  type AssignableMember,
  type BrokerageDirectoryEntry,
  type PendingBrokersSummary,
} from "./assignmentGrouping";
import { NexaSelect } from "../../shared/ui/NexaSelect";

const MONO = "var(--font-mono)";

const ROLE_LABEL: Record<string, string> = {
  manager: "Gestor(a)", commercial_consultant: "Consultor(a)", broker: "Corretor(a)",
  director: "Diretor(a)", concierge: "Concierge", administrative: "Administrativo",
};

function LoadBadge({ n }: { n: number }) {
  const strong = n >= 8;
  return (
    <span title="Leads ativos já atribuídos" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: n === 0 ? "var(--color-slate)" : strong ? "#F87171" : "#E8B45A", background: n === 0 ? "transparent" : strong ? "rgba(248,113,113,0.12)" : "rgba(232,180,90,0.12)", padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>
      {n} ativo{n === 1 ? "" : "s"}
    </span>
  );
}

function MemberRow({ m, subtitle, onPick }: { m: AssignableMember; subtitle: string; onPick: (id: string, name: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(m.id, m.name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", color: "var(--text-primary)", fontSize: 13 }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-slate)" }}>{subtitle}</span>
      </span>
      <LoadBadge n={m.activeLeads} />
    </button>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog)", margin: "12px 2px 6px" }}>{children}</div>;
}

export function AssignModal({ lead, members, brokerageDirectory = [], pendingBrokers, onClose, onPick, onInvite }: {
  lead: LeadView;
  members: AssignableMember[];
  brokerageDirectory?: BrokerageDirectoryEntry[];
  pendingBrokers?: PendingBrokersSummary;
  onClose: () => void;
  onPick: (id: string, name: string) => void;
  onInvite?: () => void;
}) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [brokerageFilter, setBrokerageFilter] = useState<string | null>(null); // null = Todas
  const query = q.trim().toLowerCase();

  const grouped = useMemo(() => groupAssignableMembers(members, showAll), [members, showAll]);
  // L1.9 — o seletor lista TODAS as imobiliárias; as sem corretor ativo vêm
  // desabilitadas e rotuladas "· sem corretores ativos". Só muda visibilidade.
  const brokerageOpts = useMemo(() => brokerageSelectOptions(grouped, brokerageDirectory), [grouped, brokerageDirectory]);
  const pendingLabel = pendingBrokers ? pendingBrokersLabel(pendingBrokers) : null;

  const searchHits = useMemo(
    () => (query ? members.filter((m) => m.name.toLowerCase().includes(query)) : []),
    [members, query],
  );

  const visibleBrokerages = grouped.brokerages.filter(
    (g) => brokerageFilter === null || (g.brokerageId ?? "__independentes__") === brokerageFilter,
  );

  const SUB_INTERNAL = (m: AssignableMember) => ROLE_LABEL[m.role] ?? m.role;
  const SUB_BROKER = (m: AssignableMember) => m.brokerageName ?? "Independente";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "84vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 2px" }}>Atribuir lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name} · a carga (leads ativos) ajuda a distribuir com justiça</div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome (varre todos)..." style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />

        <div style={{ overflowY: "auto", marginTop: 4, flex: 1 }}>
          {query ? (
            <>
              <GroupTitle>Resultados</GroupTitle>
              {searchHits.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Nenhum membro.</div> :
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {searchHits.map((m) => <MemberRow key={m.id} m={m} subtitle={m.role === "broker" ? SUB_BROKER(m) : SUB_INTERNAL(m)} onPick={onPick} />)}
                </div>}
            </>
          ) : (
            <>
              <GroupTitle>Equipe interna</GroupTitle>
              {grouped.internal.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Ninguém elegível.</div> :
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {grouped.internal.map((m) => <MemberRow key={m.id} m={m} subtitle={SUB_INTERNAL(m)} onPick={onPick} />)}
                </div>}
              {grouped.hiddenCount > 0 && (
                <button type="button" onClick={() => setShowAll(true)} style={{ background: "none", border: "none", color: "var(--color-sprout)", fontSize: 11, cursor: "pointer", padding: "6px 2px" }}>
                  mostrar todos os papéis (+{grouped.hiddenCount})
                </button>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "12px 2px 6px" }}>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog)" }}>Corretores</span>
                {brokerageOpts.length > 1 && (
                  <div style={{ width: 200, flexShrink: 0 }}>
                    <NexaSelect
                      ariaLabel="Filtrar por imobiliária"
                      value={brokerageFilter ?? ""}
                      onChange={(v) => setBrokerageFilter(v || null)}
                      options={brokerageOpts.map((o) => ({ value: o.id ?? "", label: o.label, hint: o.hint, disabled: o.disabled }))}
                    />
                  </div>
                )}
              </div>
              {grouped.brokerages.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Nenhum corretor com acesso.</div> :
                visibleBrokerages.map((g) => (
                  <div key={g.brokerageId ?? "indep"} style={{ marginBottom: 6 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-slate)", margin: "4px 2px" }}>{g.brokerageName}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {g.brokers.map((m) => <MemberRow key={m.id} m={m} subtitle={SUB_BROKER(m)} onPick={onPick} />)}
                    </div>
                  </div>
                ))}

              {/* L1.9 — Rodapé que explica o "vazio": o sistema está certo (só
                  corretor com acesso é elegível); aqui contamos os cadastrados
                  ainda sem acesso e oferecemos o convite (superfície existente). */}
              {pendingLabel && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "10px 2px 2px", padding: "8px 10px", background: "var(--surface-base)", border: "1px dashed var(--border-default)", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-fog)", flex: 1, minWidth: 0 }}>{pendingLabel}</span>
                  {onInvite && (
                    <button type="button" onClick={onInvite} style={{ background: "none", border: "none", color: "var(--color-sprout)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
                      Convidar corretores →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <button type="button" onClick={onClose} style={{ marginTop: 12, width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Cancelar</button>
      </div>
    </div>
  );
}

export function DiscardModal({ lead, onClose, onConfirm }: { lead: LeadView; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>Descartar lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name} · o motivo fica na trilha do contato</div>
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo do descarte (obrigatório)" rows={3}
          style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button type="button" disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: reason.trim() ? "#F87171" : "rgba(248,113,113,0.3)", color: "#0F0E0C", fontSize: 13, fontWeight: 700, cursor: reason.trim() ? "pointer" : "default" }}>Descartar</button>
        </div>
      </div>
    </div>
  );
}
