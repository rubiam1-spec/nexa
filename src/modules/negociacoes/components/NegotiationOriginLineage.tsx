// L1.6 — Bloco "Origem": a LINHAGEM do lead dentro da negociação. Explica de onde
// veio o cliente (landing_page/whatsapp/indicação/manual), a campanha (utm) e
// quando foi convertido — o sistema deixa clara a conexão Lead → Negociação.
//
// Presentacional PURO: recebe dados já carregados do cliente (origin/utm/convertedAt)
// — zero query, zero regra. Dados já existem em clients (nenhum DDL). Feito como
// componente ISOLADO porque a ficha (NegotiationDetailPage) está em WIP: quando o
// WIP assentar, basta importar e renderizar este bloco na área de resumo (1 linha).
import { CLIENT_SOURCE_LABELS } from "../../../shared/types/client";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

export type NegotiationOriginLineageProps = {
  origin: string | null;
  originDetail?: string | null;
  utmCampaign: string | null;
  /** Data da conversão lead→negociação (clients.converted_at ou a interaction CONVERTED). */
  convertedAt: string | null;
};

const MONO = "var(--font-mono)";

export default function NegotiationOriginLineage({
  origin, originDetail, utmCampaign, convertedAt,
}: NegotiationOriginLineageProps) {
  // Sem nenhum dado de origem/conversão não há linhagem a explicar — não polui a ficha.
  if (!origin && !utmCampaign && !convertedAt) return null;

  const originLabel = origin ? (CLIENT_SOURCE_LABELS[origin] ?? origin) : "—";

  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-disabled)", fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
        Origem
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "baseline" }}>
        <LineageItem label="Canal" value={originLabel} />
        {originDetail ? <LineageItem label="Detalhe" value={originDetail} /> : null}
        {utmCampaign ? <LineageItem label="Campanha" value={utmCampaign} mono /> : null}
        {convertedAt ? <LineageItem label="Convertido em" value={formatDateBRT(convertedAt)} mono /> : null}
      </div>
    </div>
  );
}

function LineageItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: "var(--text-disabled)", fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, fontFamily: mono ? MONO : "inherit" }}>{value}</div>
    </div>
  );
}
