import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";

// ── Types ──

interface WeeklyPlan {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  week_start: string;
  week_end: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  publisher: { name: string } | null;
}

interface Props {
  accountId: string;
  developmentId: string;
  userId: string;
  userRole: string;
  devName: string;
  corPrimaria: string;
}

// ── Constants ──

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Outfit', sans-serif";
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const GESTOR_ROLES = ["owner", "director", "manager"];

// ── Helpers ──

function getCurrentWeek(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diffToMon);
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);
  return {
    start: mon.toISOString().slice(0, 10),
    end: sat.toISOString().slice(0, 10),
  };
}

function formatWeekRange(start: string, end: string): string {
  const sParts = start.split("-");
  const eParts = end.split("-");
  const monthIdx = parseInt(eParts[1]) - 1;
  const sYear = parseInt(sParts[0]);
  const eYear = parseInt(eParts[0]);
  const yearSuffix = sYear !== new Date().getFullYear() || eYear !== new Date().getFullYear()
    ? ` de ${eYear}` : "";
  return `${parseInt(sParts[2])} a ${parseInt(eParts[2])} de ${MONTH_NAMES[monthIdx]}${yearSuffix}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isCurrentWeek(plan: WeeklyPlan): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return plan.status === "published" && plan.week_start <= today && today <= plan.week_end;
}

// ── Sub-components ──

function PlanCard({ plan, corPrimaria, isGestor, isCurrent, onView, onDownload, onArchive }: {
  plan: WeeklyPlan;
  corPrimaria: string;
  isGestor: boolean;
  isCurrent: boolean;
  onView: (url: string) => void;
  onDownload: (url: string, fileName: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div style={{
      padding: "16px 18px",
      background: "var(--surface-raised)",
      border: isCurrent ? `1.5px solid ${corPrimaria}60` : "1px solid var(--border-default)",
      borderLeft: isCurrent ? `3px solid ${corPrimaria}` : undefined,
      borderRadius: 12,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* PDF icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "#EF444415",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: SANS, fontSize: 14, fontWeight: 600,
            color: "var(--text-primary)", marginBottom: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {plan.title}
          </div>
          {plan.description && (
            <div style={{
              fontFamily: SANS, fontSize: 12, color: "var(--text-muted)", marginBottom: 4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {plan.description}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)" }}>
              {formatWeekRange(plan.week_start, plan.week_end)}
            </span>
            {plan.file_size_bytes != null && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)" }}>
                {formatFileSize(plan.file_size_bytes)}
              </span>
            )}
            {plan.publisher?.name && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)" }}>
                por {plan.publisher.name.split(" ")[0]}
              </span>
            )}
            {plan.status === "archived" && (
              <span style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: "var(--text-disabled)", background: "var(--border-default)",
                padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
              }}>
                ARQUIVADO
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => onView(plan.file_url)}
          style={{
            padding: "6px 14px", borderRadius: 6,
            border: `1px solid ${corPrimaria}40`,
            background: `${corPrimaria}08`,
            color: corPrimaria,
            fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          Visualizar
        </button>
        <button
          onClick={() => onDownload(plan.file_url, plan.file_name)}
          style={{
            padding: "6px 14px", borderRadius: 6,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          Baixar PDF
        </button>
        {isGestor && plan.status === "published" && (
          <button
            onClick={() => onArchive(plan.id)}
            style={{
              padding: "6px 14px", borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-muted)",
              fontFamily: SANS, fontSize: 12, cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Arquivar
          </button>
        )}
      </div>
    </div>
  );
}

interface ModalProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  weekStart: string;
  setWeekStart: (v: string) => void;
  weekEnd: string;
  setWeekEnd: (v: string) => void;
  file: File | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFile: (f: File) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  error: string | null;
  uploading: boolean;
  onPublish: () => void;
  onClose: () => void;
  corPrimaria: string;
}

function PublishModal({
  title, setTitle, description, setDescription,
  weekStart, setWeekStart, weekEnd, setWeekEnd,
  file, dragOver, setDragOver, handleDrop, handleFile,
  fileRef, error, uploading, onPublish, onClose, corPrimaria,
}: ModalProps) {
  const labelStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)",
    letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6, display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid var(--border-default)",
    background: "var(--surface-base)",
    color: "var(--text-primary)",
    fontFamily: SANS, fontSize: 13,
    boxSizing: "border-box",
    outline: "none",
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9000, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border-default)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Publicar Planejamento
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Planejamento de Vendas — Semana 15"
              maxLength={80}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Informações adicionais para a equipe (opcional)"
              maxLength={300}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
            />
          </div>

          {/* Week range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Início da semana *</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Fim da semana *</label>
              <input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* File drop zone */}
          <div>
            <label style={labelStyle}>Arquivo PDF *</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "28px 20px",
                borderRadius: 10,
                border: `2px dashed ${dragOver ? corPrimaria : "var(--border-default)"}`,
                background: dragOver ? `${corPrimaria}08` : "var(--surface-base)",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              {file ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {file.name}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)" }}>
                    {formatFileSize(file.size)} · clique para trocar
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: "var(--text-muted)" }}>
                    Arraste o PDF aqui ou clique para selecionar
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)" }}>
                    Apenas PDF · máximo 10 MB
                  </span>
                </div>
              )}
            </div>
            <input
              ref={fileRef as React.RefObject<HTMLInputElement>}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "#EF444415", border: "1px solid #EF444430",
              fontFamily: SANS, fontSize: 12, color: "#EF4444",
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border-default)",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: "9px 18px", borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-muted)",
              fontFamily: SANS, fontSize: 13, fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onPublish}
            disabled={uploading}
            style={{
              padding: "9px 20px", borderRadius: 8,
              border: "none",
              background: uploading ? "var(--border-default)" : corPrimaria,
              color: uploading ? "var(--text-disabled)" : "#1C1B18",
              fontFamily: SANS, fontSize: 13, fontWeight: 700,
              cursor: uploading ? "not-allowed" : "pointer",
              minWidth: 120,
            }}
          >
            {uploading ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main Component ──

export default function PlanejamentoTab({ accountId, developmentId, userId, userRole, devName, corPrimaria }: Props) {
  const isGestor = GESTOR_ROLES.includes(userRole);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadPlans = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("weekly_plans")
        .select("*, publisher:profiles!published_by(name)")
        .eq("account_id", accountId)
        .eq("development_id", developmentId)
        .neq("status", "draft")
        .order("week_start", { ascending: false });
      setPlans((data as WeeklyPlan[]) ?? []);
    } catch (e) {
      console.error("Erro ao carregar planejamentos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlans(); }, [accountId, developmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = () => {
    const week = getCurrentWeek();
    setTitle("");
    setDescription("");
    setWeekStart(week.start);
    setWeekEnd(week.end);
    setFile(null);
    setFormError(null);
    setShowModal(true);
  };

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") { setFormError("Apenas arquivos PDF são aceitos."); return; }
    if (f.size > 10 * 1024 * 1024) { setFormError("O arquivo deve ter no máximo 10 MB."); return; }
    setFile(f);
    setFormError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handlePublish = async () => {
    if (!supabase) return;
    if (!title.trim()) { setFormError("O título é obrigatório."); return; }
    if (!file) { setFormError("Selecione um arquivo PDF."); return; }
    if (!weekStart || !weekEnd) { setFormError("Defina o período da semana."); return; }
    if (weekEnd < weekStart) { setFormError("A data de fim deve ser posterior ao início."); return; }

    setUploading(true);
    setFormError(null);

    try {
      // Upload PDF to materials bucket
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `plans/${accountId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("materials")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("materials").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      // Insert weekly_plan
      const now = new Date().toISOString();
      const { error: insertErr } = await supabase
        .from("weekly_plans")
        .insert({
          account_id: accountId,
          development_id: developmentId,
          title: title.trim(),
          description: description.trim() || null,
          file_url: fileUrl,
          file_name: file.name,
          file_size_bytes: file.size,
          week_start: weekStart,
          week_end: weekEnd,
          status: "published",
          published_by: userId,
          published_at: now,
        });
      if (insertErr) throw insertErr;

      // Notify all users in account (fire-and-forget)
      supabase
        .from("user_account_access")
        .select("user_id")
        .eq("account_id", accountId)
        .then(({ data: accessRows }) => {
          if (!accessRows || accessRows.length === 0) return;
          const weekLabel = formatWeekRange(weekStart, weekEnd);
          const notifs = (accessRows as { user_id: string }[])
            .filter((r) => r.user_id !== userId)
            .map((r) => ({
              account_id: accountId,
              recipient_id: r.user_id,
              sender_id: userId,
              type: "weekly_plan_published",
              title: "Novo planejamento semanal",
              message: `${title.trim()} — semana de ${weekLabel} (${devName})`,
              action_url: "/relacionamento",
              read: false,
            }));
          if (notifs.length > 0) {
            supabase!.from("notifications").insert(notifs).then(() => {}, () => {});
          }
        });

      setShowModal(false);
      setToast("Planejamento publicado com sucesso!");
      loadPlans();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao publicar planejamento.";
      setFormError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleView = (url: string) => window.open(url, "_blank");

  const handleDownload = (url: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const handleArchive = async (id: string) => {
    if (!supabase) return;
    await supabase.from("weekly_plans").update({ status: "archived" }).eq("id", id);
    loadPlans();
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const currentPlan = plans.find(isCurrentWeek) ?? null;
  const historyPlans = plans.filter((p) => !isCurrentWeek(p));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
            Planejamento Semanal
          </div>
          <p style={{ fontFamily: SANS, fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Publique e compartilhe o planejamento semanal com a equipe.
          </p>
        </div>
        {isGestor && (
          <button
            onClick={openModal}
            style={{
              padding: "9px 18px", borderRadius: 8,
              border: "none",
              background: corPrimaria,
              color: "#1C1B18",
              fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            + Publicar plano
          </button>
        )}
      </div>

      {/* Current week */}
      {loading ? (
        <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-disabled)", padding: "20px 0" }}>
          Carregando...
        </div>
      ) : currentPlan ? (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            Semana Atual
          </div>
          <PlanCard
            plan={currentPlan}
            corPrimaria={corPrimaria}
            isGestor={isGestor}
            isCurrent
            onView={handleView}
            onDownload={handleDownload}
            onArchive={handleArchive}
          />
        </div>
      ) : (
        <div style={{
          padding: "32px 20px", textAlign: "center",
          background: "var(--surface-raised)", borderRadius: 12,
          border: "1px solid var(--border-default)",
        }}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: "var(--text-muted)", marginBottom: 6 }}>
            Nenhum planejamento para a semana atual
          </div>
          {isGestor && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)" }}>
              Clique em "+ Publicar plano" para compartilhar com a equipe
            </div>
          )}
        </div>
      )}

      {/* History */}
      {historyPlans.length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            Histórico
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historyPlans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                corPrimaria={corPrimaria}
                isGestor={isGestor}
                isCurrent={false}
                onView={handleView}
                onDownload={handleDownload}
                onArchive={handleArchive}
              />
            ))}
          </div>
        </div>
      )}

      {/* Publish modal */}
      {showModal && (
        <PublishModal
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          weekEnd={weekEnd}
          setWeekEnd={setWeekEnd}
          file={file}
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleDrop={handleDrop}
          handleFile={handleFile}
          fileRef={fileRef}
          error={formError}
          uploading={uploading}
          onPublish={handlePublish}
          onClose={() => setShowModal(false)}
          corPrimaria={corPrimaria}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: corPrimaria, color: "#1C1B18", padding: "10px 24px",
          borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)", fontFamily: SANS,
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
