import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

const EF_URL = "https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/resolve-share-link";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ShareData {
  entity_type: string;
  entity: Record<string, unknown>;
  brand: { logo_url?: string; cor_primaria?: string; nome_comercial?: string; slogan?: string };
  development?: { name?: string; city?: string; state?: string };
}

export default function ShareLinkPage() {
  const { slug } = useParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) { setError("Link inválido"); setLoading(false); return; }
    fetch(`${EF_URL}?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((result) => { if (result.error) setError(result.error); else setData(result); })
      .catch(() => setError("Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0B0A08", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Carregando...</div>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: "#0B0A08", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 360, padding: 20 }}>
        <svg width="48" height="48" viewBox="0 0 512 512" style={{ marginBottom: 24 }}>
          <path d="M40 0 H370 L512 142 V472 Q512 512 472 512 H40 Q0 512 0 472 V40 Q0 0 40 0 Z" fill="#1C1B18" />
          <polygon points="148,380 148,132 200,132 316,308 316,132 364,132 364,380 316,380 200,204 200,380" fill="#4ADE80" />
        </svg>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 24, color: "#FAF9F6", marginBottom: 8 }}>Link não encontrado</h1>
        <p style={{ fontSize: 14, color: "#706B5F", marginBottom: 24 }}>{error || "Este link pode ter expirado ou sido removido."}</p>
        <a href="https://nexacomercial.com.br" style={{ color: "#4ADE80", fontSize: 13, textDecoration: "none" }}>Conhecer o NEXA →</a>
      </div>
    </div>
  );

  if (data.entity_type === "simulation") return <SimulationView data={data} />;
  return <GenericView data={data} />;
}

function SimulationView({ data }: { data: ShareData }) {
  const { entity: sim, brand, development } = data;
  const unit = sim.unit as Record<string, unknown> | null;
  const accent = brand.cor_primaria || "#4ADE80";

  return (
    <div style={{ minHeight: "100vh", background: "#0B0A08", padding: "40px 20px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        {/* Header branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.nome_comercial || ""} style={{ maxHeight: 40, marginBottom: 12 }} />
          ) : brand.nome_comercial ? (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: accent }}>{brand.nome_comercial}</div>
          ) : null}
          {development?.name && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#706B5F", marginTop: 4 }}>{development.name}{development.city ? ` · ${development.city}` : ""}</div>}
        </div>

        {/* Main card */}
        <div style={{ background: "#1C1B18", borderRadius: 16, border: "1px solid #2A2822", padding: 24 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#706B5F", letterSpacing: "0.1em", marginBottom: 16 }}>SIMULAÇÃO COMERCIAL</div>

          {unit && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#FAF9F6" }}>Quadra {unit.quadra as string} · Lote {unit.lote as string}</div>
              {(unit.area || unit.valor) ? <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#706B5F", marginTop: 4 }}>{unit.area ? String(`${Number(unit.area).toLocaleString("pt-BR")} m²`) : ""}{unit.area && unit.valor ? " · " : ""}{unit.valor ? fmt(Number(unit.valor)) : ""}</div> : null}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Number(sim.entrada_valor ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#9C9686" }}>Entrada ({Number(sim.entrada_percentual ?? 0)}%)</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: "#E8E5DE" }}>{fmt(Number(sim.entrada_valor))}</span>
              </div>
            )}
            {Number(sim.parcelas_quantidade ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#9C9686" }}>Parcelas ({String(sim.parcelas_quantidade)}x)</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: "#E8E5DE" }}>{fmt(Number(sim.parcelas_valor))}</span>
              </div>
            )}
            {Number(sim.balao_valor ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#9C9686" }}>Balão ({String(sim.balao_quantidade)}x)</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: "#E8E5DE" }}>{fmt(Number(sim.balao_valor))}</span>
              </div>
            )}
            {Number(sim.permuta_valor ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#9C9686" }}>Permuta</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: "#E8E5DE" }}>{fmt(Number(sim.permuta_valor))}</span>
              </div>
            )}
          </div>

          {/* Monthly payment highlight */}
          {Number(sim.parcelas_valor ?? 0) > 0 && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: `linear-gradient(135deg, ${accent}10, ${accent}05)`, border: `1px solid ${accent}25`, textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#706B5F", marginBottom: 4 }}>PARCELA MENSAL</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: accent }}>{fmt(Number(sim.parcelas_valor))}</div>
              <div style={{ fontSize: 12, color: "#5C5647", marginTop: 4 }}>{String(sim.parcelas_quantidade)}x · direto com a incorporadora</div>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: "#5C5647", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          Simulação comercial sujeita à aprovação. Valores e condições podem ser alterados sem aviso prévio.
        </p>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "#3D3A30", letterSpacing: "0.12em" }}>POWERED BY NEXA</div>
        </div>
      </div>
    </div>
  );
}

function GenericView({ data }: { data: ShareData }) {
  const { brand, development } = data;
  return (
    <div style={{ minHeight: "100vh", background: "#0B0A08", padding: "40px 20px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {brand.logo_url && <img src={brand.logo_url} alt="" style={{ maxHeight: 40, marginBottom: 16 }} />}
        {development?.name && <div style={{ fontSize: 16, color: "#E8E5DE", fontWeight: 600 }}>{development.name}</div>}
        <div style={{ marginTop: 32, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "#3D3A30", letterSpacing: "0.12em" }}>POWERED BY NEXA</div>
      </div>
    </div>
  );
}
