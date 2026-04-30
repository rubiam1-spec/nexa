import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useThirdPartyProperty, updateProperty, uploadPropertyPhoto, uploadPropertyDocument, approveProperty, rejectProperty, requestRevision, resubmitProperty } from "../hooks/useThirdPartyProperties";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { getQuartoInfo, getBanheiroInfo, getDetailPills, getAreaInfo, getVagaInfo, getEntregaInfo } from "../utils/propertyDisplayHelpers";
import { RegistrationModal } from "../../atividades/pages/AtividadesPage";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

const MANAGER_ROLES = new Set(["owner", "director", "manager"]);

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)" };
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  cadastrado: { label: "Cadastrado", color: "#706B5F" }, disponivel: { label: "Disponível", color: "#4ADE80" },
  em_negociacao: { label: "Em negociação", color: "#60A5FA" }, reservado: { label: "Reservado", color: "#FBBF24" },
  vendido: { label: "Vendido", color: "#A78BFA" }, inativo: { label: "Inativo", color: "#F87171" },
};
const TIPO_LABELS: Record<string, string> = { terreno: "Terreno", casa: "Casa", apartamento: "Apartamento", chacara: "Chácara", fazenda: "Fazenda", comercial: "Comercial", sala: "Sala", galpao: "Galpão", outro: "Outro" };
const ORIGEM_LABELS: Record<string, string> = { permuta: "Permuta", aquisicao: "Aquisição", outro: "Outro" };
const DOC_TIPOS: [string, string][] = [["matricula", "Matrícula"], ["escritura", "Escritura"], ["iptu", "IPTU"], ["laudo_avaliacao", "Laudo"], ["contrato", "Contrato"], ["procuracao", "Procuração"], ["certidao", "Certidão"], ["outro", "Outro"]];

type Activity = { id: string; title: string; type: string; activity_date: string; start_time: string | null; status: string; profile?: { full_name: string } | null };

