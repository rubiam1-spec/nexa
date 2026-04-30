import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

const SUPERADMIN_EMAIL = "rubiam1@icloud.com";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

interface AccountRow { id: string; name: string; slug: string; created_at: string; dev_count: number; user_count: number }

export default function SuperadminPage() {
  const { user } = useAuth();
  if (user?.email !== SUPERADMIN_EMAIL) return <Navigate to="/" replace />;
  return <SuperadminContent />;
}

function SuperadminContent() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ accountName: "", directorEmail: "", directorName: "", telefone: "", site: "", developmentName: "", city: "", state: "" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void loadAccounts(); }, []);

  async function loadAccounts() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from("accounts").select("id, name, slug, created_at");
    const rows: AccountRow[] = [];
    for (const a of data ?? []) {
      const { count: devCount } = await supabase.from("developments").select("id", { count: "exact", head: true }).eq("account_id", a.id);
      const { count: userCount } = await supabase.from("user_account_access").select("id", { count: "exact", head: true }).eq("account_id", a.id);
      rows.push({ ...a, dev_count: devCount ?? 0, user_count: userCount ?? 0 });
    }
    setAccounts(rows);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.accountName || !form.directorEmail || !form.directorName || !form.developmentName) return;
    setCreating(true); setErr(null); setMsg(null);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro");
      setMsg(`Conta "${form.accountName}" criada. Convite enviado para ${form.directorEmail}.`);
      setForm({ accountName: "", directorEmail: "", directorName: "", telefone: "", site: "", developmentName: "", city: "", state: "" });
      void loadAccounts();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setCreating(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 32 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#14532d", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#4ade80" }}>N</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>NEXA Admin</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>Painel Superadmin</div>
          </div>
        </div>

        {/* Accounts */}
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Contas ativas</div>
          {loading ? <p style={{ color: "#6b7280" }}>Carregando...</p> : accounts.length === 0 ? <p style={{ color: "#6b7280" }}>Nenhuma conta cadastrada.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  {["Nome", "Slug", "Empreendimentos", "Usuários", "Criada em"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontFamily: "monospace", fontSize: 11 }}>{a.slug}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{a.dev_count}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{a.user_count}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11 }}>{formatDateBRT(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create */}
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Criar nova conta</div>

          {msg ? <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#4ade80" }}>{msg}</div> : null}
          {err ? <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#ef4444" }}>{err}</div> : null}

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dados da incorporadora</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="Nome da incorporadora *" value={form.accountName} onChange={(v) => setForm((s) => ({ ...s, accountName: v }))} placeholder="Bomm Urbanizadora" />
              <Inp label="Email do diretor *" value={form.directorEmail} onChange={(v) => setForm((s) => ({ ...s, directorEmail: v }))} placeholder="diretor@empresa.com" type="email" />
              <Inp label="Nome do diretor *" value={form.directorName} onChange={(v) => setForm((s) => ({ ...s, directorName: v }))} placeholder="João Silva" />
              <Inp label="Telefone" value={form.telefone} onChange={(v) => setForm((s) => ({ ...s, telefone: v }))} placeholder="(45) 99999-9999" />
              <Inp label="Site" value={form.site} onChange={(v) => setForm((s) => ({ ...s, site: v }))} placeholder="https://empresa.com.br" />
            </div>

            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Primeiro empreendimento</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Inp label="Nome do empreendimento *" value={form.developmentName} onChange={(v) => setForm((s) => ({ ...s, developmentName: v }))} placeholder="Vivendas do Bosque" />
              <Inp label="Cidade" value={form.city} onChange={(v) => setForm((s) => ({ ...s, city: v }))} placeholder="Foz do Iguaçu" />
              <Inp label="Estado" value={form.state} onChange={(v) => setForm((s) => ({ ...s, state: v }))} placeholder="PR" />
            </div>

            <button type="button" disabled={creating || !form.accountName || !form.directorEmail || !form.directorName || !form.developmentName}
              onClick={() => void handleCreate()}
              style={{ background: creating ? "#333" : "#16a34a", color: creating ? "#6b7280" : "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", marginTop: 8 }}>
              {creating ? "Criando..." : "Criar conta e enviar convite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label>
      <span style={{ display: "block", fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#e5e5e5", fontSize: 14 }} />
    </label>
  );
}
