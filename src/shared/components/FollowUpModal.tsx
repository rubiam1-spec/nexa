import { useState } from "react";
import { NexaModal } from "../ui/NexaModal";
import { formatWeekdayShortBRT } from "../utils/dateUtils";
import { useIsMobile } from "../hooks/useIsMobile";

interface FollowUpModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onConfirm: (date: Date | null) => void;
  onCancel: () => void;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return formatWeekdayShortBRT(d);
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function FollowUpModal({ open, title, subtitle, onConfirm, onCancel }: FollowUpModalProps) {
  const [selected, setSelected] = useState<"1" | "3" | "7" | "custom" | "none">("1");
  const [customDate, setCustomDate] = useState(toInputDate(addDays(2)));
  const [noFollowUp, setNoFollowUp] = useState(false);
  const mobile = useIsMobile();

  if (!open) return null;

  const picks = [
    { key: "1" as const, label: "Amanhã", sub: formatDate(addDays(1)) },
    { key: "3" as const, label: "Em 3 dias", sub: formatDate(addDays(3)) },
    { key: "7" as const, label: "1 semana", sub: formatDate(addDays(7)) },
  ];

  function handleConfirm() {
    if (noFollowUp) { onConfirm(null); return; }
    if (selected === "custom") { onConfirm(new Date(customDate + "T09:00:00")); return; }
    const days = selected === "1" ? 1 : selected === "3" ? 3 : 7;
    onConfirm(addDays(days));
  }

  return (
    <NexaModal onClose={onCancel} ariaLabel={title ?? "Quando deseja retomar?"}>
      <div style={mobile
        ? { position: "fixed", inset: 0, overflowY: "auto", display: "flex", flexDirection: "column" }
        : { width: 420, maxWidth: "95vw" }
      }>
        <div style={{ background: "var(--surface-raised)", border: mobile ? "none" : "1px solid var(--border-default)", borderRadius: mobile ? 0 : 16, overflow: "hidden", boxShadow: mobile ? "none" : "0 24px 64px rgba(0,0,0,0.5)", minHeight: mobile ? "100vh" : "auto", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>{title ?? "Quando deseja retomar?"}</div>
                {subtitle ? <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 3, fontFamily: "var(--font-mono)" }}>{subtitle}</div> : null}
              </div>
              <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", fontSize: 20, padding: "4px 8px", lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 24, flex: 1 }}>
            {/* Quick picks */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {picks.map((p) => (
                <button key={p.key} type="button" onClick={() => { setSelected(p.key); setNoFollowUp(false); }}
                  style={{
                    padding: "14px 12px", borderRadius: 10, border: selected === p.key && !noFollowUp ? "2px solid #4ADE80" : "1px solid var(--border-default)",
                    background: selected === p.key && !noFollowUp ? "rgba(74,222,128,0.08)" : "var(--surface-base)",
                    cursor: "pointer", textAlign: "center",
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: selected === p.key && !noFollowUp ? "#4ADE80" : "var(--text-secondary)" }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 3, fontFamily: "var(--font-mono)" }}>{p.sub}</div>
                </button>
              ))}
            </div>

            {/* Custom date */}
            <div style={{ marginBottom: 20 }}>
              <button type="button" onClick={() => { setSelected("custom"); setNoFollowUp(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: selected === "custom" && !noFollowUp ? "2px solid #4ADE80" : "1px solid var(--border-default)",
                  background: selected === "custom" && !noFollowUp ? "rgba(74,222,128,0.08)" : "var(--surface-base)",
                  cursor: "pointer", textAlign: "left",
                }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>Personalizado:</span>
                <input type="date" value={customDate} min={toInputDate(addDays(1))}
                  onChange={(e) => { setCustomDate(e.target.value); setSelected("custom"); setNoFollowUp(false); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flex: 1, background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 14, fontFamily: "var(--font-mono)", outline: "none", padding: 0, minHeight: "auto" }} />
              </button>
            </div>

            {/* No follow-up */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: noFollowUp ? "2px solid var(--text-disabled)" : "1px solid var(--border-default)", background: noFollowUp ? "rgba(92,86,71,0.1)" : "transparent", cursor: "pointer" }}>
              <input type="checkbox" checked={noFollowUp} onChange={(e) => setNoFollowUp(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--text-muted)", minHeight: "auto" }} />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Sem follow-up</span>
            </label>
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            <button type="button" onClick={handleConfirm} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: "#4ADE80", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {noFollowUp ? "Salvar sem follow-up" : "Salvar e agendar"}
            </button>
          </div>
        </div>
      </div>
    </NexaModal>
  );
}
