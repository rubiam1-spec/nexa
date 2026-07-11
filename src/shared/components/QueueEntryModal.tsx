import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "../../app/contexts/AccountContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useDevelopment } from "../../app/contexts/DevelopmentContext";
import { useAuth } from "../../app/contexts/AuthContext";
import { supabase } from "../../infra/supabase/supabaseClient";
import { createClient } from "../../infra/repositories/clientsSupabaseRepository";
import { useUnitQueue } from "../../modules/units/hooks/useUnitQueue";
import { NexaSelect } from "../ui/NexaSelect";

const T = {
  ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)",
  sprout: "var(--interactive-primary)", chalk: "var(--text-primary)", bone: "var(--text-secondary)",
  fog: "var(--text-muted)", slate: "var(--text-disabled)", amber: "#FBBF24",
};

const IS: React.CSSProperties = { background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "11px 14px", color: T.chalk, fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, color: T.fog, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 };

interface QueueEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: { id: string; quadra: string; lote: string; valor: number; status: string };
  queuePosition: number;
  onSuccess: () => void;
}

export default function QueueEntryModal({ isOpen, onClose, unit, queuePosition, onSuccess }: QueueEntryModalProps) {
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();
  const mobile = useIsMobile();
  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const role = account?.role ?? null;
  const isBroker = role === "broker";
  const isManagerOrDirector = role === "director" || role === "manager" || (role as string) === "owner";

  const unitQueue = useUnitQueue(unit.id, accountId, developmentId);

  const [clients, setClients] = useState<{ id: string; name: string; phone: string | null; cpf: string | null }[]>([]);
  const [brokersList, setBrokersList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clients
  const loadClients = useCallback(async () => {
    if (!supabase || !accountId) return;
    let query = supabase.from("clients").select("id, name, phone, cpf").eq("account_id", accountId).eq("status", "active").order("name");
    if (isBroker && userId) query = query.eq("broker_id", userId);
    const { data } = await query;
    setClients((data ?? []) as { id: string; name: string; phone: string | null; cpf: string | null }[]);
  }, [accountId, isBroker, userId]);

  useEffect(() => { if (isOpen) loadClients(); }, [isOpen, loadClients]);

  // Load brokers (for director/manager)
  useEffect(() => {
    if (!isOpen || !isManagerOrDirector || !supabase || !accountId) return;
    supabase.from("user_account_access").select("profile_id, role, profiles:profile_id(id, name)").eq("account_id", accountId).then(({ data }) => {
      if (!data) return;
      const list: { id: string; name: string }[] = [];
      for (const row of data as Record<string, unknown>[]) {
        const r = row.role as string;
        if (r !== "broker" && r !== "commercial_consultant") continue;
        const p = row.profiles as Record<string, unknown> | null;
        if (p) list.push({ id: p.id as string, name: p.name as string });
      }
      setBrokersList(list.sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [isOpen, isManagerOrDirector, accountId]);

  const filteredClients = clientSearch ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())) : clients;

  function maskCpf(cpf: string | null) {
    if (!cpf) return "";
    const clean = cpf.replace(/\D/g, "");
    if (clean.length < 2) return "***";
    return `***.***.***-${clean.slice(-2)}`;
  }

  async function handleQuickCreate() {
    if (!accountId || !newName.trim() || !newPhone.trim()) return;
    setSavingClient(true); setError(null);
    try {
      const c = await createClient({ accountId, name: newName.trim(), phone: newPhone.trim(), cpf: newCpf.trim() || undefined, createdBy: userId ?? undefined, brokerId: isBroker ? userId ?? undefined : selectedBrokerId || undefined });
      setSelectedClientId(c.id);
      setShowQuickCreate(false); setNewName(""); setNewPhone(""); setNewCpf("");
      await loadClients();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao criar cliente"); }
    finally { setSavingClient(false); }
  }

  async function handleConfirm() {
    if (!selectedClientId || !userId) return;
    setSaving(true); setError(null);
    try {
      const brokerId = isManagerOrDirector ? (selectedBrokerId || null) : userId;
      const result = await unitQueue.enterQueue({ userId, clientId: selectedClientId, brokerId: brokerId ?? undefined });
      onSuccess();
      onClose();
      // Toast is handled by parent
      void result;
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao entrar na fila"); }
    finally { setSaving(false); }
  }

  if (!isOpen) return null;

  const statusLabel = unit.status === "reserved" || unit.status === "RESERVADO" ? "RESERVADA" : unit.status === "sold" || unit.status === "VENDIDO" ? "VENDIDA" : "INDISPONÍVEL";
  const statusColor = statusLabel === "RESERVADA" ? T.amber : T.fog;

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9000 }} onClick={onClose} />
      <div style={mobile ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: T.carbon, overflowY: "auto", zIndex: 9001, padding: 24 } : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, width: 460, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", zIndex: 9001, padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: T.chalk, fontSize: 17, fontWeight: 700, margin: 0 }}>Entrar na Fila de Espera</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>&times;</button>
        </div>

        {/* Unit card */}
        <div style={{ background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.bone }}>Q{unit.quadra} · Lote {unit.lote}</span>
            <span style={{ padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", background: `${statusColor}20`, color: statusColor }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>R$ {unit.valor.toLocaleString("pt-BR")}</div>
          <div style={{ fontSize: 13, color: T.sprout, fontWeight: 700, fontFamily: "var(--font-mono)", marginTop: 6 }}>Sua posição estimada: #{queuePosition}</div>
        </div>

        {/* Client selection */}
        <label style={LBL}>Cliente *</label>
        <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); if (selectedClientId) setSelectedClientId(""); }} style={{ ...IS, marginBottom: 0 }} onFocus={(e) => { e.currentTarget.style.borderColor = T.sprout; }} onBlur={(e) => { e.currentTarget.style.borderColor = T.stone; }} />
        {/* Client dropdown */}
        {clientSearch && !selectedClientId && (
          <div style={{ background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, maxHeight: 160, overflowY: "auto", marginTop: 4 }}>
            {filteredClients.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12, color: T.fog }}>Nenhum cliente encontrado</div>
            ) : filteredClients.slice(0, 10).map((c) => (
              <button key={c.id} type="button" onClick={() => { setSelectedClientId(c.id); setClientSearch(c.name); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${T.stone}`, cursor: "pointer", color: T.bone, fontSize: 13 }} onMouseEnter={(e) => { e.currentTarget.style.background = T.stone; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div>{c.name}</div>
                <div style={{ fontSize: 11, color: T.fog }}>{c.cpf ? maskCpf(c.cpf) : ""}{c.cpf && c.phone ? " · " : ""}{c.phone || ""}</div>
              </button>
            ))}
          </div>
        )}
        {selectedClientId && <div style={{ fontSize: 12, color: T.sprout, marginTop: 6 }}>Cliente selecionado</div>}

        {/* Quick create */}
        {!showQuickCreate ? (
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <span onClick={() => setShowQuickCreate(true)} style={{ color: T.sprout, fontSize: 13, cursor: "pointer" }}>Não encontrou? Cadastrar rápido</span>
          </div>
        ) : (
          <div style={{ marginTop: 12, marginBottom: 16, padding: 14, border: `1px dashed ${T.stone}`, borderRadius: 8 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div><label style={LBL}>Nome completo *</label><input style={IS} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do cliente" /></div>
              <div><label style={LBL}>Telefone *</label><input style={IS} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" /></div>
              <div><label style={LBL}>CPF</label><input style={IS} value={newCpf} onChange={(e) => setNewCpf(e.target.value)} placeholder="000.000.000-00" /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setShowQuickCreate(false)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button type="button" disabled={!newName.trim() || !newPhone.trim() || savingClient} onClick={handleQuickCreate} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.sprout, color: T.ink, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !newName.trim() || !newPhone.trim() || savingClient ? 0.5 : 1 }}>{savingClient ? "Salvando..." : "Cadastrar"}</button>
            </div>
          </div>
        )}

        {/* Broker selection (director/manager only) */}
        {isManagerOrDirector && (
          <div style={{ marginBottom: 16 }}>
            <label style={LBL}>Corretor</label>
            <NexaSelect
              value={selectedBrokerId}
              onChange={(v) => setSelectedBrokerId(v)}
              options={brokersList.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Selecionar corretor..."
              ariaLabel="Corretor"
            />
          </div>
        )}

        {/* Error */}
        {error && <div style={{ fontSize: 12, color: "#F87171", background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button type="button" disabled={!selectedClientId || saving} onClick={handleConfirm} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: T.sprout, color: T.ink, fontSize: 13, fontWeight: 700, cursor: selectedClientId && !saving ? "pointer" : "not-allowed", opacity: selectedClientId && !saving ? 1 : 0.5 }}>{saving ? "Confirmando..." : "Confirmar entrada"}</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
