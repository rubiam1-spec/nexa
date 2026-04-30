import jsPDF from "jspdf";
import type { PermutaItem } from "../hooks/useSimulador";
import { getSaldoLabel } from "./getSaldoLabel";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

const PL: Record<string, string> = { veiculo: "Veículo", terreno: "Terreno", imovel: "Imóvel" };
const PERIODICIDADE_LABEL: Record<string, string> = { semestral: "semestrais", anual: "anuais", trimestral: "trimestrais", mensal: "mensais" };

function fmtBRL(v: number): string { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function hexRGB(hex: string | null | undefined): [number, number, number] {
  const h = (hex || "#D97706").replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return [217, 119, 6];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

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

async function loadFont(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const uint8 = new Uint8Array(buf);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
    }
    return btoa(binary);
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
  logoUrl?: string | null; corPrimaria?: string; corSecundaria?: string; fraseImpactoPdf?: string;
  logoEmpreendimentoUrl?: string | null; tituloProposta?: string | null;
  bulletPdf1?: string | null; bulletPdf2?: string | null; bulletPdf3?: string | null;
  pdfDisclaimer?: string | null; pdfValidadeHoras?: number;
  textoParcelamento?: string | null;
  area?: number;
  balaoPeriodicidade?: string;
}

export async function gerarPdfSimulacao(d: PdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── FONT LOADING ──
  let fontFamily = "helvetica";
  try {
    const [base64Regular, base64Medium] = await Promise.all([
      loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf"),
      loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf"),
    ]);
    if (base64Regular && base64Medium) {
      doc.addFileToVFS('Roboto-Regular.ttf', base64Regular);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Medium.ttf', base64Medium);
      doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');
      fontFamily = "Roboto";
    }
  } catch { /* fall back to helvetica */ }

  const t = (text: string) => text;

  const W = 210, mg = 18, cw = W - mg * 2;
  const [cR, cG, cB] = hexRGB(d.corPrimaria);
  const lum = (cR * 0.299 + cG * 0.587 + cB * 0.114) / 255;
  const boost = lum < 0.4 ? 1.8 : 1;
  const cRL = Math.min(255, Math.round(cR * boost + (boost > 1 ? 60 : 0)));
  const cGL = Math.min(255, Math.round(cG * boost + (boost > 1 ? 60 : 0)));
  const cBL = Math.min(255, Math.round(cB * boost + (boost > 1 ? 60 : 0)));
  const DK: [number, number, number] = [30, 27, 24];
  const MD: [number, number, number] = [112, 107, 95];
  const LT: [number, number, number] = [196, 191, 179];
  const WH: [number, number, number] = [250, 249, 246];
  const BG: [number, number, number] = [18, 17, 15];
  const CR: [number, number, number] = [253, 248, 242];
  let y = 0;

  const logo = d.logoUrl ? await loadImg(d.logoUrl) : null;
  const logoE = d.logoEmpreendimentoUrl ? await loadImg(d.logoEmpreendimentoUrl) : null;

  // ── HEADER (52mm) ──
  const HH = 52;
  doc.setFillColor(...BG); doc.rect(0, 0, W, HH, "F");
  let ok = false;
  if (logo) { try { const s = contain(logo.w, logo.h, 50, 26); doc.addImage(logo.data, logo.fmt, mg, (HH - 26) / 2 + (26 - s.h) / 2, s.w, s.h, undefined, "FAST"); ok = true; } catch (e) { console.warn("[PDF] Logo conta fallback:", e); } }
  if (!ok) { doc.setFont(fontFamily, "bold"); doc.setFontSize(15); doc.setTextColor(...WH); doc.text(t(d.contaNome), mg, HH / 2 + 3); }
  const SX = mg + 58;
  doc.setDrawColor(61, 58, 48); doc.setLineWidth(0.4); doc.line(SX, 10, SX, HH - 10);
  const EX = SX + 8;
  let eOk = false;
  if (logoE) { try { const s = contain(logoE.w, logoE.h, 34, 18); doc.addImage(logoE.data, logoE.fmt, EX, (HH - 18) / 2 + (18 - s.h) / 2, s.w, s.h, undefined, "FAST"); eOk = true; } catch (e) { console.warn("[PDF] Logo empreendimento fallback:", e); } }
  if (!eOk) { doc.setFont(fontFamily, "bold"); doc.setFontSize(11); doc.setTextColor(...WH); doc.text(t(d.empreendimentoNome), EX, HH / 2); }
  doc.setFont(fontFamily, "normal"); doc.setFontSize(10); doc.setTextColor(...LT);
  doc.text(formatDateBRT(new Date()), W - mg, HH / 2 + 2, { align: "right" });
  doc.setFillColor(cRL, cGL, cBL); doc.rect(0, HH - 2.5, W, 2.5, "F");
  y = HH + 20;

  // ── TÍTULO ──
  const titulo = d.tituloProposta || "Simulação Comercial";
  doc.setFont(fontFamily, "bold"); doc.setFontSize(11); doc.setTextColor(cR, cG, cB);
  doc.text(t(titulo).toUpperCase(), mg, y); y += 4;
  doc.setFont(fontFamily, "normal"); doc.setFontSize(10); doc.setTextColor(...MD);
  doc.text(t(d.empreendimentoNome), mg, y); y += 10;

  // ── SEU TERRENO ──
  doc.setFont(fontFamily, "bold"); doc.setFontSize(8); doc.setTextColor(...MD);
  doc.text(t("SEU TERRENO"), mg, y); y += 4;
  doc.setDrawColor(cR, cG, cB); doc.setLineWidth(0.5); doc.line(mg, y, mg + cw, y); y += 8;
  doc.setFont(fontFamily, "bold"); doc.setFontSize(18); doc.setTextColor(...DK);
  const qT = t("Quadra " + d.quadra); doc.text(qT, mg, y);
  const qW = doc.getTextWidth(qT);
  doc.setTextColor(cR, cG, cB); doc.text("  /  ", mg + qW, y);
  const sW = doc.getTextWidth("  /  ");
  doc.setTextColor(...DK); doc.text(t("Lote " + d.lote), mg + qW + sW, y);
  y += 8;
  doc.setFont(fontFamily, "normal"); doc.setFontSize(10); doc.setTextColor(...MD);
  if (d.area && d.area > 0) { doc.text(t("Área: " + d.area.toLocaleString("pt-BR") + " m²"), mg, y); y += 5; }
  doc.text(t("Valor do terreno: " + fmtBRL(d.valorOriginal)), mg, y); y += 12;

  // ── HERO — SUA SIMULAÇÃO (38mm) ──
  const heroH = 38;
  doc.setFillColor(...CR); doc.roundedRect(mg, y, cw, heroH, 5, 5, "F");
  doc.setDrawColor(cR, cG, cB); doc.setLineWidth(1.5); doc.roundedRect(mg, y, cw, heroH, 5, 5, "S");
  doc.setFont(fontFamily, "bold"); doc.setFontSize(8); doc.setTextColor(cR, cG, cB);
  doc.text(t(d.numeroParcelas > 0 ? "SUA SIMULAÇÃO DE PAGAMENTO" : "PAGAMENTO À VISTA"), mg + 10, y + 10);
  doc.setFont(fontFamily, "bold"); doc.setFontSize(38); doc.setTextColor(...DK);
  doc.text(t(d.numeroParcelas > 0 ? fmtBRL(d.parcelaValor) : fmtBRL(d.valorNegociado)), mg + 10, y + 26);
  doc.setFont(fontFamily, "normal"); doc.setFontSize(13); doc.setTextColor(...MD);
  doc.text(t(d.numeroParcelas > 0 ? "/mês" : "valor negociado"), W - mg - 10, y + 26, { align: "right" });
  const sub: string[] = [];
  if (d.numeroParcelas > 0) sub.push(d.numeroParcelas + " parcelas");
  if (d.numeroParcelas > 0 && d.textoParcelamento) sub.push(d.textoParcelamento);
  else if (d.numeroParcelas > 0 && d.indiceLabel) sub.push(d.indiceLabel.split(" → ")[0]);
  if (d.numeroParcelas > 0 && d.carenciaAtiva && d.carenciaMeses > 0) sub.push(t("carência " + d.carenciaMeses + " meses"));
  sub.push(t("sem banco"));
  doc.setFont(fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(...MD);
  doc.text(t(sub.join("  ·  ")), W - mg - 8, y + heroH - 6, { align: "right" });
  y += heroH + 12;

  // ── RESUMO DO INVESTIMENTO ──
  doc.setFont(fontFamily, "bold"); doc.setFontSize(8); doc.setTextColor(...MD);
  doc.text(t("RESUMO DO INVESTIMENTO"), mg, y); y += 4;
  doc.setDrawColor(cR, cG, cB); doc.setLineWidth(0.5); doc.line(mg, y, mg + cw, y); y += 8;

  function row(label: string, value: string, sub2?: string, isDiscount?: boolean) {
    doc.setFont(fontFamily, "normal"); doc.setFontSize(11); doc.setTextColor(...DK); doc.text(t(label), mg, y);
    doc.setFont(fontFamily, "bold"); if (isDiscount) doc.setTextColor(220, 38, 38); else doc.setTextColor(...DK); doc.text(t(value), W - mg, y, { align: "right" }); y += 5;
    if (sub2) { doc.setFont(fontFamily, "normal"); doc.setFontSize(8.5); doc.setTextColor(...MD); doc.text(t("  " + sub2), mg + 3, y); y += 5; }
    doc.setDrawColor(240, 237, 232); doc.setLineWidth(0.2); doc.line(mg, y, mg + cw, y); y += 4;
  }

  // Entrada
  if (d.entradaValor > 0) {
    const entLabel = d.entradaPct > 0 && d.entradaPct < 100 ? "Entrada (" + d.entradaPct + "%)" : "Entrada";
    const entSub = d.entradaParcelada ? t(d.entradaParceladaVezes + "x de " + fmtBRL(d.entradaParceladaValor)) : t("À vista");
    row(t(entLabel), fmtBRL(d.entradaValor), entSub);
  }

  // Parcelamento
  if (d.numeroParcelas > 0) {
    const textoParc = d.textoParcelamento || (d.indiceLabel ? "Correção pelo " + d.indiceLabel.split(" → ")[0] + " · sem juros bancários" : "Com correção monetária · sem juros bancários");
    const parcSub = d.carenciaAtiva && d.carenciaMeses > 0 ? textoParc + " · carência de " + d.carenciaMeses + " meses" : textoParc;
    row(t("Parcelamento"), d.numeroParcelas + "x de " + fmtBRL(d.parcelaValor), parcSub);
  } else {
    const saldoAVistaCalc = Math.max(0, d.valorNegociado - d.entradaValor - (d.permutaAtiva ? d.permutaItens.reduce((s: number, p: { valor: number }) => s + p.valor, 0) : 0));
    if (saldoAVistaCalc > 0) row(t("Saldo à vista"), fmtBRL(saldoAVistaCalc), t("Pagamento integral sem parcelas"));
  }

  // Balões
  if (d.balaoAtivo && d.totalBalaos > 0) {
    const perioLabel = PERIODICIDADE_LABEL[d.balaoPeriodicidade || "semestral"] || "semestrais";
    row(t("Balões (" + d.balaoQuantidade + "x " + perioLabel + ")"), fmtBRL(d.totalBalaos), d.balaoQuantidade + "x " + perioLabel + " de " + fmtBRL(d.balaoValor));
  }

  // Permuta
  const pv = d.permutaAtiva ? d.permutaItens.filter((p) => p.valor > 0) : [];
  if (pv.length > 0) {
    pv.forEach((p) => {
      const pLabel = (PL[p.tipo] ?? p.tipo) + (p.descricao ? " — " + p.descricao : "");
      row(t("Permuta: " + pLabel), fmtBRL(p.valor));
    });
    if (pv.length > 1) row(t("Total permuta"), fmtBRL(d.totalPermuta));
  }

  // Desconto
  if (d.desconto > 0) {
    row(t("Desconto (" + d.descontoPct + "%)"), "- " + fmtBRL(d.desconto), undefined, true);
  }

  // ── TOTAL ──
  y += 2;
  doc.setDrawColor(...DK); doc.setLineWidth(0.8); doc.line(mg, y, mg + cw, y); y += 8;
  const saldoInfo = getSaldoLabel({ tipoSaldo: d.tipoSaldo, textoSaldoPersonalizado: d.textoSaldoPersonalizado });
  doc.setFont(fontFamily, "bold"); doc.setFontSize(11); doc.setTextColor(...DK);
  doc.text(t(saldoInfo.titulo || "TOTAL DO INVESTIMENTO"), mg, y);
  doc.setFontSize(13); doc.setTextColor(cR, cG, cB);
  doc.text(fmtBRL(d.saldoFinanciar), W - mg, y, { align: "right" }); y += 5;
  if (saldoInfo.subtitulo) {
    doc.setFont(fontFamily, "normal"); doc.setFontSize(9); doc.setTextColor(...MD);
    doc.text(t(saldoInfo.subtitulo), mg, y); y += 5;
  }
  y += 10;

  // ── CLIENTE / CORRETOR ──
  if (d.clienteNome && d.clienteNome.trim()) {
    doc.setFont(fontFamily, "bold"); doc.setFontSize(8); doc.setTextColor(...MD);
    doc.text(t("CLIENTE"), mg, y); y += 5;
    doc.setFont(fontFamily, "normal"); doc.setFontSize(11); doc.setTextColor(...DK);
    doc.text(t(d.clienteNome), mg, y); y += 7;
  }
  if (d.corretorNome && d.corretorNome.trim()) {
    doc.setFont(fontFamily, "bold"); doc.setFontSize(8); doc.setTextColor(...MD);
    doc.text(t("CORRETOR"), mg, y); y += 5;
    doc.setFont(fontFamily, "normal"); doc.setFontSize(11); doc.setTextColor(...DK);
    doc.text(t(d.corretorNome), mg, y); y += 7;
  }
  y += 3;

  // ── VALIDADE ──
  const validadeHoras = d.pdfValidadeHoras ?? 48;
  doc.setFont(fontFamily, "normal"); doc.setFontSize(7.5); doc.setTextColor(...LT);
  doc.text(t("Simulação válida por " + validadeHoras + "h a partir da emissão · " + formatDateBRT(new Date())), mg, y);
  y += 10;

  // ── DISCLAIMER ──
  const disclaimerText = d.pdfDisclaimer || "Esta simulação é meramente ilustrativa e não constitui proposta formal.\nCondições sujeitas à análise e aprovação da incorporadora.";
  doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(...MD);
  disclaimerText.split("\n").forEach((line) => { doc.text(t(line), mg, y); y += 4; });
  y += 6;

  // ── BULLETS ──
  const bullets = [
    t(d.bulletPdf1 || "Simulação meramente ilustrativa, sem caráter de proposta comercial"),
    t(d.bulletPdf2 || "Valores e condições sujeitos à análise e aprovação da incorporadora"),
    t(d.bulletPdf3 || "Simulação válida por " + validadeHoras + " horas"),
  ];

  // Check if bullets + footer fit, otherwise new page
  if (y + 40 > 280) { doc.addPage(); y = 20; }

  bullets.forEach((b) => {
    doc.setFillColor(cR, cG, cB); doc.rect(mg, y - 2.5, 3, 3, "F");
    doc.setFont(fontFamily, "normal"); doc.setFontSize(10); doc.setTextColor(...MD); doc.text(b, mg + 6, y); y += 7;
  });
  y += 5;

  // ── RODAPÉ MOTIVACIONAL ──
  // Safe zone: footer starts at y=285, need motivational block (~20mm) above it
  // So motivational must fit between current y and y=265 at most
  const FOOTER_Y = 285;
  const MOTIV_MAX_Y = FOOTER_Y - 8;
  const frase = d.fraseImpactoPdf || "Patrimônio não se constrói esperando o momento certo. O momento certo é quando você age.";
  const fl = doc.splitTextToSize('"' + t(frase) + '"', cw);
  const quoteLines = Array.isArray(fl) ? fl.length : 1;
  const motivBlockHeight = 7 + (d.corretorNome ? 5 : 0) + quoteLines * 4 + 4;

  if (y + motivBlockHeight > MOTIV_MAX_Y) { doc.addPage(); y = 20; }
  doc.setDrawColor(...LT); doc.setLineWidth(0.25); doc.line(mg, y, mg + cw, y); y += 7;
  if (d.corretorNome) { doc.setFont(fontFamily, "bold"); doc.setFontSize(10); doc.setTextColor(...DK); doc.text(t("Elaborado por: " + d.corretorNome), mg, y); y += 5; }
  doc.setFont(fontFamily, "italic"); doc.setFontSize(9); doc.setTextColor(...LT);
  doc.text(fl, W / 2, y, { align: "center" });

  // ── COLOR BAR at very bottom ──
  doc.setFillColor(cRL, cGL, cBL); doc.rect(0, 294, W, 3, "F");

  // ── FOOTER NEXA (all pages) — 3 elements only: powered by NEXA | confidencial | página ──
  const np = doc.getNumberOfPages();
  for (let p = 1; p <= np; p++) {
    doc.setPage(p);
    const fy = FOOTER_Y;
    // Left: powered by NEXA (text only, takes ~25mm max)
    doc.setFont(fontFamily, "normal"); doc.setFontSize(7); doc.setTextColor(156, 150, 134);
    doc.text("powered by", mg, fy);
    doc.setFont(fontFamily, "bold"); doc.setFontSize(8); doc.setTextColor(28, 27, 24);
    doc.text("NEXA", mg + 17, fy);
    // Center: Documento Confidencial
    doc.setFont(fontFamily, "normal"); doc.setFontSize(7); doc.setTextColor(180, 178, 172);
    doc.text("Documento Confidencial", W / 2, fy, { align: "center" });
    // Right: Página X/Y
    doc.text(`Página ${p}/${np}`, W - mg, fy, { align: "right" });
  }

  doc.save(`simulacao_Q${d.quadra}_L${d.lote}_${Date.now()}.pdf`);
}
