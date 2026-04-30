import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { useIsMobile } from "../shared/hooks/useIsMobile";
import { getQuartoInfo, getBanheiroInfo, getDetailPills, getAreaInfo, getVagaInfo, getEntregaInfo } from "../modules/imoveis/utils/propertyDisplayHelpers";

// Anon client — no auth session, forces anon role for RLS
const anonClient = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? "",
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const TIPO_LABELS: Record<string, string> = { terreno: "Terreno", casa: "Casa", apartamento: "Apartamento", chacara: "Chácara", fazenda: "Fazenda", comercial: "Comercial", sala: "Sala", galpao: "Galpão", outro: "Outro" };
const LOGO = "https://jwosbkpxbxwobrxliemj.supabase.co/storage/v1/object/public/logos/nexa-lockup-horizontal-dark.png";

type Property = {
  titulo: string; tipo: string; status: string; origem: string;
  endereco: string | null; bairro: string | null; cidade: string | null; estado: string | null;
  area_m2: number | null; area_construida: number | null; area_terreno: number | null; area_hectares: number | null; area_privativa: number | null; area_comum: number | null;
  quartos: number | null; suites: number | null; banheiros: number | null; vagas_garagem: number | null;
  suite_master: boolean; closet: boolean; banheira: boolean; lavabo: boolean;
  vagas_tipo: string | null; previsao_entrega: string | null;
  andar: number | null; ano_construcao: number | null; descricao: string | null;
  valor_venda: number | null; valor_avaliado: number | null;
  desconto_avista_pct: number; entrada_minima_pct: number; parcelas_max: number;
  aceita_financiamento: boolean; aceita_permuta: boolean; foto_principal_url: string | null;
};
type Photo = { id: string; file_url: string; legenda: string | null; ordem: number };

