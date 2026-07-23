// Documentos Temáveis v3 · FASE 2 · a PORTA de TODOS (Lei multi-tenant): qualquer
// conta configura sua pele de documento aqui, no mesmo nível. NENHUM dado de
// cliente hardcoded · só o neutro NEXA + o que a tela grava. Gate owner/director/
// manager. Preview VIVO re-renderiza a pág 1 com o MESMO renderer + dados de
// exemplo genéricos.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canManageScope } from "../../atividades/constants/teamScope";
import { DEFAULT_NEXA_THEME, resolveDocumentTheme, hexToRgb, type DocumentTheme, type DocumentFontPair, type DocumentPalette } from "../../../shared/documents/documentTheme";
import { useDocumentTheme } from "../../../shared/documents/useDocumentTheme";
import { saveDocumentTheme, deleteDocumentTheme, uploadDocumentLogo } from "../../../infra/repositories/accountDocumentThemeSupabaseRepository";
import { gerarPdfSimulacao, type PdfData } from "../../../modules/simulador/utils/gerarPdfSimulacao";
import { fluidGrid } from "../../../shared/responsive";

const PALETTE_FIELDS: { key: keyof DocumentPalette; label: string }[] = [
  { key: "pageBg", label: "Fundo da página" },
  { key: "accent", label: "Destaque (accent)" },
  { key: "textPrimary", label: "Texto principal" },
  { key: "textSecondary", label: "Texto secundário" },
  { key: "textMuted", label: "Texto suave" },
  { key: "cardBg", label: "Fundo do card" },
  { key: "cardBorder", label: "Borda do card" },
  { key: "divider", label: "Divisor" },
];

// Dados de EXEMPLO genéricos p/ o preview · nunca dados de cliente hardcoded.
const SAMPLE: PdfData = {
  contaNome: "Sua incorporadora", empreendimentoNome: "Empreendimento", quadra: "07", lote: "12",
  valorOriginal: 320000, desconto: 0, descontoPct: 0, valorNegociado: 320000,
  entradaValor: 64000, entradaPct: 20, entradaParcelada: false, entradaParceladaVezes: 0, entradaParceladaValor: 0,
  numeroParcelas: 120, parcelaValor: 2133, indiceLabel: "INCC",
  carenciaAtiva: true, carenciaMeses: 6,
  balaoAtivo: true, balaoQuantidade: 4, balaoValor: 8000, totalBalaos: 32000,
  permutaAtiva: false, permutaItens: [], totalPermuta: 0, saldoFinanciar: 256000,
  tipoSaldo: "parcelas_incorporadora", textoSaldoPersonalizado: null,
  clienteNome: "Cliente exemplo", corretorNome: "Corretor(a) exemplo",
  area: 250, balaoPeriodicidade: "semestral", pdfValidadeHoras: 48, protocolo: "CP-20260101-L12Q07",
};

