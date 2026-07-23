// Documentos Temáveis v3 · lógica de layout PURA (testável, sem jsPDF). Datas,
// carência, validade absoluta e o ORÇAMENTO de accent (guarda ≤3/página).
// Sem travessão em texto: separadores são "·" e "/".

const MESES_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pad2 = (n: number) => String(n).padStart(2, "0");

// Validade ABSOLUTA obrigatória: "VÁLIDA POR 48H · ATÉ DD/MM/AAAA HH:MM".
export function formatValidadeAbsoluta(emissaoIso: string, horas = 48): string {
  const d = new Date(emissaoIso);
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const exp = new Date(base.getTime() + horas * 3600_000);
  return `VÁLIDA POR ${horas}H · ATÉ ${pad2(exp.getDate())}/${pad2(exp.getMonth() + 1)}/${exp.getFullYear()} ${pad2(exp.getHours())}:${pad2(exp.getMinutes())}`;
}

// Carência (>0): "1ª parcela em <mês/ano> · X meses de carência"; o mês vai em
// accent no herói. 0 ou ausente → null (não inventa linha).
export function carenciaText(emissaoIso: string, carenciaMeses: number | null | undefined): { text: string; monthLabel: string } | null {
  if (!carenciaMeses || carenciaMeses <= 0) return null;
  const d = new Date(emissaoIso);
  const base = Number.isNaN(d.getTime()) ? new Date() : new Date(d.getTime());
  base.setMonth(base.getMonth() + carenciaMeses);
  const monthLabel = `${MESES_LONG[base.getMonth()]}/${base.getFullYear()}`;
  return { text: `1ª parcela em ${monthLabel} · ${carenciaMeses} meses de carência`, monthLabel };
}

// ORÇAMENTO de accent da página 1 · anatomia FIXA: overline "· 01" (sempre) +
// mês da carência (se >0) + palavra-accent do slogan (se houver). A overline
// "· 02" fica em muted, NÃO em accent. Garante ≤3 com QUALQUER tema/dado.
export function planAccentCountP1(input: { carenciaMeses?: number | null; hasSlogan?: boolean }): number {
  let n = 1; // overline "· 01 / SUA PARCELA"
  if (input.carenciaMeses && input.carenciaMeses > 0) n += 1;
  if (input.hasSlogan) n += 1;
  return n;
}