function LogoImg({ h, opacity }: { h: number; opacity?: number }) {
  return <img src={LOGO} alt="NEXA" style={{ height: h, opacity: opacity ?? 1 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
}

function WhatsAppIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="#12110F"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.29-1.24l-.3-.18-3.12.82.83-3.04-.2-.31A8 8 0 1112 20z"/></svg>;
}

export default function PublicPropertyPage() {
  const params = useParams<{ id: string; slug: string }>();
  const id = params.id || null;
  const slug = params.slug || null;
  const [searchParams] = useSearchParams();
  const refProfileId = searchParams.get("ref");

  const [property, setProperty] = useState<Property | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sharedBy, setSharedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [mobileIdx, setMobileIdx] = useState(0);
  const touchX = useRef(0);

  const isMobile = useIsMobile();

  useEffect(() => {
    if (!anonClient || (!id && !slug)) { setNotFound(true); setLoading(false); return; }
    (async () => {
      let query = anonClient.from("third_party_properties").select("id, titulo, tipo, status, origem, endereco, bairro, cidade, estado, area_m2, area_construida, area_terreno, area_hectares, area_privativa, area_comum, quartos, suites, banheiros, vagas_garagem, vagas_tipo, andar, ano_construcao, previsao_entrega, descricao, valor_venda, valor_avaliado, desconto_avista_pct, entrada_minima_pct, parcelas_max, aceita_financiamento, aceita_permuta, foto_principal_url, approval_status, suite_master, closet, banheira, lavabo, slug");
      if (slug) query = query.eq("slug", slug);
      else if (id) query = query.eq("id", id);
      const { data: prop, error } = await query.maybeSingle();
      if (error) console.error("[NEXA Public] Query error:", error.message);
      if (error || !prop || prop.approval_status !== "approved") { setNotFound(true); setLoading(false); return; }
      setProperty(prop as Property);
      document.title = `${prop.titulo} — NEXA`;
      const propId = prop.id || id;
      const { data: ph } = await anonClient.from("third_party_property_photos").select("id, file_url, legenda, ordem").eq("property_id", propId).order("ordem");
      setPhotos((ph ?? []) as Photo[]);
      if (refProfileId) {
        const { data: prof } = await anonClient.from("profiles").select("full_name").eq("id", refProfileId).maybeSingle();
        if (prof) setSharedBy((prof as { full_name: string }).full_name);
      }
      setLoading(false);
    })();
  }, [id, refProfileId]);

  // Loading skeleton
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#12110F", fontFamily: "'Outfit', -apple-system, sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ height: 28, width: 120, background: "#1C1B18", borderRadius: 6, marginBottom: 24 }} />
        <div style={{ aspectRatio: "21/9", background: "#1C1B18", borderRadius: 12, marginBottom: 24, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 24 }}>
          <div><div style={{ height: 20, width: 80, background: "#1C1B18", borderRadius: 6, marginBottom: 12 }} /><div style={{ height: 32, width: 300, background: "#1C1B18", borderRadius: 6, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} /><div style={{ height: 16, width: 240, background: "#1C1B18", borderRadius: 6 }} /></div>
          <div><div style={{ height: 140, background: "#1C1B18", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} /></div>
        </div>
      </div>
    </div>
  );

  // Not found
  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#12110F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', -apple-system, sans-serif", padding: 24 }}>
      <LogoImg h={32} />
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "#E8E5DE", margin: "24px 0 8px" }}>Imóvel não encontrado</h1>
      <p style={{ fontSize: 14, color: "#9C9686", margin: 0, textAlign: "center" }}>Este imóvel não está mais disponível ou o link é inválido.</p>
    </div>
  );

  const p = property!;
  const valorVenda = p.valor_venda ? Number(p.valor_venda) : 0;

  // Characteristics
  const chars: { value: string; label: string; sub?: string }[] = [];
  const isRural = p.tipo === "chacara" || p.tipo === "fazenda";
  if (isRural && p.area_hectares) chars.push({ value: `${Number(p.area_hectares)}`, label: "hectares" });
  const areaInfo = getAreaInfo(p.area_privativa ? Number(p.area_privativa) : null, p.area_construida ? Number(p.area_construida) : null, p.area_m2 ? Number(p.area_m2) : null, p.area_comum ? Number(p.area_comum) : null);
  if (areaInfo && !isRural) chars.push(areaInfo);
  if (isRural && p.area_construida) chars.push({ value: `${Number(p.area_construida)}`, label: "m² construído" });
  if (p.area_terreno) chars.push({ value: `${Number(p.area_terreno)}`, label: "m² terreno" });
  if (!areaInfo && !isRural && !p.area_terreno && p.area_m2) chars.push({ value: `${Number(p.area_m2)}`, label: "m²" });
  if (p.quartos) { const qi = getQuartoInfo(Number(p.quartos), p.suites ? Number(p.suites) : null, !!p.suite_master, !!p.closet); chars.push({ value: `${qi.total}`, label: qi.total > 1 ? "quartos" : "quarto", sub: qi.subInfo || undefined }); }
  if (p.banheiros || p.suites) { const bi = getBanheiroInfo(p.banheiros ? Number(p.banheiros) : null, p.suites ? Number(p.suites) : null, !!p.lavabo, !!p.banheira); if (bi.total > 0) chars.push({ value: `${bi.total}`, label: bi.total > 1 ? "banheiros" : "banheiro", sub: bi.subInfo || undefined }); }
  if (p.vagas_garagem) { const vi = getVagaInfo(Number(p.vagas_garagem), p.vagas_tipo); chars.push({ value: `${vi.total}`, label: vi.total > 1 ? "vagas" : "vaga", sub: vi.subInfo || undefined }); }
  if (p.andar) chars.push({ value: `${Number(p.andar)}º`, label: "andar" });
  const entrega = getEntregaInfo(p.ano_construcao ? Number(p.ano_construcao) : null, p.previsao_entrega);
  if (entrega) chars.push({ value: entrega.value, label: entrega.label });

  const details = getDetailPills(!!p.suite_master, !!p.closet, !!p.banheira);
  const whatsappMsg = encodeURIComponent(`Olá! Vi o imóvel "${p.titulo}" no valor de ${fmt(valorVenda)} e tenho interesse. Pode me dar mais informações?`);
  const whatsappUrl = `https://wa.me/5545999999999?text=${whatsappMsg}`;
  const addr = [p.endereco, p.bairro, p.cidade ? `${p.cidade}/${p.estado}` : null].filter(Boolean).join(", ");

  return (
    <div style={{ minHeight: "100vh", background: "#12110F", color: "#E8E5DE", fontFamily: "'Outfit', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 16px 0" : "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <LogoImg h={isMobile ? 24 : 28} />
        <span style={{ fontSize: 11, color: "#706B5F" }}>Bomm Urbanizadora</span>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 16px 80px" : 24 }}>
        {/* ═══ GALLERY ═══ */}
        {photos.length > 0 ? (
          isMobile ? (
            /* Mobile carousel */
            <div style={{ marginBottom: 24 }}>
              <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "16/10", position: "relative" }}
                onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchX.current; if (dx < -50 && mobileIdx < photos.length - 1) setMobileIdx(mobileIdx + 1); if (dx > 50 && mobileIdx > 0) setMobileIdx(mobileIdx - 1); }}>
                <img src={photos[mobileIdx].file_url} alt={p.titulo} onClick={() => setLightboxIdx(mobileIdx)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block", cursor: "pointer" }} />
                <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.7)", color: "#FAF9F6", fontSize: 11, padding: "4px 10px", borderRadius: 6, fontFamily: "monospace" }}>{photos.length} fotos</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
                {photos.map((_, i) => <div key={i} onClick={() => setMobileIdx(i)} style={{ width: 8, height: 8, borderRadius: 4, background: i === mobileIdx ? "#4ADE80" : "#3D3A30", cursor: "pointer", transition: "background 150ms" }} />)}
              </div>
            </div>
          ) : (
            /* Desktop Loft grid — using <img> tags for proper objectFit */
            <div style={{ display: "grid", gridTemplateColumns: photos.length === 1 ? "1fr" : photos.length === 2 ? "2fr 1fr" : "1.5fr 1fr", gridTemplateRows: photos.length >= 3 ? "1fr 1fr" : "auto", gap: 4, borderRadius: 12, overflow: "hidden", marginBottom: 24, position: "relative", maxHeight: 440 }}>
              {/* Hero */}
              <div onClick={() => setLightboxIdx(0)} style={{ gridRow: photos.length >= 3 ? "1 / 3" : undefined, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                <img src={photos[0].file_url} alt={p.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block", minHeight: photos.length === 1 ? undefined : 340 }} />
              </div>
              {/* Side photos */}
              {photos.slice(1, 3).map((ph, i) => (
                <div key={ph.id} onClick={() => setLightboxIdx(i + 1)} style={{ overflow: "hidden", cursor: "pointer", position: "relative", minHeight: 168 }}>
                  <img src={ph.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                  {i === 1 && photos.length > 3 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FAF9F6", fontSize: 15, fontWeight: 600 }}>+{photos.length - 3} fotos</div>}
                </div>
              ))}
              <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.7)", color: "#FAF9F6", fontSize: 12, padding: "5px 12px", borderRadius: 6, fontFamily: "monospace" }}>{photos.length} fotos</div>
            </div>
          )
        ) : p.foto_principal_url ? (
          <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24, aspectRatio: "16/10" }}>
            <img src={p.foto_principal_url} alt={p.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
          </div>
        ) : null}

        {/* ═══ 2 COLUMNS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 24 }}>
          {/* LEFT */}
          <div>
            {/* Badges */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {p.status === "disponivel" && <span style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(74,222,128,0.1)", color: "#4ADE80", fontSize: 12, fontWeight: 600 }}>Disponível</span>}
              <span style={{ padding: "4px 12px", borderRadius: 20, background: "#1C1B18", border: "1px solid #2A2822", color: "#E8E5DE", fontSize: 12 }}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: isMobile ? 22 : 28, fontWeight: 400, color: "#FAF9F6", margin: "0 0 8px", lineHeight: 1.2 }}>{p.titulo}</h1>

            {/* Address */}
            {addr && (
              <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#9C9686", margin: "0 0 20px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C9686" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                {addr}
              </p>
            )}

            {/* Characteristic cards */}
            {chars.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {chars.map((c) => (
                  <div key={c.label} style={{ textAlign: "center", padding: "14px 18px", background: "#1C1B18", border: "1px solid #2A2822", borderRadius: 8, minWidth: 80 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#E8E5DE" }}>{c.value}</div>
                    <div style={{ fontSize: 10, color: "#706B5F", marginTop: 4, letterSpacing: "0.05em" }}>{c.label}</div>
                    {c.sub && <div style={{ fontSize: 9, color: "#4ADE80", marginTop: 2 }}>{c.sub}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Detail pills */}
            {details.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {details.map((d) => <span key={d} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(74,222,128,0.06)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.12)" }}>{d}</span>)}
              </div>
            )}

            {/* Description */}
            {p.descricao && (
              <div style={{ background: "#1C1B18", border: "1px solid #2A2822", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 10, color: "#706B5F", letterSpacing: "0.15em", marginBottom: 12, fontFamily: "monospace" }}>DESCRIÇÃO</div>
                <p style={{ fontSize: 14, color: "#C4BFB3", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{p.descricao}</p>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Value card */}
            <div style={{ background: "#1C1B18", border: "1px solid #2A2822", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 10, color: "#706B5F", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "monospace" }}>VALOR DE VENDA</div>
              {valorVenda > 0 ? (
                <>
                  <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, color: "#4ADE80", marginBottom: 4 }}>{fmt(valorVenda)}</div>
                  {p.valor_avaliado && Number(p.valor_avaliado) > 0 && <div style={{ fontSize: 12, color: "#9C9686", marginBottom: 12 }}>Avaliado em {fmt(Number(p.valor_avaliado))}</div>}
                  {Number(p.desconto_avista_pct) > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)" }}>
                      <span style={{ fontSize: 12, color: "#9C9686" }}>À vista</span>
                      <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#4ADE80", marginLeft: "auto" }}>{fmt(valorVenda * (1 - Number(p.desconto_avista_pct) / 100))}</span>
                      <span style={{ fontSize: 11, color: "#4ADE80" }}>({p.desconto_avista_pct}%)</span>
                    </div>
                  )}
                </>
              ) : <div style={{ fontSize: 14, color: "#706B5F" }}>Valor a definir</div>}
            </div>

            {/* Conditions card */}
            <div style={{ background: "#1C1B18", border: "1px solid #2A2822", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 10, color: "#706B5F", letterSpacing: "0.15em", marginBottom: 10, fontFamily: "monospace" }}>CONDIÇÕES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#9C9686" }}>
                {Number(p.entrada_minima_pct) > 0 && <div>Entrada mínima: <strong style={{ color: "#E8E5DE" }}>{p.entrada_minima_pct}%</strong></div>}
                {Number(p.parcelas_max) > 1 && <div>Parcelas: até <strong style={{ color: "#E8E5DE" }}>{p.parcelas_max}×</strong></div>}
                <div>Financiamento: <strong style={{ color: p.aceita_financiamento ? "#4ADE80" : "#706B5F" }}>{p.aceita_financiamento ? "Sim" : "Não"}</strong></div>
                <div>Permuta: <strong style={{ color: p.aceita_permuta ? "#4ADE80" : "#706B5F" }}>{p.aceita_permuta ? "Sim" : "Não"}</strong></div>
              </div>
            </div>

            {/* CTA — WhatsApp */}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 24px", background: "#4ADE80", color: "#12110F", fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: "none", transition: "transform 150ms" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}>
              <WhatsAppIcon /> Tenho interesse
            </a>

            {/* Shared by */}
            {sharedBy && (
              <div style={{ padding: "16px 20px", background: "#1C1B18", border: "1px solid #2A2822", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ADE80", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                  {sharedBy.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#706B5F", marginBottom: 2 }}>Compartilhado por</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#E8E5DE" }}>{sharedBy}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ maxWidth: 1100, margin: "60px auto 0", padding: 24, borderTop: "1px solid #2A2822", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <LogoImg h={24} opacity={0.5} />
        <span style={{ fontSize: 11, color: "#706B5F" }}>Bomm Urbanizadora · Cascavel/PR</span>
      </footer>

      {/* ═══ LIGHTBOX ═══ */}
      {lightboxIdx != null && photos.length > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchX.current; if (dx < -50 && lightboxIdx < photos.length - 1) setLightboxIdx(lightboxIdx + 1); if (dx > 50 && lightboxIdx > 0) setLightboxIdx(lightboxIdx - 1); }}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxIdx(null); if (e.key === "ArrowRight" && lightboxIdx < photos.length - 1) setLightboxIdx(lightboxIdx + 1); if (e.key === "ArrowLeft" && lightboxIdx > 0) setLightboxIdx(lightboxIdx - 1); }}
          tabIndex={0}>
          {/* Header */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", zIndex: 1 }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, color: "#FAF9F6" }}>{lightboxIdx + 1} / {photos.length}</span>
            <button type="button" onClick={() => setLightboxIdx(null)} style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "none", color: "#FAF9F6", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
          {/* Main image — contain to show full photo without crop */}
          <img src={photos[lightboxIdx].file_url} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", objectPosition: "center", borderRadius: 8 }} />
          {/* Arrows */}
          {lightboxIdx > 0 && <button type="button" onClick={() => setLightboxIdx(lightboxIdx - 1)} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "none", color: "#FAF9F6", fontSize: 22, cursor: "pointer" }}>‹</button>}
          {lightboxIdx < photos.length - 1 && <button type="button" onClick={() => setLightboxIdx(lightboxIdx + 1)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "none", color: "#FAF9F6", fontSize: 22, cursor: "pointer" }}>›</button>}
          {/* Thumbnails */}
          <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", gap: 4, justifyContent: "center", overflowX: "auto", padding: "0 16px" }}>
            {photos.map((ph, i) => <img key={ph.id} src={ph.file_url} alt="" onClick={() => setLightboxIdx(i)} style={{ width: 56, height: 40, objectFit: "cover", objectPosition: "center", borderRadius: 4, cursor: "pointer", flexShrink: 0, border: i === lightboxIdx ? "2px solid #4ADE80" : "2px solid transparent", opacity: i === lightboxIdx ? 1 : 0.5, transition: "all 150ms" }} />)}
          </div>
        </div>
      )}

      {/* Mobile sticky CTA */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", background: "#12110F", borderTop: "1px solid #2A2822", zIndex: 100 }}>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: "#4ADE80", color: "#12110F", fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: "none" }}>
            <WhatsAppIcon /> Tenho interesse
          </a>
        </div>
      )}
    </div>
  );
}
