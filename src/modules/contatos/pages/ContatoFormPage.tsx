import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { createClient, checkDuplicateClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { useLeadOrigins } from "../../configuracoes/hooks/useLeadOrigins";
import { useLeadCampaigns } from "../../configuracoes/hooks/useLeadCampaigns";
import { NexaSelect } from "../../../shared/ui/NexaSelect";

export default function ContatoFormPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;
  const accountId = account?.accountId ?? null;

  // Catálogo de Configurações → Leads (origens = slug; campanhas = uuid). Regra no hook.
  const { origins } = useLeadOrigins();
  const { campaigns } = useLeadCampaigns();
  const originOptions = origins
    .filter((o) => o.active)
    .map((o) => ({ value: o.slug, label: o.label }));
  const campaignOptions = [
    { value: "", label: "Nenhuma" },
    ...campaigns.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name })),
  ];

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [origin, setOrigin] = useState("");
  const [originDetail, setOriginDetail] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [temperature, setTemperature] = useState("warm");
  const [showStep2, setShowStep2] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [purchaseTimeline, setPurchaseTimeline] = useState("");
  const [paymentPreference, setPaymentPreference] = useState("");
  const [interestedUnitType, setInterestedUnitType] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; phone: string } | null>(null);

  async function handleSave(force = false) {
    if (!accountId || !fullName.trim()) return;
    setSaving(true); setError(null);
    try {
      if (!force) {
        const cleanPhone = phone.replace(/\D/g, "");
        const dup = await checkDuplicateClient(accountId, cleanPhone || undefined, email || undefined);
        if (dup) { setDuplicate({ id: dup.id, name: dup.name || dup.fullName || "", phone: dup.phone }); setSaving(false); return; }
      }
      const c = await createClient({
        accountId, name: fullName.trim(),
        phone: phone.replace(/\D/g, "") || undefined, email: email.trim() || undefined,
        origin: origin || undefined, originDetail: originDetail.trim() || undefined,
        campaignId: campaignId || undefined,
        temperature, status: "new",
        buyerProfile: buyerProfile || undefined, budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined, purchaseTimeline: purchaseTimeline || undefined,
        paymentPreference: paymentPreference || undefined, interestedUnitType: interestedUnitType || undefined,
        internalNotes: internalNotes.trim() || undefined, createdBy: authenticatedProfile?.id,
        dataNascimento: dataNascimento || undefined,
      });
      navigate(`/contatos/${c.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao criar contato."); }
    finally { setSaving(false); }
  }

  const SEL: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer", boxSizing: "border-box" };
  const INP: React.CSSProperties = { ...SEL, cursor: "text", background: "var(--surface-base)" };
  const LBL: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em" };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <button type="button" onClick={() => navigate("/contatos")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 8 }}>← Voltar</button>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Novo Contato</h1>
      </div>

      {duplicate && (
        <div style={{ padding: 16, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FBBF24", marginBottom: 8 }}>Contato possivelmente duplicado</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Já existe: <strong>{duplicate.name}</strong>{duplicate.phone ? ` · ${duplicate.phone}` : ""}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => navigate(`/contatos/${duplicate.id}`)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Ver existente</button>
            <button type="button" onClick={() => { setDuplicate(null); void handleSave(true); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Criar mesmo assim</button>
            <button type="button" onClick={() => setDuplicate(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Dados essenciais</div>
        <div style={{ display: "grid", gap: 14 }}>
          <div><label style={LBL}>NOME COMPLETO *</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do contato" style={INP} autoFocus /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={LBL}>TELEFONE *</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" style={INP} /></div>
            <div><label style={LBL}>E-MAIL</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" style={INP} /></div>
          </div>
          <div><label style={LBL}>DATA DE NASCIMENTO</label><input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} style={INP} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={LBL}>ORIGEM</label><NexaSelect value={origin} onChange={(v) => setOrigin(v)} options={originOptions} placeholder="Selecione..." emptyLabel="Nenhuma origem cadastrada" ariaLabel="Origem" allowClear /></div>
            <div><label style={LBL}>CAMPANHA</label><NexaSelect value={campaignId} onChange={(v) => setCampaignId(v)} options={campaignOptions} placeholder="Nenhuma" emptyLabel="Nenhuma campanha cadastrada" ariaLabel="Campanha" /></div>
          </div>
          <div><label style={LBL}>DETALHE DA ORIGEM</label><input type="text" value={originDetail} onChange={(e) => setOriginDetail(e.target.value)} placeholder="Corretor, indicação, etc." style={INP} /></div>
          <div><label style={LBL}>TEMPERATURA</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["cold", "warm", "hot"] as const).map((t) => {
                const colors = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };
                const labels = { hot: "Quente", warm: "Morno", cold: "Frio" };
                return <button key={t} type="button" onClick={() => setTemperature(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${temperature === t ? colors[t] : "var(--border-default)"}`, background: temperature === t ? colors[t] + "15" : "transparent", color: temperature === t ? colors[t] : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{labels[t]}</button>;
              })}
            </div>
          </div>
        </div>
      </div>

      <button type="button" onClick={() => setShowStep2(!showStep2)} style={{ width: "100%", padding: "12px 24px", borderRadius: 12, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", marginBottom: 14, textAlign: "left" }}>{showStep2 ? "▾" : "▸"} Qualificação e interesse (opcional)</button>

      {showStep2 && (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={LBL}>PERFIL DE COMPRADOR</label><NexaSelect value={buyerProfile} onChange={(v) => setBuyerProfile(v)} options={[{ value: "investor", label: "Investidor" }, { value: "resident", label: "Morador" }, { value: "both", label: "Ambos" }]} placeholder="Selecione..." ariaLabel="Perfil de comprador" /></div>
              <div><label style={LBL}>TIPO DE IMÓVEL</label><NexaSelect value={interestedUnitType} onChange={(v) => setInterestedUnitType(v)} options={[{ value: "lote", label: "Lote" }, { value: "casa", label: "Casa" }, { value: "apartamento", label: "Apartamento" }, { value: "comercial", label: "Comercial" }]} placeholder="Selecione..." ariaLabel="Tipo de imóvel" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={LBL}>BUDGET MÍNIMO (R$)</label><input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="0" style={INP} /></div>
              <div><label style={LBL}>BUDGET MÁXIMO (R$)</label><input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="0" style={INP} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={LBL}>PRAZO DE COMPRA</label><NexaSelect value={purchaseTimeline} onChange={(v) => setPurchaseTimeline(v)} options={[{ value: "immediate", label: "Imediato" }, { value: "1_to_3_months", label: "1-3 meses" }, { value: "3_to_6_months", label: "3-6 meses" }, { value: "6_to_12_months", label: "6-12 meses" }, { value: "over_12_months", label: "+12 meses" }]} placeholder="Selecione..." ariaLabel="Prazo de compra" /></div>
              <div><label style={LBL}>PREFERÊNCIA PAGAMENTO</label><NexaSelect value={paymentPreference} onChange={(v) => setPaymentPreference(v)} options={[{ value: "cash", label: "À vista" }, { value: "installment", label: "Parcelado" }, { value: "financing", label: "Financiamento" }, { value: "fgts", label: "FGTS" }]} placeholder="Selecione..." ariaLabel="Preferência de pagamento" /></div>
            </div>
            <div><label style={LBL}>OBSERVAÇÕES</label><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Anotações internas..." rows={3} style={{ ...INP, resize: "vertical" }} /></div>
          </div>
        </div>
      )}

      {error && <div style={{ padding: 12, background: "rgba(248,113,113,0.08)", borderRadius: 10, color: "#F87171", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => navigate("/contatos")} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
        <button type="button" onClick={() => void handleSave()} disabled={!fullName.trim() || (!phone.trim() && !email.trim()) || saving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: saving || !fullName.trim() ? "rgba(74,222,128,0.3)" : "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Salvando..." : "Criar contato"}</button>
      </div>
    </div>
  );
}
