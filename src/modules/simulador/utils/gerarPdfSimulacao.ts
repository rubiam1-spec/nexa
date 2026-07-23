// Documentos Temáveis v3 · renderer da Simulação · 100% por tokens do
// documentTheme. NENHUM hex/logo/slogan de cliente aqui (Lei multi-tenant): a
// pele vem do tema; a anatomia é fixa. Offline-safe (fontes embedadas; só a
// rede de dados/logos). Sem travessão em texto visível (separadores "·"/"/").
import jsPDF from "jspdf";
import type { PermutaItem } from "../hooks/useSimulador";
import { getSaldoLabel } from "./getSaldoLabel";
import { formatDateBRT } from "../../../shared/utils/dateUtils";
import type { DocumentTheme } from "../../../shared/documents/documentTheme";
import { hexToRgb, buildProtocolo, resolveDocumentTheme } from "../../../shared/documents/documentTheme";
import { registerDocumentFonts } from "../../../shared/documents/documentFonts";
import { formatValidadeAbsoluta, carenciaText } from "../../../shared/documents/documentLayout";

const PL: Record<string, string> = { veiculo: "Veículo", terreno: "Terreno", imovel: "Imóvel" };
const PERIODICIDADE_LABEL: Record<string, string> = { semestral: "semestrais", anual: "anuais", trimestral: "trimestrais", mensal: "mensais" };
const PERIODICIDADE_MESES: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
function fmtBRL(v: number): string { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

type RGB = [number, number, number];

async function loadImg(url: string): Promise<{ data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null> {
  try {
    const res = await fetch(url); if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((ok) => { const r = new FileReader(); r.onloadend = () => ok(r.result as string); r.readAsDataURL(blob); });
    const b64 = data.split(",")[1];
    const { w: iw, h: ih } = await new Promise<{ w: number; h: number }>((ok) => { const img = new Image(); img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => ok({ w: 1, h: 1 }); img.src = data; });
    const ext = url.split(".").pop()?.toLowerCase();
    return { data: b64, fmt: ext === "jpg" || ext === "jpeg" ? "JPEG" : "PNG", w: iw, h: ih };
  } catch { return null; }
}
function contain(nw: number, nh: number, mw: number, mh: number) { const r = nw / nh; let w = mw, h = w / r; if (h > mh) { h = mh; w = h * r; } return { w, h }; }

export interface PdfData {
  contaNome: string; empreendimentoNome: string; quadra: string; lote: string;
  valorOriginal: number; desconto: number; descontoPct: number; valorNegociado: number;
  entradaValor: number; entradaPct: number; entradaParcelada: boolean; entradaParceladaVezes: number; entradaParceladaValor: number;
  numeroParcelas: number; parcelaValor: number; indiceLabel: string;
  carenciaAtiva: boolean; carenciaMeses: number;
  balaoAtivo: boolean; balaoQuantidade: number; balaoValor: number; totalBalaos: number;
  permutaAtiva: boolean; permutaItens: PermutaItem[]; totalPermuta: number; saldoFinanciar: number;
  tipoSaldo: string; textoSaldoPersonalizado: string | null;
  clienteNome?: string; corretorNome?: string;
  area?: number; balaoPeriodicidade?: string;
  pdfValidadeHoras?: number;
  protocolo?: string | null; // gravado na 1ª emissão, reusado depois
  // Campos legados de tema (account_settings) ficam no tipo por compat mas NÃO
  // são usados: a pele vem SÓ do documentTheme.
  logoUrl?: string | null; corPrimaria?: string; corSecundaria?: string; fraseImpactoPdf?: string;
  logoEmpreendimentoUrl?: string | null; tituloProposta?: string | null;
  bulletPdf1?: string | null; bulletPdf2?: string | null; bulletPdf3?: string | null;
  pdfDisclaimer?: string | null; textoParcelamento?: string | null;
}

export type PdfMode = "save" | "bloburl";

// Retorna a bloburl quando mode="bloburl" (preview vivo); senão salva e retorna void.
export async function gerarPdfSimulacao(d: PdfData, theme: DocumentTheme = resolveDocumentTheme(null), mode: PdfMode = "save"): Promise<string | void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const F = await registerDocumentFonts(doc, theme.fontPair);

  const W = 210, H = 297, mg = 18, cw = W - mg * 2;
  const emissaoIso = new Date().toISOString();
  const protocolo = d.protocolo || buildProtocolo(emissaoIso, d.lote, d.quadra);

  // Tokens → RGB (jsPDF). NENHUM hex hardcoded de cliente.
  const c = {
    pageBg: hexToRgb(theme.pageBg) as RGB, text: hexToRgb(theme.textPrimary) as RGB,
    text2: hexToRgb(theme.textSecondary) as RGB, muted: hexToRgb(theme.textMuted) as RGB,
    accent: hexToRgb(theme.accent) as RGB, cardBg: hexToRgb(theme.cardBg) as RGB,
    cardBorder: hexToRgb(theme.cardBorder) as RGB, divider: hexToRgb(theme.divider) as RGB,
  };
  const setFill = (rgb: RGB) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: RGB) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const logoPrimary = theme.logoPrimary ? await loadImg(theme.logoPrimary) : null;
  const logoProduct = theme.logoProduct ? await loadImg(theme.logoProduct) : null;

  const pageBg = () => { setFill(c.pageBg); doc.rect(0, 0, W, H, "F"); };
  const drawLogo = (img: typeof logoPrimary, x: number, yTop: number, maxW: number, maxH: number, align: "left" | "center" = "left") => {
    if (!img) return false;
    try { const s = contain(img.w, img.h, maxW, maxH); const dx = align === "center" ? x - s.w / 2 : x; doc.addImage(img.data, img.fmt, dx, yTop, s.w, s.h, undefined, "FAST"); return true; }
    catch (e) { console.warn("[docs-v3] logo fallback:", e); return false; }
  };
  const overline = (label: string, x: number, y: number, accent: boolean) => {
    doc.setFont(F.mono, "normal"); doc.setFontSize(7.5); setText(accent ? c.accent : c.muted);
    doc.text(label.toUpperCase(), x, y);
  };

  // ═══════════ PÁGINA 1 ═══════════
  pageBg();
  let y = 16;

  // CABEÇALHO · logoPrimary à esquerda · protocolo + data mono à direita
  if (!drawLogo(logoPrimary, mg, y, 46, 11)) { doc.setFont(F.sans, "bold"); doc.setFontSize(13); setText(c.text); doc.text(d.contaNome, mg, y + 8); }
  doc.setFont(F.mono, "normal"); doc.setFontSize(7.5); setText(c.muted);
  doc.text(protocolo, W - mg, y + 3, { align: "right" });
  doc.text(formatDateBRT(new Date()).toUpperCase(), W - mg, y + 8, { align: "right" });
  y += 18;
  setDraw(c.divider); doc.setLineWidth(0.4); doc.line(mg, y, W - mg, y); y += 12;

  // IDENTIFICAÇÃO · selo do produto + título serifado · CLIENTE/CORRETOR à direita
  const idTop = y;
  const productDrawn = drawLogo(logoProduct, mg, idTop, 16, 16);
  const titleX = productDrawn ? mg + 20 : mg;
  doc.setFont(F.serif, "bold"); doc.setFontSize(23); setText(c.text);
  doc.text("Simulação comercial", titleX, idTop + 11);
  const idRightX = W - mg;
  let ry = idTop + 1;
  const idField = (label: string, value: string | undefined, size: number) => {
    if (!value || !value.trim()) return;
    doc.setFont(F.mono, "normal"); doc.setFontSize(7.5); setText(c.muted); doc.text(label, idRightX, ry, { align: "right" }); ry += 4;
    doc.setFont(F.sans, "normal"); doc.setFontSize(size); setText(c.text); doc.text(value, idRightX, ry, { align: "right" }); ry += 7;
  };
  idField("CLIENTE", d.clienteNome, 11);
  idField("CORRETOR(A)", d.corretorNome, 10);
  y = Math.max(idTop + 20, ry) + 8;

  // BLOCO-HERÓI · card + overline · 01 + parcela grande + contexto + carência
  const heroH = 50;
  setFill(c.cardBg); doc.roundedRect(mg, y, cw, heroH, 2, 2, "F");
  setDraw(c.cardBorder); doc.setLineWidth(0.4); doc.roundedRect(mg, y, cw, heroH, 2, 2, "S");
  const hx = mg + 12; let hy = y + 12;
  overline(d.numeroParcelas > 0 ? "· 01 / SUA PARCELA" : "· 01 / PAGAMENTO", hx, hy, true); hy += 12;
  const heroValor = d.numeroParcelas > 0 ? d.parcelaValor : d.valorNegociado;
  doc.setFont(F.sans, "normal"); doc.setFontSize(15); setText(c.text2); doc.text("R$", hx, hy);
  const rsW = doc.getTextWidth("R$ ");
  doc.setFont(F.serif, "bold"); doc.setFontSize(38); setText(c.text);
  const valorStr = heroValor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.text(valorStr, hx + rsW, hy);
  const vW = doc.getTextWidth(valorStr);
  doc.setFont(F.sans, "normal"); doc.setFontSize(13); setText(c.text2);
  doc.text(d.numeroParcelas > 0 ? " /mês" : " à vista", hx + rsW + vW, hy);
  hy += 9;
  const ctx: string[] = [];
  if (d.quadra || d.lote) ctx.push(`Quadra ${d.quadra || "00"} / Lote ${d.lote || "00"}`);
  if (d.numeroParcelas > 0) ctx.push(`${d.numeroParcelas} parcelas`);
  ctx.push("direto com a incorporadora · sem banco");
  doc.setFont(F.sans, "normal"); doc.setFontSize(9); setText(c.muted); doc.text(ctx.join(" · "), hx, hy);
  const car = carenciaText(emissaoIso, d.carenciaAtiva ? d.carenciaMeses : 0);
  if (car) {
    hy += 7;
    doc.setFont(F.sans, "normal"); doc.setFontSize(9); setText(c.muted);
    const pre = "1ª parcela em ";
    doc.text(pre, hx, hy);
    const preW = doc.getTextWidth(pre);
    doc.setFont(F.sans, "bold"); setText(c.accent); doc.text(car.monthLabel, hx + preW, hy); // mês em accent
    const mW = doc.getTextWidth(car.monthLabel);
    doc.setFont(F.sans, "normal"); setText(c.muted); doc.text(`  ·  ${d.carenciaMeses} meses de carência`, hx + preW + mW, hy);
  }
  y += heroH + 12;

  // RESUMO DO INVESTIMENTO · overline · 02 (muted) + linhas com divisores
  overline("· 02 / RESUMO DO INVESTIMENTO", mg, y, false); y += 6;
  const resumoRow = (label: string, value: string) => {
    doc.setFont(F.sans, "normal"); doc.setFontSize(10.5); setText(c.text2); doc.text(label, mg, y);
    doc.setFont(F.sans, "normal"); doc.setFontSize(10.5); setText(c.text); doc.text(value, W - mg, y, { align: "right" }); y += 5.5;
    setDraw(c.divider); doc.setLineWidth(0.5); doc.line(mg, y, W - mg, y); y += 4.5;
  };
  resumoRow("Valor do lote", fmtBRL(d.valorOriginal));
  if (d.desconto > 0) resumoRow(`Desconto (${d.descontoPct}%)`, `- ${fmtBRL(d.desconto)}`);
  if (d.entradaValor > 0) {
    const pct = d.entradaPct > 0 && d.entradaPct < 100 ? ` (${d.entradaPct}%)` : "";
    resumoRow(`Entrada${pct}`, d.entradaParcelada ? `${d.entradaParceladaVezes}x de ${fmtBRL(d.entradaParceladaValor)}` : `${fmtBRL(d.entradaValor)} · à vista`);
  }
  if (d.numeroParcelas > 0) resumoRow("Parcelamento", `${d.numeroParcelas}x de ${fmtBRL(d.parcelaValor)}`);
  if (d.balaoAtivo && d.totalBalaos > 0) { const per = PERIODICIDADE_LABEL[d.balaoPeriodicidade || "semestral"] || "semestrais"; resumoRow(`Balões ${per}`, `${d.balaoQuantidade}x de ${fmtBRL(d.balaoValor)}`); }
  const permutas = d.permutaAtiva ? d.permutaItens.filter((p) => p.valor > 0) : [];
  if (permutas.length > 0) resumoRow("Permuta", fmtBRL(d.totalPermuta));
  const saldoInfo = getSaldoLabel({ tipoSaldo: d.tipoSaldo, textoSaldoPersonalizado: d.textoSaldoPersonalizado });
  resumoRow(saldoInfo.titulo || "Saldo a financiar", fmtBRL(d.saldoFinanciar));

  // RODAPÉ-ASSINATURA (página 1)
  drawSignature(doc, { W, H, mg, F, c, theme, logoPrimary, emissaoIso, validadeHoras: d.pdfValidadeHoras ?? 48, setFill, setText, setDraw, drawLogo });

  // ═══════════ PÁGINA 2 · cronograma + condições ═══════════
  doc.addPage(); pageBg(); y = 20;
  overline("· 03 / CRONOGRAMA DO FLUXO", mg, y, false); y += 8;
  const stepRow = (title: string, detail: string) => {
    doc.setFont(F.sans, "bold"); doc.setFontSize(10.5); setText(c.text); doc.text(title, mg, y);
    doc.setFont(F.sans, "normal"); doc.setFontSize(10); setText(c.muted); doc.text(detail, W - mg, y, { align: "right" }); y += 5.5;
    setDraw(c.divider); doc.setLineWidth(0.5); doc.line(mg, y, W - mg, y); y += 5;
  };
  if (d.entradaValor > 0) stepRow("Entrada", d.entradaParcelada ? `${d.entradaParceladaVezes}x · ${fmtBRL(d.entradaValor)}` : `${fmtBRL(d.entradaValor)} · à vista`);
  if (car) stepRow("Carência", `${d.carenciaMeses} meses · 1ª parcela em ${car.monthLabel}`);
  if (d.numeroParcelas > 0) stepRow("Parcelas", `${d.numeroParcelas}x de ${fmtBRL(d.parcelaValor)}`);
  if (d.balaoAtivo && d.totalBalaos > 0) {
    const stepM = PERIODICIDADE_MESES[d.balaoPeriodicidade || "semestral"] || 6;
    const per = PERIODICIDADE_LABEL[d.balaoPeriodicidade || "semestral"] || "semestrais";
    stepRow(`Balões ${per}`, `${d.balaoQuantidade}x a cada ${stepM} meses · ${fmtBRL(d.balaoValor)}`);
  }
  if (permutas.length > 0) permutas.forEach((p) => stepRow("Permuta", `${PL[p.tipo] ?? p.tipo}${p.descricao ? ` · ${p.descricao}` : ""} · ${fmtBRL(p.valor)}`));
  y += 6;

  // CONDIÇÕES · correção SEM destaque (muted), disclaimer do tema (1 linha)
  overline("· 04 / CONDIÇÕES", mg, y, false); y += 7;
  doc.setFont(F.sans, "normal"); doc.setFontSize(9); setText(c.muted);
  const corr = d.indiceLabel ? `Correção monetária pelo ${d.indiceLabel.split(" → ")[0]} · sem juros bancários.` : "Correção monetária conforme índice contratado · sem juros bancários.";
  doc.text(corr, mg, y); y += 6;
  const discLines = doc.splitTextToSize(theme.disclaimer, cw) as string[];
  discLines.forEach((ln) => { doc.text(ln, mg, y); y += 4.5; });
  y += 6;
  if (d.contaNome) { doc.setFont(F.mono, "normal"); doc.setFontSize(7.5); setText(c.muted); doc.text("CORRETORA", mg, y); y += 4; doc.setFont(F.sans, "normal"); doc.setFontSize(10); setText(c.text2); doc.text(d.contaNome, mg, y); y += 6; }

  drawSignature(doc, { W, H, mg, F, c, theme, logoPrimary, emissaoIso, validadeHoras: d.pdfValidadeHoras ?? 48, setFill, setText, setDraw, drawLogo });

  if (mode === "bloburl") return doc.output("bloburl") as unknown as string;
  doc.save(`simulacao_${protocolo}.pdf`);
}

