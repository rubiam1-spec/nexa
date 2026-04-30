import jsPDF from "jspdf";
import { TLight } from "../../../shared/theme/lightTokens";
import { NEXA_LOGO_HEADER, NEXA_LOGO_FOOTER } from "../../../shared/utils/pdfLogos";
import { formatDateTimeBRT } from "../../../shared/utils/dateUtils";

function n(t: string): string {
  if (!t) return "";
  return t.replace(/[àáâãä]/g, "a").replace(/[ÀÁÂÃÄ]/g, "A").replace(/[èéêë]/g, "e").replace(/[ÈÉÊË]/g, "E").replace(/[ìíîï]/g, "i").replace(/[ÌÍÎÏ]/g, "I").replace(/[òóôõö]/g, "o").replace(/[ÒÓÔÕÖ]/g, "O").replace(/[ùúûü]/g, "u").replace(/[ÙÚÛÜ]/g, "U").replace(/ç/g, "c").replace(/Ç/g, "C").replace(/ñ/g, "n").replace(/Ñ/g, "N");
}
function fmtM(v: number) { return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toLocaleString("pt-BR")}`; }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function hex(h: string): [number, number, number] { const x = h.replace("#", ""); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }

const W = 210; const mg = 20; const cw = W - mg * 2;

async function loadFont(url: string): Promise<string | null> {
  try { const r = await fetch(url); if (!r.ok) return null; const b = await r.arrayBuffer(); const u = new Uint8Array(b); let s = ""; const c = 8192; for (let i = 0; i < u.length; i += c) s += String.fromCharCode(...u.subarray(i, i + c)); return btoa(s); } catch { return null; }
}

// ── Logo: embedded base64 PNG (light version for white PDF background) ──
function drawNexaLogo(doc: jsPDF, ff: string, x: number, y: number): number {
  try {
    doc.addImage(NEXA_LOGO_HEADER, "PNG", x - 2, y - 4, 80, 17);
  } catch (e) {
    console.warn("[PDF] Header logo failed, using text:", e);
    doc.setFillColor(74, 222, 128); doc.roundedRect(x, y - 2, 12, 12, 2, 2, "F");
    doc.setFont(ff, "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.text("N", x + 6, y + 5.5, { align: "center" });
    doc.setFontSize(13); doc.setTextColor(18, 17, 15); doc.text("NEXA", x + 16, y + 4);
    doc.setFont(ff, "normal"); doc.setFontSize(5.5); doc.setTextColor(153, 153, 153); doc.text("PLATAFORMA COMERCIAL", x + 16, y + 9);
  }
  return y + 26;
}

async function setupDoc(title: string, subtitle: string, period: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let ff = "helvetica";
  try {
    const [r, m] = await Promise.all([loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf"), loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf")]);
    if (r && m) { doc.addFileToVFS("R.ttf", r); doc.addFont("R.ttf", "Roboto", "normal"); doc.addFileToVFS("M.ttf", m); doc.addFont("M.ttf", "Roboto", "bold"); doc.setFont("Roboto"); ff = "Roboto"; }
  } catch { /* */ }
  const t = (s: string) => ff === "Roboto" ? s : n(s);

  let y = mg;
  y = drawNexaLogo(doc, ff, mg, y);
  doc.setFont(ff, "bold"); doc.setFontSize(15); doc.setTextColor(...hex(TLight.textPrimary));
  doc.text(t(title), mg, y);
  doc.setFont(ff, "normal"); doc.setFontSize(9); doc.setTextColor(...hex(TLight.textSecondary));
  doc.text(t(subtitle), mg, y + 7);
  if (period) {
    doc.setFont(ff, "normal"); doc.setFontSize(8); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(t(`Período: ${period}`), W - mg, y, { align: "right" });
  }
  doc.text(t(`Gerado em ${formatDateTimeBRT(new Date())}`), W - mg, y + 5, { align: "right" });
  y += 12;
  doc.setDrawColor(...hex(TLight.textPrimary)); doc.setLineWidth(0.3); doc.line(mg, y, W - mg, y);
  y += 12;
  return { doc, t, ff, y };
}

function footer(doc: jsPDF, ff: string, t: (s: string) => string) {
  const p = doc.getNumberOfPages();
  for (let i = 1; i <= p; i++) {
    doc.setPage(i); const fy = 288;
    // "powered by NEXA" logo
    try { doc.addImage(NEXA_LOGO_FOOTER, "PNG", mg - 2, fy - 5, 60, 10.5); } catch { doc.setFont(ff, "normal"); doc.setFontSize(7); doc.setTextColor(156, 150, 134); doc.text("powered by", mg, fy + 1); doc.setFillColor(18, 17, 15); doc.roundedRect(mg + 18, fy - 2.2, 4.5, 4.5, 0.8, 0.8, "F"); doc.setFont(ff, "bold"); doc.setFontSize(3); doc.setTextColor(74, 222, 128); doc.text("N", mg + 19.3, fy + 0.5); doc.setFontSize(8); doc.setTextColor(28, 27, 24); doc.text("NEXA", mg + 24.5, fy + 1); }
    // Separator + Confidencial
    doc.setFont(ff, "normal"); doc.setFontSize(7); doc.setTextColor(180, 178, 172);
    doc.text(t("· Documento Confidencial"), mg + 62, fy + 1);
    // Page
    doc.text(t(`Página ${i}/${p}`), W - mg, fy + 1, { align: "right" });
  }
}

function secLabel(doc: jsPDF, ff: string, t: (s: string) => string, label: string, y: number): number {
  doc.setFont(ff, "bold"); doc.setFontSize(7.5); doc.setTextColor(...hex(TLight.textSecondary));
  doc.text(t(label.toUpperCase()), mg, y);
  return y + 7;
}

function newPage(doc: jsPDF, y: number, need: number): number {
  if (y + need > 275) { doc.addPage(); return mg + 4; }
  return y;
}

function drawKpis(doc: jsPDF, ff: string, t: (s: string) => string, y: number, kpis: { label: string; value: string; sub?: string; color?: string }[]): number {
  const bw = (cw - 3 * 4) / 4;
  for (let i = 0; i < kpis.length; i++) {
    const x = mg + i * (bw + 4); const k = kpis[i]; const c = k.color ? hex(k.color) : hex(TLight.sprout);
    doc.setFillColor(...hex(TLight.surface)); doc.roundedRect(x, y, bw, 20, 1.5, 1.5, "F");
    doc.setFillColor(c[0], c[1], c[2]); doc.rect(x, y + 3, 0.8, 14, "F");
    doc.setFont(ff, "normal"); doc.setFontSize(6.5); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(t(k.label.toUpperCase()), x + 4, y + 6);
    doc.setFont(ff, "bold"); doc.setFontSize(16); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(k.value), x + 4, y + 14);
    if (k.sub) { doc.setFont(ff, "normal"); doc.setFontSize(7); doc.setTextColor(...hex(TLight.textTertiary)); doc.text(t(k.sub), x + 4, y + 18); }
  }
  return y + 28;
}

// ══════════════════════════════════════════
// VENDAS
// ══════════════════════════════════════════

export interface VendasPdfData {
  sold: number; vgvSold: number; avgTicket: number; conversionRate: number;
  funnel: { label: string; count: number; pct: number; color: string }[];
  brokerStats: { name: string; neg: number; sales: number; vgv: number; conv: number }[];
  quadraStats: { quadra: string; total: number; available: number; reserved: number; sold: number; pctSold: number; vgvSold: number }[];
}

export async function gerarPdfVendas(cfg: { period: string; contaNome: string; empreendimentoNome: string }, d: VendasPdfData) {
  const { doc, t, ff, y: sy } = await setupDoc("Relatorio de Vendas", `${cfg.empreendimentoNome} · ${cfg.contaNome}`, cfg.period);
  let y = sy;

  y = drawKpis(doc, ff, t, y, [
    { label: "Vendas", value: `${d.sold}`, sub: "unidades", color: TLight.teal },
    { label: "VGV Vendido", value: t(fmtM(d.vgvSold)), color: TLight.blue },
    { label: "Ticket Medio", value: t(fmtM(d.avgTicket)), color: TLight.purple },
    { label: "Conversao", value: `${d.conversionRate}%`, sub: "neg > venda", color: TLight.amber },
  ]);

  // Funnel
  y = secLabel(doc, ff, t, "Funil de conversao", y);
  const widths = [cw, cw * 0.78, cw * 0.55, cw * 0.38];
  const fcMap: Record<string, [string, string]> = { [TLight.blue]: [TLight.blueBg, TLight.blue], [TLight.purple]: [TLight.purpleBg, TLight.purple], [TLight.amber]: [TLight.amberBg, TLight.amber], [TLight.sprout]: [TLight.sproutBg, TLight.sprout] };
  for (let i = 0; i < d.funnel.length; i++) {
    const f = d.funnel[i]; const fw = widths[i]; const fx = mg + (cw - fw) / 2;
    const [bg, ac] = fcMap[f.color] || [TLight.surface, TLight.textSecondary];
    doc.setFillColor(...hex(bg)); doc.roundedRect(fx, y, fw, 10, 1.5, 1.5, "F");
    doc.setFillColor(...hex(ac)); doc.rect(fx, y + 2, 1, 6, "F");
    doc.setFont(ff, "normal"); doc.setFontSize(10); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(f.label), fx + 5, y + 6.5);
    doc.setFont(ff, "bold"); doc.setFontSize(13); doc.setTextColor(...hex(ac));
    doc.text(`${f.count}`, fx + fw - 22, y + 7);
    doc.setFont(ff, "normal"); doc.setFontSize(8); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(`${f.pct}%`, fx + fw - 4, y + 7, { align: "right" });
    y += 13;
  }
  y += 10;

  // Broker bars
  y = newPage(doc, y, 20 + d.brokerStats.length * 14);
  y = secLabel(doc, ff, t, "Vendas por corretor", y);
  const maxBS = Math.max(...d.brokerStats.map((b) => b.sales), 1);
  for (const b of d.brokerStats) {
    y = newPage(doc, y, 14);
    doc.setFillColor(...hex(TLight.sproutBg)); doc.circle(mg + 3.5, y + 3, 3.5, "F");
    doc.setFont(ff, "bold"); doc.setFontSize(5.5); doc.setTextColor(...hex(TLight.sprout));
    doc.text(initials(b.name), mg + 3.5, y + 4.2, { align: "center" });
    doc.setFont(ff, "bold"); doc.setFontSize(10); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(b.name), mg + 10, y + 3.5);
    doc.setFont(ff, "normal"); doc.setFontSize(8); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(t(`${b.sales} vendas · ${fmtM(b.vgv)} · ${b.conv}%`), W - mg, y + 3.5, { align: "right" });
    const by = y + 7;
    doc.setFillColor(...hex(TLight.borderLight)); doc.roundedRect(mg + 10, by, cw - 10, 2.5, 1, 1, "F");
    doc.setFillColor(...hex(TLight.sprout)); doc.roundedRect(mg + 10, by, Math.max((b.sales / maxBS) * (cw - 10), 2), 2.5, 1, 1, "F");
    y += 14;
  }
  y += 10;

  // Quadra table
  y = newPage(doc, y, 30);
  y = secLabel(doc, ff, t, "Vendas por quadra", y);
  const cols = [mg, mg + 22, mg + 38, mg + 52, mg + 66, mg + 80, mg + 130];
  doc.setFillColor(...hex(TLight.surface)); doc.rect(mg, y - 3.5, cw, 7, "F");
  doc.setFont(ff, "bold"); doc.setFontSize(6.5); doc.setTextColor(...hex(TLight.textTertiary));
  ["QUADRA", "LOTES", "DISP.", "RES.", "VEND.", "% VENDIDA", "VGV VEND."].forEach((h, i) => doc.text(t(h), cols[i], y));
  y += 6;
  for (let i = 0; i < d.quadraStats.length; i++) {
    y = newPage(doc, y, 8);
    const q = d.quadraStats[i];
    if (i % 2 === 1) { doc.setFillColor(...hex(TLight.surfaceAlt)); doc.rect(mg, y - 3.5, cw, 7, "F"); }
    doc.setFont(ff, "normal"); doc.setFontSize(8.5); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(`Q${q.quadra}`), cols[0], y); doc.text(`${q.total}`, cols[1], y); doc.text(`${q.available}`, cols[2], y); doc.text(`${q.reserved}`, cols[3], y); doc.text(`${q.sold}`, cols[4], y);
    const bx = cols[5]; const bw = 40;
    doc.setFillColor(...hex(TLight.borderLight)); doc.roundedRect(bx, y - 1.5, bw, 2, 0.5, 0.5, "F");
    const bc = q.pctSold > 70 ? TLight.red : q.pctSold > 30 ? TLight.amber : TLight.teal;
    doc.setFillColor(...hex(bc)); doc.roundedRect(bx, y - 1.5, Math.max((q.pctSold / 100) * bw, 1), 2, 0.5, 0.5, "F");
    doc.setFont(ff, "normal"); doc.setFontSize(7); doc.setTextColor(...hex(bc));
    doc.text(`${q.pctSold}%`, bx + bw + 2, y);
    doc.setFont(ff, "normal"); doc.setFontSize(8.5); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(fmtM(q.vgvSold)), cols[6], y);
    y += 7;
  }
  doc.setDrawColor(...hex(TLight.textTertiary)); doc.setLineWidth(0.3); doc.line(mg, y - 1, W - mg, y - 1);
  y += 2;
  const tt = d.quadraStats.reduce((s, q) => ({ t: s.t + q.total, a: s.a + q.available, r: s.r + q.reserved, s: s.s + q.sold, v: s.v + q.vgvSold }), { t: 0, a: 0, r: 0, s: 0, v: 0 });
  doc.setFont(ff, "bold"); doc.setFontSize(8.5); doc.setTextColor(...hex(TLight.textPrimary));
  doc.text(t("Total"), cols[0], y); doc.text(`${tt.t}`, cols[1], y); doc.text(`${tt.a}`, cols[2], y); doc.text(`${tt.r}`, cols[3], y); doc.text(`${tt.s}`, cols[4], y);
  doc.text(`${pct(tt.s, tt.t)}%`, cols[5] + 42, y); doc.text(t(fmtM(tt.v)), cols[6], y);

  footer(doc, ff, t);
  doc.save(`relatorio_vendas_${Date.now()}.pdf`);
}

// ══════════════════════════════════════════
// EQUIPE
// ══════════════════════════════════════════

export interface EquipePdfData {
  brokerStats: { name: string; neg: number; sales: number; vgv: number; conv: number }[];
}

export async function gerarPdfEquipe(cfg: { period: string; contaNome: string; empreendimentoNome: string }, d: EquipePdfData) {
  const { doc, t, ff, y: sy } = await setupDoc("Desempenho da Equipe", `${cfg.empreendimentoNome} · ${cfg.contaNome}`, cfg.period);
  let y = sy;

  y = secLabel(doc, ff, t, "Ranking de corretores", y);
  for (let i = 0; i < d.brokerStats.length; i++) {
    y = newPage(doc, y, 30);
    const b = d.brokerStats[i];
    const medal = i === 0 ? "#1" : i === 1 ? "#2" : i === 2 ? "#3" : `#${i + 1}`;
    doc.setFillColor(...hex(TLight.surface)); doc.roundedRect(mg, y, cw, 24, 2, 2, "F");
    doc.setFillColor(...hex(TLight.sproutBg)); doc.circle(mg + 9, y + 8, 5, "F");
    doc.setFont(ff, "bold"); doc.setFontSize(7); doc.setTextColor(...hex(TLight.sprout));
    doc.text(initials(b.name), mg + 9, y + 9.5, { align: "center" });
    doc.setFont(ff, "bold"); doc.setFontSize(9); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(t(medal), mg + 17, y + 6.5);
    doc.setFont(ff, "bold"); doc.setFontSize(12); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(b.name), mg + 24, y + 6.5);
    doc.setFont(ff, "normal"); doc.setFontSize(8); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(t(`Negociacoes: ${b.neg}  ·  Vendas: ${b.sales}  ·  VGV: ${fmtM(b.vgv)}  ·  Conversao: ${b.conv}%`), mg + 17, y + 13);
    doc.setFillColor(...hex(TLight.borderLight)); doc.roundedRect(mg + 5, y + 18, cw - 10, 3, 1, 1, "F");
    doc.setFillColor(...hex(b.conv > 30 ? TLight.teal : TLight.blue)); doc.roundedRect(mg + 5, y + 18, Math.max((b.conv / 100) * (cw - 10), 2), 3, 1, 1, "F");
    y += 30;
  }
  if (d.brokerStats.length === 0) { doc.setFont(ff, "normal"); doc.setFontSize(9); doc.setTextColor(...hex(TLight.textTertiary)); doc.text(t("Nenhum membro com dados no periodo."), mg, y); }

  footer(doc, ff, t);
  doc.save(`relatorio_equipe_${Date.now()}.pdf`);
}

