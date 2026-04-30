import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import * as XLSX from "xlsx";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA", red: "#F87171", amber: "#FBBF24" };
const IS: React.CSSProperties = { width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 4 };

// Field mapping targets
const FIELD_OPTIONS = [
  { key: "", label: "— Ignorar" },
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "Email" },
  { key: "cpf", label: "CPF" },
  { key: "city", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "origin", label: "Origem" },
  { key: "observations", label: "Observações" },
  { key: "profession", label: "Profissão" },
  { key: "company_name", label: "Empresa" },
];

const AUTO_MATCH: Record<string, string> = {
  nome: "name", name: "name", "nome completo": "name", full_name: "name",
  telefone: "phone", fone: "phone", phone: "phone", celular: "phone", whatsapp: "phone", tel: "phone",
  email: "email", "e-mail": "email", e_mail: "email",
  cpf: "cpf", "cpf/cnpj": "cpf",
  cidade: "city", city: "city",
  estado: "uf", uf: "uf", state: "uf",
  origem: "origin", source: "origin", canal: "origin",
  observação: "observations", obs: "observations", notas: "observations", observacoes: "observations",
  profissão: "profession", profissao: "profession",
  empresa: "company_name",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website", instagram: "Instagram", facebook: "Facebook", google_ads: "Google Ads",
  whatsapp: "WhatsApp", phone: "Telefone", referral: "Indicação", event: "Evento",
  walk_in: "Presencial", landing_page: "Landing Page", import: "Importação", other: "Outro",
};

type ImportRow = Record<string, string>;