export default function ThirdPartyPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const { development } = useDevelopment();
  const developmentId = development?.developmentId ?? null;
  const canManage = ["owner", "director", "manager", "concierge"].includes((account?.role as string) ?? "");
  const userId = authenticatedProfile?.id ?? null;
  const { property: p, loading, refetch } = useThirdPartyProperty(id ?? null, accountId);

  const role = (account?.role as string) ?? "";
  const isManagerRole = MANAGER_ROLES.has(role);

  // State
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusMenu, setStatusMenu] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [docTipo, setDocTipo] = useState("outro");
  const [docNome, setDocNome] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [mobilePhotoIdx, setMobilePhotoIdx] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState<"reject" | "revision" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  // Pick up toast from query param (e.g. after create)
  useEffect(() => {
    const t = searchParams.get("toast");
    if (t) { setToast(t); searchParams.delete("toast"); setSearchParams(searchParams, { replace: true }); }
  }, []);

  // Fetch activities for this property
  const fetchActivities = useCallback(async () => {
    if (!supabase || !id) { setActivitiesLoading(false); return; }
    setActivitiesLoading(true);
    try {
      const { data } = await supabase.from("activities").select("id, title, type, activity_date, start_time, status, profiles!activities_profile_id_fkey(full_name)").eq("third_party_property_id", id).order("activity_date", { ascending: false }).order("start_time", { ascending: false }).limit(10);
      setActivities((data ?? []).map((a: Record<string, unknown>) => {
        const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return { id: a.id as string, title: a.title as string, type: a.type as string, activity_date: a.activity_date as string, start_time: a.start_time as string | null, status: a.status as string, profile: prof ? { full_name: (prof as Record<string, unknown>).full_name as string } : null };
      }));
    } catch { /* column may not exist yet */ }
    setActivitiesLoading(false);
  }, [id]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  // Handlers
  async function handlePhotoUpload(file: File) {
    if (!id || !accountId) return;
    setUploading(true);
    try { await uploadPropertyPhoto(id, accountId, file); setToast("Foto adicionada"); refetch(); }
    catch (e) { setToast(e instanceof Error ? e.message : "Erro no upload"); }
    finally { setUploading(false); }
  }
  async function handleDocUpload(file: File) {
    if (!id || !accountId) return;
    setUploading(true);
    try { await uploadPropertyDocument(id, accountId, file, docTipo, docNome.trim() || file.name); setToast("Documento adicionado"); setDocModal(false); setDocNome(""); refetch(); }
    catch (e) { setToast(e instanceof Error ? e.message : "Erro no upload"); }
    finally { setUploading(false); }
  }
  async function handleStatusChange(newStatus: string) {
    if (!id) return;
    try { await updateProperty(id, { status: newStatus }); setToast(`Status: ${STATUS_CFG[newStatus]?.label || newStatus}`); setStatusMenu(false); refetch(); }
    catch (e) { setToast(e instanceof Error ? e.message : "Erro"); }
  }
  async function handleApprove() {
    if (!id || !userId) return;
    try { await approveProperty(id, userId); setToast("Imóvel aprovado ✓"); refetch(); } catch (e) { setToast(e instanceof Error ? e.message : "Erro"); }
  }
  async function handleRejectOrRevision() {
    if (!id || !userId || !approvalModal || approvalNotes.trim().length < 10) return;
    try {
      if (approvalModal === "reject") await rejectProperty(id, userId, approvalNotes.trim());
      else await requestRevision(id, userId, approvalNotes.trim());
      setToast(approvalModal === "reject" ? "Imóvel rejeitado" : "Revisão solicitada"); setApprovalModal(null); setApprovalNotes(""); refetch();
    } catch (e) { setToast(e instanceof Error ? e.message : "Erro"); }
  }
  async function handleResubmit() {
    if (!id) return;
    try { await resubmitProperty(id); setToast("Reenviado para aprovação ✓"); refetch(); } catch (e) { setToast(e instanceof Error ? e.message : "Erro"); }
  }
  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const profileId = authenticatedProfile?.id || "";
    const path = p?.slug ? `/p/${p.slug}` : `/imoveis/ver/${id}`;
    const url = `${window.location.origin}${path}${profileId ? `?ref=${profileId}` : ""}`;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(url).then(() => setToast("Link copiado ✓")).catch(() => { fallbackCopy(url); });
    } else { fallbackCopy(url); }
  }
  function fallbackCopy(text: string) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setToast("Link copiado ✓"); } catch { setToast("Erro ao copiar"); }
    document.body.removeChild(ta);
  }

  // Mobile swipe
  const touchStart = useRef(0);
  function onTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent, count: number) {
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (dx < -50 && mobilePhotoIdx < count - 1) setMobilePhotoIdx(mobilePhotoIdx + 1);
    if (dx > 50 && mobilePhotoIdx > 0) setMobilePhotoIdx(mobilePhotoIdx - 1);
  }

  // Loading / empty
  if (loading) return <div className="nexa-page-enter" style={{ maxWidth: 960, margin: "0 auto" }}><div className="nexa-skeleton" style={{ height: 340, borderRadius: 12, marginBottom: 20 }} /><div className="nexa-skeleton" style={{ height: 24, width: 200, marginBottom: 12 }} /><div className="nexa-skeleton nexa-skeleton-text" /></div>;
  if (!p) return <div style={{ padding: 40, textAlign: "center" }}><div style={{ fontSize: 14, color: T.fog }}>Imóvel não encontrado.</div><button type="button" onClick={() => navigate("/imoveis")} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← Voltar</button></div>;

  const st = STATUS_CFG[p.status] || STATUS_CFG.cadastrado;
  const photos = p.photos || [];
  const docs = p.documents || [];

  // Build characteristics cards (only filled fields)
  const chars: { value: string; label: string; sub?: string }[] = [];
  const isRural = p.tipo === "chacara" || p.tipo === "fazenda";
  if (isRural && p.areaHectares) chars.push({ value: `${p.areaHectares}`, label: "hectares" });
  // Area: use smart helper for casa/apto, fallback for others
  const areaInfo = getAreaInfo(p.areaPrivativa, p.areaConstruida, p.areaM2, p.areaComum);
  if (areaInfo && !isRural) chars.push(areaInfo);
  if (isRural && p.areaConstruida) chars.push({ value: `${p.areaConstruida}`, label: "m² construído" });
  if (p.areaTerreno) chars.push({ value: `${p.areaTerreno}`, label: "m² terreno" });
  if (!areaInfo && !isRural && !p.areaTerreno && p.areaM2) chars.push({ value: `${p.areaM2}`, label: "m²" });
  if (p.quartos) { const qi = getQuartoInfo(p.quartos, p.suites, p.suiteMaster, p.closet); chars.push({ value: `${qi.total}`, label: qi.total > 1 ? "quartos" : "quarto", sub: qi.subInfo || undefined }); }
  if (p.banheiros || p.suites) { const bi = getBanheiroInfo(p.banheiros, p.suites, p.lavabo, p.banheira); if (bi.total > 0) chars.push({ value: `${bi.total}`, label: bi.total > 1 ? "banheiros" : "banheiro", sub: bi.subInfo || undefined }); }
  if (p.vagasGaragem) { const vi = getVagaInfo(p.vagasGaragem, p.vagasTipo); chars.push({ value: `${vi.total}`, label: vi.total > 1 ? "vagas" : "vaga", sub: vi.subInfo || undefined }); }
  if (p.andar) chars.push({ value: `${p.andar}º`, label: "andar" });
  const entrega = getEntregaInfo(p.anoConstrucao, p.previsaoEntrega);
  if (entrega) chars.push({ value: entrega.value, label: entrega.label });
  if (p.tipo === "terreno") {
    if (p.frente) chars.push({ value: `${p.frente}m`, label: "frente" });
    if (p.fundo) chars.push({ value: `${p.fundo}m`, label: "fundo" });
    if (p.topografia) chars.push({ value: p.topografia, label: "topografia" });
  }
  if (isRural) {
    if (p.acesso) chars.push({ value: p.acesso, label: "acesso" });
    if (p.fonteAgua) chars.push({ value: p.fonteAgua, label: "fonte água" });
  }

  // Infrastructure pills
  const infra: string[] = [];
  if (p.possuiAgua) infra.push("Água");
  if (p.possuiLuz || p.possuiEnergia) infra.push("Energia");
  if (p.possuiEsgoto) infra.push("Esgoto");
  if (p.possuiAsfalto) infra.push("Asfalto");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 20, fontSize: 12 }}>
        <a href="/imoveis" style={{ color: T.fog, textDecoration: "none" }}>Imóveis de Terceiros</a>
        <span style={{ color: T.slate }}>›</span>
        <span style={{ color: T.bone }}>{p.titulo}</span>
      </nav>

      {/* ═══ APPROVAL BANNER ═══ */}
      {p.approvalStatus === "pending" && (
        <div style={{ padding: "12px 20px", borderRadius: 8, marginBottom: 16, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#FBBF24" }}>Aguardando aprovação</div>
            <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>Este imóvel precisa ser aprovado antes de ficar visível para os corretores.</div>
          </div>
          {isManagerRole && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={handleApprove} style={{ padding: "8px 16px", borderRadius: 6, background: T.sprout, color: "#12110F", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>Aprovar</button>
              <button type="button" onClick={() => setApprovalModal("revision")} style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", color: "#60A5FA", border: "1px solid #60A5FA", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>Pedir revisão</button>
              <button type="button" onClick={() => setApprovalModal("reject")} style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", color: "#F87171", border: "1px solid #F87171", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>Rejeitar</button>
            </div>
          )}
        </div>
      )}
      {p.approvalStatus === "rejected" && (
        <div style={{ padding: "12px 20px", borderRadius: 8, marginBottom: 16, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#F87171" }}>Rejeitado</div>
          {p.approvalNotes && <div style={{ fontSize: 12, color: "#C4BFB3", marginTop: 2 }}>Motivo: {p.approvalNotes}</div>}
          <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{p.approvedByName ? `Por ${p.approvedByName}` : ""}{p.approvedAt ? ` em ${formatDateBRT(p.approvedAt)}` : ""}</div>
          {p.createdBy === userId && <button type="button" onClick={handleResubmit} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, background: T.sprout, color: "#12110F", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>Reenviar para aprovação</button>}
        </div>
      )}
      {p.approvalStatus === "revision" && (
        <div style={{ padding: "12px 20px", borderRadius: 8, marginBottom: 16, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#60A5FA" }}>Em revisão</div>
          {p.approvalNotes && <div style={{ fontSize: 12, color: "#C4BFB3", marginTop: 2 }}>{p.approvalNotes}</div>}
          <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{p.approvedByName ? `Solicitado por ${p.approvedByName}` : ""}{p.approvedAt ? ` em ${formatDateBRT(p.approvedAt)}` : ""}</div>
          {p.createdBy === userId && <button type="button" onClick={handleResubmit} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, background: T.sprout, color: "#12110F", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>Reenviar para aprovação</button>}
        </div>
      )}

      {/* ═══ GALERIA (full width) ═══ */}
      {isMobile ? (
        /* Mobile: carousel */
        photos.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ borderRadius: 8, overflow: "hidden", position: "relative", aspectRatio: "16/10" }} onTouchStart={onTouchStart} onTouchEnd={(e) => onTouchEnd(e, photos.length)}>
              <img src={photos[mobilePhotoIdx].fileUrl} alt="" onClick={() => setLightboxIdx(mobilePhotoIdx)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }} />
              <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.7)", color: "#FAF9F6", fontSize: 11, padding: "4px 10px", borderRadius: 6, fontFamily: "var(--font-mono)" }}>{photos.length} fotos</div>
              {canManage && <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading} style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(18,17,15,0.85)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: "6px 12px", color: T.bone, fontSize: 11, cursor: "pointer", minHeight: 44 }}>{uploading ? "..." : "+ Foto"}</button>}
            </div>
            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {photos.map((_, i) => <div key={i} onClick={() => setMobilePhotoIdx(i)} style={{ width: 8, height: 8, borderRadius: 4, background: i === mobilePhotoIdx ? T.sprout : "var(--surface-overlay)", cursor: "pointer", transition: "background 150ms" }} />)}
            </div>
          </div>
        ) : <GalleryEmpty canManage={canManage} onAdd={() => photoRef.current?.click()} />
      ) : (
        /* Desktop: Loft grid */
        photos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: photos.length === 1 ? "1fr" : photos.length === 2 ? "2fr 1fr" : "1.5fr 1fr", gridTemplateRows: photos.length >= 3 ? "1fr 1fr" : "auto", gap: 4, borderRadius: 12, overflow: "hidden", marginBottom: 24, cursor: "pointer", position: "relative", maxHeight: 420 }}>
            <div onClick={() => setLightboxIdx(0)} style={{ gridRow: photos.length >= 3 ? "1 / 3" : undefined, aspectRatio: photos.length === 1 ? "16/10" : undefined, minHeight: photos.length >= 2 ? 320 : undefined, background: `url(${photos[0].fileUrl}) center/cover`, position: "relative" }}>
              <span style={{ position: "absolute", top: 12, left: 12, background: T.sprout, color: "#12110F", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 4, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>CAPA</span>
            </div>
            {photos.slice(1, 3).map((ph, i) => (
              <div key={ph.id} onClick={() => setLightboxIdx(i + 1)} style={{ background: `url(${ph.fileUrl}) center/cover`, position: "relative", minHeight: 158 }}>
                {i === 1 && photos.length > 3 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FAF9F6", fontSize: 15, fontWeight: 600 }}>+{photos.length - 3} fotos</div>}
              </div>
            ))}
            <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.7)", color: "#FAF9F6", fontSize: 12, padding: "5px 12px", borderRadius: 6, fontFamily: "var(--font-mono)" }}>{photos.length} fotos</div>
            {canManage && <button type="button" onClick={(e) => { e.stopPropagation(); photoRef.current?.click(); }} disabled={uploading} style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(18,17,15,0.85)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 14px", color: T.bone, fontSize: 12, cursor: "pointer", backdropFilter: "blur(8px)", zIndex: 1 }}>{uploading ? "..." : "+ Foto"}</button>}
          </div>
        ) : <GalleryEmpty canManage={canManage} onAdd={() => photoRef.current?.click()} />
      )}
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />

      {/* ═══ 2 COLUMNS ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Badges + Title + Address */}
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "3px 10px", borderRadius: 6, background: st.color + "15", color: st.color }}>{st.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "3px 10px", borderRadius: 6, background: "var(--surface-overlay)", color: T.fog }}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "3px 10px", borderRadius: 6, background: "rgba(217,119,6,0.08)", color: "#D97706" }}>{ORIGEM_LABELS[p.origem] || p.origem}</span>
            </div>
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: T.bone, margin: "0 0 8px", lineHeight: 1.2 }}>{p.titulo}</h1>
            {(p.endereco || p.bairro || p.cidade) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.fog }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {[p.endereco, p.bairro, p.cidade ? `${p.cidade}/${p.estado}` : null].filter(Boolean).join(", ")}
              </div>
            )}
          </div>

          {/* Characteristics cards */}
          {chars.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {chars.map((c) => (
                <div key={c.label} style={{ textAlign: "center", padding: "12px 16px", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, minWidth: 72 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: T.chalk }}>{c.value}</div>
                  <div style={{ fontSize: 10, color: T.slate, marginTop: 3 }}>{c.label}</div>
                  {c.sub && <div style={{ fontSize: 9, color: T.sprout, marginTop: 2 }}>{c.sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Infrastructure pills */}
          {/* Detail pills */}
          {(() => { const details = getDetailPills(p.suiteMaster, p.closet, p.banheira); return details.length > 0 ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{details.map((d) => <span key={d} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(74,222,128,0.06)", color: T.sprout, border: "1px solid rgba(74,222,128,0.12)" }}>{d}</span>)}</div> : null; })()}

          {infra.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {infra.map((i) => <span key={i} style={{ fontSize: 12, color: T.sprout, padding: "4px 10px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 6 }}>✓ {i}</span>)}
            </div>
          )}

          {/* Description */}
          {p.descricao && (
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Descrição</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: T.fog, whiteSpace: "pre-wrap" }}>{p.descricao}</div>
            </div>
          )}

          {/* Documents */}
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase" }}>Documentos ({docs.length})</div>
              {canManage && <button type="button" onClick={() => setDocModal(true)} style={{ fontSize: 12, color: T.sprout, background: "none", border: "none", cursor: "pointer" }}>+ Adicionar</button>}
            </div>
            {docs.length === 0 ? <div style={{ fontSize: 13, color: T.slate }}>Nenhum documento.</div> : docs.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.stone}` }}>
                <span style={{ fontSize: 16 }}>{d.tipo === "outro" || !d.nome.toLowerCase().endsWith(".pdf") ? "🖼" : "📄"}</span>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", color: T.sprout, background: "rgba(74,222,128,0.08)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{DOC_TIPOS.find(([k]) => k === d.tipo)?.[1] || d.tipo}</span>
                <div style={{ flex: 1, fontSize: 13, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</div>
                <a href={d.fileUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: T.sprout, textDecoration: "none", padding: "4px 8px", minHeight: 44, display: "flex", alignItems: "center" }}>Abrir ↗</a>
              </div>
            ))}
          </div>

          {/* Matrícula */}
          {p.matricula && <div style={{ fontSize: 12, color: T.slate, fontFamily: "var(--font-mono)" }}>Matrícula: {p.matricula}</div>}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Value card */}
          <div style={{ background: "#1C1B18", border: `1px solid ${T.stone}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.sprout, marginBottom: 8 }}>Valor de venda</div>
            {p.valorVenda != null && p.valorVenda > 0 ? (
              <>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: T.sprout, marginBottom: 4 }}>{fmt(p.valorVenda)}</div>
                {p.valorAvaliado != null && p.valorAvaliado > 0 && <div style={{ fontSize: 12, color: T.fog, marginBottom: 12 }}>Avaliado em {fmt(p.valorAvaliado)}</div>}
                {p.descontoAvistaPct > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)" }}>
                    <span style={{ fontSize: 12, color: T.sprout }}>À vista ({p.descontoAvistaPct}% desc.)</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: T.sprout, marginLeft: "auto" }}>{fmt(p.valorVenda * (1 - p.descontoAvistaPct / 100))}</span>
                  </div>
                )}
              </>
            ) : <div style={{ fontSize: 14, color: T.slate }}>Valor a definir</div>}
          </div>

          {/* Conditions card */}
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Condições autorizadas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: T.fog }}>
              {p.entradaMinimaPct > 0 && <div>Entrada mínima: <strong style={{ color: T.bone }}>{p.entradaMinimaPct}%</strong></div>}
              {p.parcelasMax > 1 && <div>Parcelas: até <strong style={{ color: T.bone }}>{p.parcelasMax}×</strong></div>}
              <div>Financiamento: <strong style={{ color: p.aceitaFinanciamento ? T.sprout : T.slate }}>{p.aceitaFinanciamento ? "Sim" : "Não"}</strong></div>
              <div>Permuta: <strong style={{ color: p.aceitaPermuta ? T.sprout : T.slate }}>{p.aceitaPermuta ? "Sim" : "Não"}</strong></div>
              {p.condominioValor != null && p.condominioValor > 0 && <div>Condomínio: <strong style={{ color: T.bone }}>{fmt(p.condominioValor)}/mês</strong>{p.condominioNome ? ` · ${p.condominioNome}` : ""}</div>}
              {p.iptuValor != null && p.iptuValor > 0 && <div>IPTU: <strong style={{ color: T.bone }}>{fmt(p.iptuValor)}/ano</strong></div>}
              {p.observacoesComerciais && <div style={{ marginTop: 4, paddingTop: 8, borderTop: `1px solid ${T.stone}`, fontSize: 12, color: T.slate }}>{p.observacoesComerciais}</div>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" onClick={() => navigate(`/simulador?tipo=imovel_terceiro&property_id=${p.id}`)} disabled={p.approvalStatus !== "approved"} title={p.approvalStatus !== "approved" ? "Imóvel aguardando aprovação" : undefined} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: T.sprout, color: "var(--interactive-on-primary)", border: "none", fontSize: 14, fontWeight: 600, cursor: p.approvalStatus !== "approved" ? "not-allowed" : "pointer", minHeight: 44, opacity: p.approvalStatus !== "approved" ? 0.4 : 1 }}>Simular proposta</button>
            <button type="button" onClick={() => navigate(`/negociacoes`)} disabled={p.approvalStatus !== "approved"} title={p.approvalStatus !== "approved" ? "Imóvel aguardando aprovação" : undefined} style={{ width: "100%", padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: p.approvalStatus !== "approved" ? "not-allowed" : "pointer", minHeight: 44, opacity: p.approvalStatus !== "approved" ? 0.4 : 1 }}>Criar negociação</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setActivityModalOpen(true)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minHeight: 44 }}>Registrar atividade</button>
              <button type="button" onClick={handleShare} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minHeight: 44 }}>Compartilhar</button>
            </div>
          </div>

          {/* Manage actions */}
          {canManage && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "relative" }}>
              <button type="button" onClick={() => navigate(`/imoveis/${p.id}/editar`)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minHeight: 44 }}>Editar</button>
              <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setStatusMenu(!statusMenu)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minHeight: 44 }}>Alterar status ▾</button>
                {statusMenu && <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setStatusMenu(false)} />
                  <div className="nexa-dropdown-enter" style={{ position: "absolute", top: 44, left: 0, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, zIndex: 50, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                    {["cadastrado", "disponivel", "em_negociacao", "reservado", "vendido", "inativo"].filter((s) => s !== p.status).map((s) => {
                      const sc = STATUS_CFG[s]; return <button key={s} type="button" onClick={() => handleStatusChange(s)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: sc?.color || T.bone, fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>{sc?.label || s}</button>;
                    })}
                  </div>
                </>}
              </div>
            </div>
          )}

          {/* Created by */}
          <div style={{ fontSize: 11, color: T.slate, textAlign: "center", paddingTop: 8 }}>
            Cadastrado em {formatDateBRT(p.createdAt)}
            {p.corretorNome && ` · por ${p.corretorNome}`}
          </div>
        </div>
      </div>

      {/* ═══ ATIVIDADES RECENTES (full width) ═══ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: T.sprout, letterSpacing: "0.14em", textTransform: "uppercase" }}>Atividades</div>
          <button type="button" onClick={() => navigate("/atividades")} style={{ fontSize: 12, color: T.sprout, background: "none", border: "none", cursor: "pointer" }}>+ Registrar atividade</button>
        </div>
        {activitiesLoading ? (
          <div className="nexa-skeleton" style={{ height: 60, borderRadius: 8 }} />
        ) : activities.length === 0 ? (
          <div style={{ padding: "24px 16px", border: `1px dashed ${T.stone}`, borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: T.slate, marginBottom: 8 }}>Nenhuma atividade registrada para este imóvel.</div>
            <button type="button" onClick={() => navigate("/atividades")} style={{ fontSize: 12, color: T.sprout, background: "none", border: "none", cursor: "pointer" }}>Registrar primeira atividade</button>
          </div>
        ) : (
          <div style={{ paddingLeft: 4 }}>
            {activities.map((a, i) => {
              const isRecent = (Date.now() - new Date(a.activity_date).getTime()) < 864e5;
              return (
                <div key={a.id} style={{ borderLeft: `2px solid ${T.stone}`, paddingLeft: 20, paddingBottom: 16, position: "relative", animation: `fadeInUp 200ms cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${i * 40}ms` }}>
                  <div style={{ position: "absolute", left: -5, top: 4, width: 8, height: 8, borderRadius: 4, background: isRecent ? T.sprout : "#3D3A30" }} />
                  <div style={{ fontSize: 13, color: T.bone }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: T.slate, marginTop: 2 }}>
                    {a.profile?.full_name || "—"} · {formatDateBRT(a.activity_date)}
                    {a.start_time && ` às ${a.start_time.slice(0, 5)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ LIGHTBOX ═══ */}
      {lightboxIdx != null && photos.length > 0 && <PropertyLightbox photos={photos} currentIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} onNavigate={setLightboxIdx} />}

      {/* Approval modal (reject/revision) */}
      {approvalModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => { setApprovalModal(null); setApprovalNotes(""); }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 440, maxWidth: "90vw", zIndex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: approvalModal === "reject" ? "#F87171" : "#60A5FA", margin: "0 0 16px" }}>{approvalModal === "reject" ? "Rejeitar imóvel" : "Solicitar revisão"}</h3>
            <label style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>MOTIVO *</label>
            <textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} rows={4} placeholder="Descreva o motivo (mín. 10 caracteres)..." style={{ width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, marginBottom: 16, boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={handleRejectOrRevision} disabled={approvalNotes.trim().length < 10} style={{ flex: 1, padding: "10px", borderRadius: 8, background: approvalModal === "reject" ? "#F87171" : "#60A5FA", color: "#12110F", border: "none", fontSize: 13, fontWeight: 600, cursor: approvalNotes.trim().length < 10 ? "not-allowed" : "pointer", opacity: approvalNotes.trim().length < 10 ? 0.5 : 1 }}>Confirmar</button>
              <button type="button" onClick={() => { setApprovalModal(null); setApprovalNotes(""); }} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Doc upload modal */}
      {docModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setDocModal(false)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw", zIndex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: "0 0 16px" }}>Adicionar documento</h3>
            <label style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>TIPO</label>
            <select value={docTipo} onChange={(e) => setDocTipo(e.target.value)} style={{ width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, marginBottom: 12 }}>{DOC_TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <label style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>NOME</label>
            <input value={docNome} onChange={(e) => setDocNome(e.target.value)} placeholder="Nome do documento" style={{ width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, marginBottom: 16, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => docRef.current?.click()} disabled={uploading} style={{ flex: 1, padding: "10px", borderRadius: 8, background: T.sprout, color: "var(--interactive-on-primary)", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{uploading ? "Enviando..." : "Selecionar arquivo"}</button>
              <button type="button" onClick={() => setDocModal(false)} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            </div>
            <input ref={docRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ""; }} />
          </div>
        </div>, document.body
      )}

      {/* Activity registration modal */}
      {activityModalOpen && accountId && developmentId && userId && p && (
        <RegistrationModal accountId={accountId} developmentId={developmentId} profileId={userId} thirdPartyPropertyId={p.id} thirdPartyPropertyTitle={p.titulo} onClose={() => setActivityModalOpen(false)} onSaved={() => { setActivityModalOpen(false); setToast("Atividade registrada ✓"); fetchActivities(); }} />
      )}

      {/* Toast */}
      {toast && (() => { setTimeout(() => setToast(null), 3000); return <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: "var(--interactive-on-primary)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", animation: "fadeInUp 200ms ease both" }}>{toast}</div>; })()}
    </div>
  );
}

