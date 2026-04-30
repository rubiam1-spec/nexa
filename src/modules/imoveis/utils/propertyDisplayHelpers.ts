/** Quartos card info */
export function getQuartoInfo(quartos: number | null, suites: number | null, suiteMaster: boolean, closet: boolean): { total: number; subInfo: string } {
  const q = Number(quartos) || 0;
  const s = Number(suites) || 0;
  const parts: string[] = [];
  if (s > 0) {
    let t = `${s} suíte${s > 1 ? "s" : ""}`;
    if (suiteMaster) t += " · master";
    parts.push(t);
  }
  if (closet) parts.push("closet");
  return { total: q, subInfo: parts.join(" · ") };
}

/** Banheiros card info — decomposes total into suítes + lavabo + extras */
export function getBanheiroInfo(banheiros: number | null, suites: number | null, lavabo: boolean, banheira: boolean): { total: number; subInfo: string } {
  const totalBanco = Number(banheiros) || 0;
  const s = Number(suites) || 0;
  const totalReal = Math.max(totalBanco, s + (lavabo ? 1 : 0));
  const parts: string[] = [];
  if (s > 0) parts.push(`${s} de suíte${s > 1 ? "s" : ""}`);
  if (lavabo) parts.push("1 lavabo");
  if (banheira) parts.push("banheira");
  return { total: totalReal, subInfo: parts.join(" · ") };
}

/** Area card info — privativa vs total */
export function getAreaInfo(areaPrivativa: number | null, areaConstruida: number | null, areaM2: number | null, _areaComum: number | null): { value: string; label: string; sub?: string } | null {
  const priv = Number(areaPrivativa) || 0;
  const total = Number(areaConstruida) || Number(areaM2) || 0;
  if (priv > 0) {
    const sub = total > priv ? `${total.toLocaleString("pt-BR")} m² total` : undefined;
    return { value: priv.toLocaleString("pt-BR"), label: "m² privativos", sub };
  }
  if (total > 0) return { value: total.toLocaleString("pt-BR"), label: "m² construído" };
  return null;
}

/** Vagas card info — with type */
export function getVagaInfo(vagas: number | null, tipo: string | null): { total: number; subInfo: string } {
  const v = Number(vagas) || 0;
  const labels: Record<string, string> = { lado_a_lado: "lado a lado", gaveta: "gaveta" };
  return { total: v, subInfo: tipo && labels[tipo] ? labels[tipo] : "" };
}

/** Entrega/ano info — contextual */
export function getEntregaInfo(anoConstrucao: number | null, previsaoEntrega: string | null): { value: string; label: string } | null {
  if (previsaoEntrega) return { value: previsaoEntrega, label: "previsão de entrega" };
  if (anoConstrucao) return { value: String(anoConstrucao), label: "ano de construção" };
  return null;
}

/** Detail pills — only items NOT already shown in cards */
export function getDetailPills(suiteMaster: boolean, closet: boolean, banheira: boolean): string[] {
  return [
    suiteMaster && "Suíte master",
    closet && "Closet",
    banheira && "Banheira",
  ].filter(Boolean) as string[];
}