// ── Assinatura (mesma nas duas páginas): divisor fino, logoPrimary centrado,
// slogan com SÓ a sloganAccentWord em itálico accent (sem slogan → sem linha),
// "POWERED BY NEXA · VÁLIDA POR 48H · ATÉ ...". ──
type SigCtx = {
  W: number; H: number; mg: number; F: { serif: string; sans: string; mono: string };
  c: { accent: RGB; muted: RGB; divider: RGB; text2: RGB };
  theme: DocumentTheme; logoPrimary: { data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null;
  emissaoIso: string; validadeHoras: number;
  setFill: (r: RGB) => void; setText: (r: RGB) => void; setDraw: (r: RGB) => void;
  drawLogo: (img: SigCtx["logoPrimary"], x: number, yTop: number, mw: number, mh: number, align?: "left" | "center") => boolean;
};
function drawSignature(doc: jsPDF, s: SigCtx) {
  const cx = s.W / 2;
  let y = s.H - 34;
  s.setDraw(s.c.divider); doc.setLineWidth(0.3); doc.line(s.mg, y, s.W - s.mg, y); y += 8;
  if (s.drawLogo(s.logoPrimary, cx, y, 34, 9, "center")) y += 12; else y += 2;

  if (s.theme.slogan && s.theme.slogan.trim()) {
    doc.setFont(s.F.serif, "normal"); doc.setFontSize(10); s.setText(s.c.muted);
    const slogan = s.theme.slogan.trim();
    const accentW = (s.theme.sloganAccentWord || "").trim();
    if (accentW && slogan.toLowerCase().includes(accentW.toLowerCase())) {
      // desenha a frase centralizada com só a palavra-accent em itálico accent
      const idx = slogan.toLowerCase().indexOf(accentW.toLowerCase());
      const before = slogan.slice(0, idx), word = slogan.slice(idx, idx + accentW.length), after = slogan.slice(idx + accentW.length);
      const wb = doc.getTextWidth(before);
      doc.setFont(s.F.serif, "italic"); const ww = doc.getTextWidth(word);
      doc.setFont(s.F.serif, "normal"); const wa = doc.getTextWidth(after);
      const total = wb + ww + wa; let x = cx - total / 2;
      doc.setFont(s.F.serif, "normal"); s.setText(s.c.muted); doc.text(before, x, y); x += wb;
      doc.setFont(s.F.serif, "italic"); s.setText(s.c.accent); doc.text(word, x, y); x += ww; // palavra-accent
      doc.setFont(s.F.serif, "normal"); s.setText(s.c.muted); doc.text(after, x, y);
    } else {
      doc.text(slogan, cx, y, { align: "center" });
    }
    y += 8;
  }

  doc.setFont(s.F.mono, "normal"); doc.setFontSize(7); s.setText(s.c.muted);
  doc.text(`POWERED BY NEXA · ${formatValidadeAbsoluta(s.emissaoIso, s.validadeHoras)}`, cx, y, { align: "center" });
}