// ═══ SUBCOMPONENTS ═══

function GalleryEmpty({ canManage, onAdd }: { canManage: boolean; onAdd: () => void }) {
  return (
    <div style={{ aspectRatio: "16/8", background: "#1C1B18", border: "2px dashed var(--border-default)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#706B5F", gap: 8, marginBottom: 24 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#706B5F" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
      <span style={{ fontSize: 14 }}>Nenhuma foto cadastrada</span>
      {canManage && <button type="button" onClick={onAdd} style={{ fontSize: 12, color: "var(--interactive-primary)", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>Adicionar fotos</button>}
    </div>
  );
}

function PropertyLightbox({ photos, currentIndex, onClose, onNavigate }: { photos: { id: string; fileUrl: string; legenda: string | null }[]; currentIndex: number; onClose: () => void; onNavigate: (i: number) => void }) {
  const touchX = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, photos.length, onNavigate, onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 200ms ease both" }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -50 && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
        if (dx > 50 && currentIndex > 0) onNavigate(currentIndex - 1);
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", zIndex: 1 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#FAF9F6" }}>{currentIndex + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "none", color: "#FAF9F6", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>

      {/* Photo */}
      <img src={photos[currentIndex].fileUrl} alt="" style={{ maxWidth: "90vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 4 }} />

      {/* Legend */}
      {photos[currentIndex].legenda && <div style={{ fontSize: 13, color: "#9C9686", marginTop: 12 }}>{photos[currentIndex].legenda}</div>}

      {/* Arrows */}
      {currentIndex > 0 && <button type="button" onClick={() => onNavigate(currentIndex - 1)} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "none", color: "#FAF9F6", fontSize: 22, cursor: "pointer" }}>‹</button>}
      {currentIndex < photos.length - 1 && <button type="button" onClick={() => onNavigate(currentIndex + 1)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "none", color: "#FAF9F6", fontSize: 22, cursor: "pointer" }}>›</button>}

      {/* Thumbnails strip */}
      <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", gap: 4, justifyContent: "center", overflowX: "auto", padding: "0 16px" }}>
        {photos.map((ph, i) => (
          <img key={ph.id} src={ph.fileUrl} alt="" onClick={() => onNavigate(i)} style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", flexShrink: 0, border: i === currentIndex ? "2px solid var(--interactive-primary)" : "2px solid transparent", opacity: i === currentIndex ? 1 : 0.5, transition: "all 150ms" }} />
        ))}
      </div>
    </div>
  );
}