function relLum(rgb: [number, number, number]): number {
  const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(hexA: string, hexB: string): number {
  const a = relLum(hexToRgb(hexA)), b = relLum(hexToRgb(hexB));
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

const LBL: React.CSSProperties = { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 };
const CARD: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16, marginBottom: 16 };

export default function DocumentThemeSection({ accountId, userId, role }: { accountId: string | null; userId: string | null; role: string | null }) {
  const { row, loading, reload } = useDocumentTheme(accountId);
  const [draft, setDraft] = useState<DocumentTheme>(DEFAULT_NEXA_THEME);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"primary" | "product" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hidrata o draft com a linha resolvida (ou neutro)
  useEffect(() => {
    if (loading) return;
    setDraft(resolveDocumentTheme(row));
  }, [row, loading]);

  const set = <K extends keyof DocumentTheme>(k: K, v: DocumentTheme[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // PREVIEW VIVO · regenera a pág 1 (debounce) com o draft.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = (await gerarPdfSimulacao(SAMPLE, draft, "bloburl")) as string;
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch (e) { console.warn("[docs-v3] preview falhou", e); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft]);

  const onUpload = useCallback(async (kind: "primary" | "product", file: File) => {
    if (!accountId) return;
    if (file.type !== "image/png") { setToast("Use PNG transparente."); return; }
    if (file.size > 2 * 1024 * 1024) { setToast("Máximo 2 MB."); return; }
    setUploading(kind);
    try {
      const url = await uploadDocumentLogo(accountId, kind, file);
      const bust = `${url}?v=${Date.now()}`;
      set(kind === "primary" ? "logoPrimary" : "logoProduct", bust);
    } catch (e) { setToast(e instanceof Error ? e.message : "Falha no upload."); }
    finally { setUploading(null); }
  }, [accountId]);

  const onSave = useCallback(async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await saveDocumentTheme(accountId, {
        logo_primary_url: draft.logoPrimary ?? null,
        logo_product_url: draft.logoProduct ?? null,
        palette: Object.fromEntries(PALETTE_FIELDS.map((f) => [f.key, draft[f.key]])) as Record<string, string>,
        slogan: draft.slogan ?? null,
        slogan_accent_word: draft.sloganAccentWord ?? null,
        disclaimer: draft.disclaimer,
        font_pair: draft.fontPair,
      }, userId);
      setToast("Tema salvo.");
      await reload();
    } catch (e) { setToast(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }, [accountId, draft, userId, reload]);

  const onRestore = useCallback(async () => {
    if (!accountId) return;
    if (!window.confirm("Restaurar o padrão NEXA? A configuração atual do documento será apagada.")) return;
    setSaving(true);
    try { await deleteDocumentTheme(accountId); setDraft(DEFAULT_NEXA_THEME); setToast("Padrão NEXA restaurado."); await reload(); }
    catch (e) { setToast(e instanceof Error ? e.message : "Falha ao restaurar."); }
    finally { setSaving(false); }
  }, [accountId, reload]);

  const contrastWarn = useMemo(() => contrast(draft.textPrimary, draft.pageBg) < 4.5, [draft.textPrimary, draft.pageBg]);
  const sloganWords = (draft.slogan || "").split(/\s+/).filter(Boolean);

  if (!canManageScope(role)) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Só owner, director ou manager configuram o tema dos documentos.</p>;
  }

  return (
    <div>
      {toast && <div onClick={() => setToast(null)} style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "var(--surface-elevated,#1C1B18)", border: "1px solid var(--border-default)", color: "var(--text-primary)", padding: "10px 18px", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>{toast}</div>}

      <div style={{ display: "grid", gridTemplateColumns: fluidGrid(320), gap: 20, alignItems: "start" }}>
        {/* ── COLUNA DE EDIÇÃO ── */}
        <div>
          {/* IDENTIDADE */}
          <div style={CARD}>
            <label style={LBL}>Identidade</label>
            <div style={{ display: "grid", gridTemplateColumns: fluidGrid(150), gap: 12 }}>
              {(["primary", "product"] as const).map((kind) => {
                const url = kind === "primary" ? draft.logoPrimary : draft.logoProduct;
                return (
                  <div key={kind}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{kind === "primary" ? "Logo principal" : "Selo do produto"}</div>
                    <div style={{ height: 64, borderRadius: 8, border: "1px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-base)", overflow: "hidden" }}>
                      {url ? <img src={url} alt="" style={{ maxHeight: 52, maxWidth: "90%", objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>PNG ≤2MB</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <label style={{ fontSize: 12, color: "var(--interactive-primary)", cursor: "pointer" }}>
                        {uploading === kind ? "Enviando…" : url ? "Substituir" : "Enviar"}
                        <input type="file" accept="image/png" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(kind, f); e.target.value = ""; }} />
                      </label>
                      {url && <button type="button" onClick={() => set(kind === "primary" ? "logoPrimary" : "logoProduct", null)} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Remover</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CORES */}
          <div style={CARD}>
            <label style={LBL}>Cores</label>
            <div style={{ display: "grid", gridTemplateColumns: fluidGrid(160), gap: 10 }}>
              {PALETTE_FIELDS.map((f) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} style={{ width: 34, height: 34, border: "1px solid var(--border-default)", borderRadius: 8, background: "none", cursor: "pointer", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</div>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{draft[f.key].toUpperCase()}</div>
                  </div>
                </div>
              ))}
            </div>
            {contrastWarn && <div style={{ marginTop: 10, fontSize: 11.5, color: "#F59E0B" }}>Contraste baixo entre texto principal e fundo · o documento pode ficar difícil de ler.</div>}
          </div>

          {/* VOZ */}
          <div style={CARD}>
            <label style={LBL}>Voz</label>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Slogan (rodapé)</div>
              <input value={draft.slogan ?? ""} onChange={(e) => set("slogan", e.target.value || null)} placeholder="Sem slogan (a linha não aparece)" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--surface-base)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            {sloganWords.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Palavra em destaque (clique)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {sloganWords.map((w, i) => {
                    const clean = w.replace(/[.,;:!?]$/, "");
                    const active = (draft.sloganAccentWord || "").toLowerCase() === clean.toLowerCase();
                    return <button key={i} type="button" onClick={() => set("sloganAccentWord", active ? null : clean)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: active ? "1px solid var(--interactive-primary)" : "1px solid var(--border-default)", background: active ? "var(--status-sprout-muted)" : "transparent", color: active ? "var(--interactive-primary)" : "var(--text-secondary)", fontStyle: active ? "italic" : "normal" }}>{w}</button>;
                  })}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Disclaimer (1 linha recomendada)</div>
              <textarea value={draft.disclaimer} onChange={(e) => set("disclaimer", e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--surface-base)", color: "var(--text-primary)", fontSize: 12.5, resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* TIPOGRAFIA */}
          <div style={CARD}>
            <label style={LBL}>Tipografia</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {([["nexa", "Neutro do sistema", "Sans compacta · sóbria"], ["bomm_editorial", "Editorial", "Newsreader · Geist · JetBrains Mono"]] as [DocumentFontPair, string, string][]).map(([val, title, sample]) => {
                const active = draft.fontPair === val;
                return (
                  <button key={val} type="button" onClick={() => set("fontPair", val)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", border: active ? "1px solid var(--interactive-primary)" : "1px solid var(--border-default)", background: active ? "var(--status-sprout-muted)" : "transparent", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: active ? "4px solid var(--interactive-primary)" : "2px solid var(--border-strong)", flexShrink: 0 }} />
                    <span><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span><span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{sample}</span></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={onSave} disabled={saving} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando…" : "Salvar tema"}</button>
            <button type="button" onClick={onRestore} disabled={saving} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Restaurar padrão NEXA</button>
          </div>
        </div>

        {/* ── PREVIEW VIVO ── */}
        <div style={{ position: "sticky", top: 16 }}>
          <label style={LBL}>Preview vivo · página 1</label>
          <div style={{ border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden", background: "#525659", aspectRatio: "210 / 297" }}>
            {previewUrl ? <iframe title="Preview do documento" src={`${previewUrl}#toolbar=0&navpanes=0&view=Fit`} style={{ width: "100%", height: "100%", border: "none" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>Gerando preview…</div>}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>Dados de exemplo · você vê o que está configurando. O padrão NEXA (sem configuração) já gera um documento sóbrio e completo.</div>
        </div>
      </div>
    </div>
  );
}