export default function ImportarContatosPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;
  const accountId = account?.accountId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const fileRef = useRef<HTMLInputElement>(null);

  // Steps: 1=upload, 2=mapping, 3=defaults, 4=preview, 5=result
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  // Defaults
  const [defOrigin, setDefOrigin] = useState("import");
  const [defTemp, setDefTemp] = useState("warm");
  const [defAssigned, setDefAssigned] = useState("");
  const [dupStrategy, setDupStrategy] = useState("skip");
  // Processing
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; errors: { row: number; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Team for assignment
  const [team, setTeam] = useState<{ userId: string; name: string }[]>([]);

  // Load team on mount
  useState(() => {
    if (!supabase || !accountId) return;
    supabase.from("user_account_access").select("user_id, profiles!inner(name)").eq("account_id", accountId).then(({ data }) => {
      setTeam((data ?? []).map((d: Record<string, unknown>) => {
        const p = (Array.isArray(d.profiles) ? d.profiles[0] : d.profiles) as Record<string, unknown>;
        return { userId: d.user_id as string, name: (p?.name as string) ?? "—" };
      }));
    });
  });

  const parseFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown as unknown[][];
        if (json.length < 2) { setError("Arquivo vazio ou sem dados."); return; }
        if (json.length > 5001) { setError("Máximo de 5.000 linhas permitido."); return; }

        const hdrs = (json[0] as string[]).map((h) => String(h ?? "").trim());
        const dataRows = json.slice(1).filter((r) => r.some((c) => c != null && String(c).trim())).map((r) => {
          const obj: ImportRow = {};
          hdrs.forEach((h, i) => { obj[h] = String(r[i] ?? "").trim(); });
          return obj;
        });

        setHeaders(hdrs);
        setRows(dataRows);

        // Auto-match
        const autoMap: Record<string, string> = {};
        hdrs.forEach((h) => {
          const normalized = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (AUTO_MATCH[normalized]) autoMap[h] = AUTO_MATCH[normalized];
        });
        setMapping(autoMap);
        setStep(2);
      } catch { setError("Erro ao ler o arquivo. Verifique o formato."); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  // Validation
  const mappedFields = Object.values(mapping).filter(Boolean);
  const hasName = mappedFields.includes("name");
  const hasPhone = mappedFields.includes("phone");
  const canProceed = hasName && hasPhone;

  // Preview stats
  const previewStats = () => {
    let valid = 0; let invalid = 0;
    const nameCol = Object.entries(mapping).find(([, v]) => v === "name")?.[0];
    const phoneCol = Object.entries(mapping).find(([, v]) => v === "phone")?.[0];
    rows.forEach((r) => {
      const name = nameCol ? r[nameCol] : "";
      const phone = phoneCol ? r[phoneCol]?.replace(/\D/g, "") : "";
      if (name && phone && phone.length >= 10) valid++; else invalid++;
    });
    return { total: rows.length, valid, invalid };
  };

  // Import process
  async function runImport() {
    if (!supabase || !accountId || !userId) return;
    setProcessing(true); setProgress(0);

    const nameCol = Object.entries(mapping).find(([, v]) => v === "name")?.[0];
    const phoneCol = Object.entries(mapping).find(([, v]) => v === "phone")?.[0];
    const emailCol = Object.entries(mapping).find(([, v]) => v === "email")?.[0];
    const cpfCol = Object.entries(mapping).find(([, v]) => v === "cpf")?.[0];
    const cityCol = Object.entries(mapping).find(([, v]) => v === "city")?.[0];
    const ufCol = Object.entries(mapping).find(([, v]) => v === "uf")?.[0];
    const originCol = Object.entries(mapping).find(([, v]) => v === "origin")?.[0];
    const obsCol = Object.entries(mapping).find(([, v]) => v === "observations")?.[0];

    let imported = 0; let updated = 0; let skipped = 0;
    const errors: { row: number; error: string }[] = [];
    const batchSize = 50;

    // Create import record
    const { data: importRecord } = await supabase.from("contact_imports").insert({
      account_id: accountId, file_name: fileName, total_rows: rows.length,
      column_mapping: mapping, default_values: { origin: defOrigin, temperature: defTemp, assigned_to: defAssigned || null },
      duplicate_strategy: dupStrategy, imported_by: userId, started_at: new Date().toISOString(), status: "processing",
    }).select("id").single();

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        const rowNum = i + j + 2; // +2 for header + 1-indexed
        const name = nameCol ? r[nameCol] : "";
        const phone = phoneCol ? r[phoneCol]?.replace(/\D/g, "") : "";
        const email = emailCol ? r[emailCol]?.trim() : "";

        // Validate
        if (!name) { errors.push({ row: rowNum, error: "Nome vazio" }); continue; }
        if (!phone || phone.length < 10) { errors.push({ row: rowNum, error: "Telefone inválido" }); continue; }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push({ row: rowNum, error: "Email inválido" }); continue; }

        // Check duplicate
        const { data: existing } = await supabase.from("clients").select("id").eq("account_id", accountId).is("deleted_at", null).or(`phone.eq.${phone}${email ? `,email.eq.${email}` : ""}`).limit(1).maybeSingle();

        if (existing) {
          if (dupStrategy === "skip") { skipped++; continue; }
          if (dupStrategy === "update") {
            const updatePayload: Record<string, unknown> = {};
            if (email) updatePayload.email = email;
            if (cityCol && r[cityCol]) updatePayload.city = r[cityCol];
            if (obsCol && r[obsCol]) updatePayload.observations = r[obsCol];
            updatePayload.last_interaction_at = new Date().toISOString();
            await supabase.from("clients").update(updatePayload).eq("id", existing.id);
            updated++;
            continue;
          }
        }

        // Insert
        const payload: Record<string, unknown> = {
          account_id: accountId, name, phone, status: "new",
          email: email || null,
          cpf: cpfCol ? r[cpfCol]?.replace(/\D/g, "") || null : null,
          city: cityCol ? r[cityCol] || null : null,
          uf: ufCol ? r[ufCol] || null : null,
          origin: originCol ? r[originCol] || defOrigin : defOrigin,
          observations: obsCol ? r[obsCol] || null : null,
          temperature: defTemp,
          created_by: userId,
        };
        if (defAssigned) payload.assigned_to = defAssigned;

        const { error: insertErr } = await supabase.from("clients").insert(payload);
        if (insertErr) { errors.push({ row: rowNum, error: insertErr.message }); }
        else { imported++; }
      }

      setProgress(Math.round(((i + batch.length) / rows.length) * 100));
    }

    // Update import record
    if (importRecord?.id) {
      await supabase.from("contact_imports").update({
        status: "completed", imported_count: imported, skipped_count: skipped,
        duplicate_count: updated + skipped, error_count: errors.length,
        errors: errors.slice(0, 100), completed_at: new Date().toISOString(),
      }).eq("id", importRecord.id);
    }

    setResult({ imported, updated, skipped, errors });
    setProcessing(false);
    setStep(5);
  }

  const stats = step >= 4 ? previewStats() : null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      <button type="button" onClick={() => navigate("/contatos")} style={{ background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Contatos</button>
      <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.chalk, margin: "0 0 8px" }}>Importar contatos</h1>
      <p style={{ fontSize: 13, color: T.fog, margin: "0 0 24px" }}>Etapa {step} de 5{fileName ? ` · ${fileName}` : ""}</p>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[1, 2, 3, 4, 5].map((s) => <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? T.sprout : T.stone, transition: "background 0.3s" }} />)}
      </div>

      {error && <div style={{ padding: 12, background: "rgba(248,113,113,0.08)", borderRadius: 10, color: T.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div>
          <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${dragOver ? T.sprout : T.stone}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(74,222,128,0.04)" : "transparent", transition: "all 0.2s" }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.bone, marginBottom: 4 }}>Arraste um arquivo CSV ou XLSX aqui</div>
            <div style={{ fontSize: 13, color: T.fog }}>ou clique para selecionar</div>
            <div style={{ fontSize: 11, color: T.slate, marginTop: 12 }}>Formatos: .csv, .xlsx, .xls · Máximo: 5.000 linhas</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileSelect} />
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.bone, marginBottom: 16 }}>Mapear colunas ({rows.length} linhas detectadas)</div>
          <div style={{ display: "grid", gap: 10 }}>
            {headers.map((h) => (
              <div key={h} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: T.bone, fontWeight: 500 }}>{h}</span>
                <span style={{ fontSize: 13, color: T.slate }}>→</span>
                <select value={mapping[h] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))} style={{ ...IS, width: 180, flex: "none" }}>
                  {FIELD_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          {!canProceed && <div style={{ fontSize: 12, color: T.amber, marginTop: 12 }}>Mapeie pelo menos "Nome" e "Telefone" para continuar.</div>}
          {/* Preview */}
          <div style={{ marginTop: 20, fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginBottom: 8 }}>PREVIEW (5 primeiras linhas)</div>
          <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${T.stone}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{headers.filter((h) => mapping[h]).map((h) => <th key={h} style={{ padding: "8px 10px", background: T.carbon, color: T.fog, fontWeight: 600, textAlign: "left", borderBottom: `1px solid ${T.stone}`, whiteSpace: "nowrap" }}>{FIELD_OPTIONS.find((f) => f.key === mapping[h])?.label ?? h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}>{headers.filter((h) => mapping[h]).map((h) => <td key={h} style={{ padding: "8px 10px", color: T.bone, borderBottom: `1px solid ${T.stone}`, whiteSpace: "nowrap" }}>{r[h] || "—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={() => setStep(1)} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Voltar</button>
            <button type="button" disabled={!canProceed} onClick={() => setStep(3)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: canProceed ? T.sprout : T.stone, color: canProceed ? "var(--interactive-on-primary)" : T.slate, fontSize: 13, fontWeight: 600, cursor: canProceed ? "pointer" : "not-allowed" }}>Próximo</button>
          </div>
        </div>
      )}

      {/* Step 3: Defaults */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.bone, marginBottom: 16 }}>Valores padrão (aplicados a todos)</div>
          <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            <div><label style={LBL}>ORIGEM PADRÃO</label><select style={IS} value={defOrigin} onChange={(e) => setDefOrigin(e.target.value)}>{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label style={LBL}>TEMPERATURA</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["cold", "warm", "hot"] as const).map((t) => {
                  const colors = { hot: "#F87171", warm: "#F59E0B", cold: "#60A5FA" };
                  const labels = { hot: "Quente", warm: "Morno", cold: "Frio" };
                  return <button key={t} type="button" onClick={() => setDefTemp(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${defTemp === t ? colors[t] : T.stone}`, background: defTemp === t ? colors[t] + "15" : "transparent", color: defTemp === t ? colors[t] : T.fog, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{labels[t]}</button>;
                })}
              </div>
            </div>
            <div><label style={LBL}>RESPONSÁVEL</label><select style={IS} value={defAssigned} onChange={(e) => setDefAssigned(e.target.value)}><option value="">— Sem responsável</option>{team.map((t) => <option key={t.userId} value={t.userId}>{t.name}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.bone, marginBottom: 12 }}>Estratégia de duplicatas</div>
          <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
            {[["skip", "Pular", "Não importar contatos duplicados"], ["update", "Atualizar", "Atualizar dados do contato existente"], ["create_new", "Criar novo", "Criar novo mesmo se duplicado"]].map(([k, l, d]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: dupStrategy === k ? "rgba(74,222,128,0.06)" : T.carbon, border: `1px solid ${dupStrategy === k ? T.sprout : T.stone}`, borderRadius: 8, cursor: "pointer" }}>
                <input type="radio" name="dup" checked={dupStrategy === k} onChange={() => setDupStrategy(k)} style={{ accentColor: "#4ADE80" }} />
                <div><div style={{ fontSize: 13, fontWeight: 600, color: T.bone }}>{l}</div><div style={{ fontSize: 11, color: T.fog }}>{d}</div></div>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setStep(2)} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Voltar</button>
            <button type="button" onClick={() => setStep(4)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Próximo</button>
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 4 && stats && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.bone, marginBottom: 16 }}>Confirmar importação</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: T.chalk }}>{stats.total}</div><div style={{ fontSize: 11, color: T.fog }}>Total</div></div>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: T.sprout }}>{stats.valid}</div><div style={{ fontSize: 11, color: T.fog }}>Válidos</div></div>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: stats.invalid > 0 ? T.red : T.slate }}>{stats.invalid}</div><div style={{ fontSize: 11, color: T.fog }}>Com erro</div></div>
          </div>
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>CONFIGURAÇÃO</div>
            <div style={{ fontSize: 13, color: T.bone }}>Origem: {SOURCE_LABELS[defOrigin] ?? defOrigin}</div>
            <div style={{ fontSize: 13, color: T.bone }}>Temperatura: {defTemp === "hot" ? "Quente" : defTemp === "warm" ? "Morno" : "Frio"}</div>
            <div style={{ fontSize: 13, color: T.bone }}>Duplicatas: {dupStrategy === "skip" ? "Pular" : dupStrategy === "update" ? "Atualizar" : "Criar novo"}</div>
            {defAssigned && <div style={{ fontSize: 13, color: T.bone }}>Responsável: {team.find((t) => t.userId === defAssigned)?.name ?? "—"}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setStep(3)} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Voltar</button>
            <button type="button" onClick={() => void runImport()} disabled={processing} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Importar {stats.valid} contatos</button>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {processing && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.bone, marginBottom: 12 }}>Importando contatos...</div>
          <div style={{ height: 8, borderRadius: 4, background: T.stone, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: T.sprout, borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 13, color: T.fog }}>{progress}%</div>
        </div>
      )}

      {/* Step 5: Result */}
      {step === 5 && result && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.sprout }}>Importação concluída!</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: T.sprout }}>{result.imported}</div><div style={{ fontSize: 11, color: T.fog }}>Importados</div></div>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: T.blue }}>{result.updated}</div><div style={{ fontSize: 11, color: T.fog }}>Atualizados</div></div>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: result.errors.length > 0 ? T.red : T.slate }}>{result.errors.length}</div><div style={{ fontSize: 11, color: T.fog }}>Erros</div></div>
          </div>
          {result.skipped > 0 && <div style={{ fontSize: 13, color: T.fog, marginBottom: 12 }}>{result.skipped} contatos pulados (duplicados)</div>}
          {result.errors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>ERROS</div>
              <div style={{ maxHeight: 200, overflowY: "auto", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
                {result.errors.slice(0, 20).map((e, i) => <div key={i} style={{ padding: "8px 12px", fontSize: 12, color: T.red, borderBottom: `1px solid ${T.stone}` }}>Linha {e.row}: {e.error}</div>)}
                {result.errors.length > 20 && <div style={{ padding: "8px 12px", fontSize: 12, color: T.fog }}>...e mais {result.errors.length - 20} erros</div>}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => navigate("/contatos")} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Ver contatos</button>
            <button type="button" onClick={() => { setStep(1); setFileName(""); setHeaders([]); setRows([]); setMapping({}); setResult(null); }} style={{ padding: "12px 20px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Nova importação</button>
          </div>
        </div>
      )}
    </div>
  );
}
