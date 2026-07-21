// DS v4 — Modais de ação de lead COMPARTILHADOS (tela /leads + colunas do Kanban).
// Atribuir usa o NexaEntityPicker (comportamento aprovado). Zero lógica de dados.
import { useMemo, useState } from "react";
import type { LeadView } from "./useLeads";
import {
  buildPickerModel,
  pendingBrokersLabel,
  type AssignableMember,
  type BrokerageDirectoryEntry,
  type PendingBrokersSummary,
} from "./assignmentGrouping";
import { NexaEntityPicker } from "../../shared/ui/NexaEntityPicker";
import { NexaModal } from "../../shared/ui/NexaModal";

export function AssignModal({ lead, members, brokerageDirectory = [], pendingBrokers, onClose, onPick, onInvite }: {
  lead: LeadView;
  members: AssignableMember[];
  brokerageDirectory?: BrokerageDirectoryEntry[];
  pendingBrokers?: PendingBrokersSummary;
  onClose: () => void;
  onPick: (id: string, name: string) => void;
  onInvite?: () => void;
}) {
  const model = useMemo(() => buildPickerModel(members, brokerageDirectory), [members, brokerageDirectory]);
  const pendingLabel = pendingBrokers ? pendingBrokersLabel(pendingBrokers) : null;

  return (
    <NexaModal onClose={onClose} ariaLabel="Atribuir lead">
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, height: "84vh", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 2px" }}>Atribuir lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name} · a carga (leads ativos) ajuda a distribuir com justiça</div>

        <NexaEntityPicker model={model} onPick={onPick} pendingLabel={pendingLabel} onInvite={onInvite} autoFocus />

        <button type="button" onClick={onClose} style={{ marginTop: 12, width: "100%", minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Cancelar</button>
      </div>
    </NexaModal>
  );
}

export function DiscardModal({ lead, onClose, onConfirm }: { lead: LeadView; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <NexaModal onClose={onClose} ariaLabel="Descartar lead">
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>Descartar lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name} · o motivo fica na trilha do contato</div>
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo do descarte (obrigatório)" rows={3}
          style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button type="button" disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "none", background: reason.trim() ? "#F87171" : "rgba(248,113,113,0.3)", color: "#0F0E0C", fontSize: 13, fontWeight: 700, cursor: reason.trim() ? "pointer" : "default" }}>Descartar</button>
        </div>
      </div>
    </NexaModal>
  );
}
