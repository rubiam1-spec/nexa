import { useState, useEffect } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import BannerTemplateEditorModal, { type TextConfig } from "./BannerTemplateEditorModal";

// ── Types ──

interface BannerTemplate {
  id: string;
  name: string;
  type: string;
  background_url: string;
  text_config: TextConfig;
  is_active: boolean;
  sort_order: number;
}

interface MessageTemplate {
  id: string;
  type: string;
  message_text: string;
}

interface Props {
  accountId: string;
  developmentId: string | null;
  userId: string | null;
  corPrimaria: string;
  devName: string;
}

// ── Constants ──

const TYPE_LABELS: Record<string, string> = {
  birthday: "ANIVERSÁRIO",
  recognition: "RECONHECIMENTO",
  welcome: "BOAS-VINDAS",
  announcement: "COMUNICADO",
  custom: "PERSONALIZADO",
};

const MSG_TYPES = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Outfit', sans-serif";

// ── Component ──

export default function ConfiguracoesTab({ accountId, developmentId, userId, corPrimaria, devName }: Props) {
  const [bannerTemplates, setBannerTemplates] = useState<BannerTemplate[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BannerTemplate | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState("");
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [newMsgType, setNewMsgType] = useState("birthday");
  const [newMsgText, setNewMsgText] = useState("");
  const [msgSaving, setMsgSaving] = useState(false);

  function loadAll() {
    if (!supabase || !accountId) return;
    supabase.from("banner_templates").select("*").eq("account_id", accountId).order("sort_order", { ascending: true })
      .then(({ data }) => setBannerTemplates((data ?? []) as BannerTemplate[]));
    supabase.from("message_templates").select("*").eq("account_id", accountId).order("type", { ascending: true })
      .then(({ data }) => setMessageTemplates((data ?? []) as MessageTemplate[]));
  }

  useEffect(() => { loadAll(); }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeleteTemplate(id: string) {
    if (!supabase) return;
    await supabase.from("banner_templates").delete().eq("id", id);
    setBannerTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSaveMessage(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("message_templates")
      .update({ message_text: editingMsgText, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      setMessageTemplates((prev) => prev.map((m) => m.id === id ? { ...m, message_text: editingMsgText } : m));
      setEditingMsgId(null);
    }
  }

  async function handleAddMessage() {
    if (!supabase || !newMsgText.trim()) return;
    setMsgSaving(true);
    const { data, error } = await supabase.from("message_templates")
      .insert({ account_id: accountId, type: newMsgType, message_text: newMsgText.trim() })
      .select().single();
    setMsgSaving(false);
    if (!error && data) {
      setMessageTemplates((prev) => [...prev, data as MessageTemplate]);
      setNewMsgText(""); setNewMsgType("birthday"); setShowNewMsg(false);
    }
  }

  const INP: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--surface-base)", border: "1px solid var(--border-default)",
    borderRadius: 8, padding: "8px 12px",
    color: "var(--text-primary)", fontSize: 13, fontFamily: SANS,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

      {/* ── Section A: Templates de Arte ── */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
          Templates de Arte
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, fontFamily: SANS, marginTop: 4 }}>
          Crie artes personalizadas para banners de aniversário e reconhecimento.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 12 }}>
          {bannerTemplates.map((t) => (
            <div key={t.id} style={{
              borderRadius: 10, overflow: "hidden",
              border: "1px solid var(--border-default)",
              background: "var(--surface-raised)",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{
                width: "100%", aspectRatio: "1/1",
                backgroundImage: `url(${t.background_url})`,
                backgroundSize: "cover", backgroundPosition: "center",
                flexShrink: 0,
              }} />
              <div style={{ padding: "8px 10px", flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-muted)" }}>
                  {TYPE_LABELS[t.type] ?? t.type}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, padding: "0 10px 10px" }}>
                <button type="button" onClick={() => { setEditingTemplate(t); setShowEditor(true); }} style={{
                  flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 10, fontFamily: SANS,
                  border: "1px solid var(--border-default)", background: "transparent",
                  color: "var(--text-secondary)", cursor: "pointer",
                }}>Editar</button>
                <button type="button" onClick={() => handleDeleteTemplate(t.id)} style={{
                  padding: "5px 8px", borderRadius: 6, fontSize: 10, fontFamily: SANS,
                  border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)",
                  color: "#EF4444", cursor: "pointer",
                }}>✕</button>
              </div>
            </div>
          ))}

          {/* New template button */}
          <button type="button" onClick={() => { setEditingTemplate(null); setShowEditor(true); }} style={{
            borderRadius: 10, border: "1.5px dashed var(--border-default)",
            background: "transparent", cursor: "pointer", aspectRatio: "1/1",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, color: "var(--text-muted)", minHeight: 120,
            transition: "border-color 150ms",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            <span style={{ fontFamily: SANS, fontSize: 11 }}>Novo template</span>
          </button>
        </div>
      </div>

      {/* ── Section B: Mensagens Personalizadas ── */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
          Mensagens Personalizadas
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, fontFamily: SANS, marginTop: 4 }}>
          Configure mensagens padrão para WhatsApp. Use{" "}
          <code style={{ fontFamily: MONO, fontSize: 11, background: "var(--surface-raised)", padding: "1px 5px", borderRadius: 4 }}>{"{{NOME}}"}</code>,{" "}
          <code style={{ fontFamily: MONO, fontSize: 11, background: "var(--surface-raised)", padding: "1px 5px", borderRadius: 4 }}>{"{{MES}}"}</code> e{" "}
          <code style={{ fontFamily: MONO, fontSize: 11, background: "var(--surface-raised)", padding: "1px 5px", borderRadius: 4 }}>{"{{EMPREENDIMENTO}}"}</code> como placeholders.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messageTemplates.map((msg) => (
            <div key={msg.id} style={{
              padding: 16, background: "var(--surface-raised)",
              border: "1px solid var(--border-default)", borderRadius: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {TYPE_LABELS[msg.type] ?? msg.type}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {editingMsgId === msg.id ? (
                    <>
                      <button type="button" onClick={() => handleSaveMessage(msg.id)} style={{
                        padding: "4px 12px", borderRadius: 6, fontSize: 11, fontFamily: SANS,
                        border: "none", background: corPrimaria, color: "#1C1B18", cursor: "pointer", fontWeight: 700,
                      }}>Salvar</button>
                      <button type="button" onClick={() => setEditingMsgId(null)} style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontFamily: SANS,
                        border: "1px solid var(--border-default)", background: "transparent",
                        color: "var(--text-muted)", cursor: "pointer",
                      }}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setEditingMsgId(msg.id); setEditingMsgText(msg.message_text); }} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontFamily: SANS,
                      border: "1px solid var(--border-default)", background: "transparent",
                      color: "var(--text-muted)", cursor: "pointer",
                    }}>Editar</button>
                  )}
                </div>
              </div>

              {editingMsgId === msg.id ? (
                <textarea
                  value={editingMsgText}
                  onChange={(e) => setEditingMsgText(e.target.value)}
                  rows={3}
                  style={{ ...INP, lineHeight: 1.6, resize: "vertical" }}
                />
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0, fontFamily: SANS }}>
                  {msg.message_text}
                </p>
              )}

              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-disabled)", fontFamily: SANS }}>
                Preview:{" "}
                {(editingMsgId === msg.id ? editingMsgText : msg.message_text)
                  .replace(/\{\{NOME\}\}/g, "Cibelle")
                  .replace(/\{\{MES\}\}/g, "Abril")
                  .replace(/\{\{EMPREENDIMENTO\}\}/g, devName || "Vivendas")}
              </div>
            </div>
          ))}

          {messageTemplates.length === 0 && !showNewMsg && (
            <div style={{ padding: 24, textAlign: "center", borderRadius: 12, border: "1px solid var(--border-default)", color: "var(--text-muted)", fontFamily: SANS, fontSize: 13 }}>
              Nenhuma mensagem cadastrada ainda.
            </div>
          )}

          {/* New message form */}
          {showNewMsg && (
            <div style={{
              padding: 16, background: "var(--surface-raised)",
              border: `1.5px solid ${corPrimaria}40`, borderRadius: 12,
            }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Tipo</div>
                <select value={newMsgType} onChange={(e) => setNewMsgType(e.target.value)} style={INP}>
                  {MSG_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Mensagem</div>
                <textarea
                  value={newMsgText}
                  onChange={(e) => setNewMsgText(e.target.value)}
                  rows={3}
                  placeholder={`Olá {{NOME}}, parabéns pelo seu aniversário! 🎉`}
                  style={{ ...INP, lineHeight: 1.6, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleAddMessage} disabled={msgSaving || !newMsgText.trim()} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                  background: (!newMsgText.trim() || msgSaving) ? `${corPrimaria}80` : corPrimaria,
                  color: "#1C1B18", fontFamily: SANS, fontSize: 13, fontWeight: 700,
                  cursor: (!newMsgText.trim() || msgSaving) ? "not-allowed" : "pointer",
                }}>
                  {msgSaving ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" onClick={() => { setShowNewMsg(false); setNewMsgText(""); }} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontFamily: SANS,
                  border: "1px solid var(--border-default)", background: "transparent",
                  color: "var(--text-muted)", cursor: "pointer",
                }}>Cancelar</button>
              </div>
            </div>
          )}

          {!showNewMsg && (
            <button type="button" onClick={() => setShowNewMsg(true)} style={{
              width: "100%", padding: 12, marginTop: 4,
              border: "1.5px dashed var(--border-default)", borderRadius: 10,
              background: "transparent", color: "var(--text-muted)",
              fontSize: 13, cursor: "pointer", fontFamily: SANS,
              transition: "border-color 150ms",
            }}>
              + Nova mensagem
            </button>
          )}
        </div>
      </div>

      {/* Template editor modal */}
      {showEditor && (
        <BannerTemplateEditorModal
          isOpen={showEditor}
          onClose={() => { setShowEditor(false); setEditingTemplate(null); }}
          accountId={accountId}
          developmentId={developmentId}
          userId={userId}
          editingId={editingTemplate?.id ?? null}
          editingData={editingTemplate ? {
            name: editingTemplate.name,
            type: editingTemplate.type,
            background_url: editingTemplate.background_url,
            text_config: editingTemplate.text_config,
          } : null}
          corPrimaria={corPrimaria}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