// ══════════════════════════════════════════
// ESTOQUE
// ══════════════════════════════════════════

export interface EstoquePdfData {
  totalUnits: number; available: number; reserved: number; sold: number;
  vgvTotal: number; vgvAvailable: number; vgvSold: number;
  quadraStats: { quadra: string; total: number; available: number; reserved: number; sold: number; pctSold: number; vgvTotal: number; vgvAvailable: number; vgvSold: number }[];
}

export async function gerarPdfEstoque(cfg: { period: string; contaNome: string; empreendimentoNome: string }, d: EstoquePdfData) {
  const { doc, t, ff, y: sy } = await setupDoc("Estoque de Unidades", `${cfg.empreendimentoNome} · ${cfg.contaNome}`, "");
  let y = sy;

  y = drawKpis(doc, ff, t, y, [
    { label: "Total lotes", value: `${d.totalUnits}` },
    { label: "Disponiveis", value: `${d.available}`, sub: `${pct(d.available, d.totalUnits)}%`, color: TLight.teal },
    { label: "Reservados", value: `${d.reserved}`, sub: `${pct(d.reserved, d.totalUnits)}%`, color: TLight.amber },
    { label: "Vendidos", value: `${d.sold}`, sub: `${pct(d.sold, d.totalUnits)}%`, color: TLight.purple },
  ]);

  doc.setFont(ff, "normal"); doc.setFontSize(8); doc.setTextColor(...hex(TLight.textTertiary));
  doc.text(t(`VGV Total: ${fmtM(d.vgvTotal)}  ·  VGV Disponivel: ${fmtM(d.vgvAvailable)}  ·  VGV Vendido: ${fmtM(d.vgvSold)}`), mg, y);
  y += 10;

  y = secLabel(doc, ff, t, "Mapa de calor por quadra", y);
  for (const q of d.quadraStats) {
    y = newPage(doc, y, 12);
    doc.setFont(ff, "bold"); doc.setFontSize(9); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(`Quadra ${q.quadra}`), mg, y);
    doc.setFont(ff, "normal"); doc.setFontSize(7.5); doc.setTextColor(...hex(TLight.textTertiary));
    doc.text(t(`${q.pctSold}% (${q.sold}/${q.total}) · ${fmtM(q.vgvSold)}`), W - mg, y, { align: "right" });
    const by = y + 3;
    doc.setFillColor(...hex(TLight.borderLight)); doc.roundedRect(mg, by, cw, 3, 1, 1, "F");
    const bc = q.pctSold > 70 ? TLight.red : q.pctSold > 30 ? TLight.amber : TLight.teal;
    doc.setFillColor(...hex(bc)); doc.roundedRect(mg, by, Math.max((q.pctSold / 100) * cw, 2), 3, 1, 1, "F");
    y += 12;
  }
  y += 8;

  // Table
  y = newPage(doc, y, 30);
  y = secLabel(doc, ff, t, "Detalhamento por quadra", y);
  const ec = [mg, mg + 18, mg + 32, mg + 44, mg + 56, mg + 68, mg + 92, mg + 120, mg + 148];
  doc.setFillColor(...hex(TLight.surface)); doc.rect(mg, y - 3.5, cw, 7, "F");
  doc.setFont(ff, "bold"); doc.setFontSize(6); doc.setTextColor(...hex(TLight.textTertiary));
  ["QUADRA", "LOTES", "DISP.", "RES.", "VEND.", "% VEND.", "VGV TOTAL", "VGV DISP.", "VGV VEND."].forEach((h, i) => doc.text(t(h), ec[i], y));
  y += 6;
  for (let i = 0; i < d.quadraStats.length; i++) {
    y = newPage(doc, y, 7);
    const q = d.quadraStats[i];
    if (i % 2 === 1) { doc.setFillColor(...hex(TLight.surfaceAlt)); doc.rect(mg, y - 3, cw, 6, "F"); }
    doc.setFont(ff, "normal"); doc.setFontSize(7.5); doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(`Q${q.quadra}`), ec[0], y); doc.text(`${q.total}`, ec[1], y); doc.text(`${q.available}`, ec[2], y); doc.text(`${q.reserved}`, ec[3], y); doc.text(`${q.sold}`, ec[4], y);
    const bc2 = q.pctSold > 70 ? TLight.red : q.pctSold > 30 ? TLight.amber : TLight.teal;
    doc.setTextColor(...hex(bc2)); doc.text(`${q.pctSold}%`, ec[5], y);
    doc.setTextColor(...hex(TLight.textPrimary));
    doc.text(t(fmtM(q.vgvTotal)), ec[6], y); doc.text(t(fmtM(q.vgvAvailable)), ec[7], y); doc.text(t(fmtM(q.vgvSold)), ec[8], y);
    y += 6;
  }
  doc.setDrawColor(...hex(TLight.textTertiary)); doc.setLineWidth(0.3); doc.line(mg, y - 1, W - mg, y - 1);
  y += 3;
  doc.setFont(ff, "bold"); doc.setFontSize(7.5); doc.setTextColor(...hex(TLight.textPrimary));
  doc.text(t("Total"), ec[0], y); doc.text(`${d.totalUnits}`, ec[1], y); doc.text(`${d.available}`, ec[2], y); doc.text(`${d.reserved}`, ec[3], y); doc.text(`${d.sold}`, ec[4], y); doc.text(`${pct(d.sold, d.totalUnits)}%`, ec[5], y);
  doc.text(t(fmtM(d.vgvTotal)), ec[6], y); doc.text(t(fmtM(d.vgvAvailable)), ec[7], y); doc.text(t(fmtM(d.vgvSold)), ec[8], y);

  footer(doc, ff, t);
  doc.save(`relatorio_estoque_${Date.now()}.pdf`);
}
