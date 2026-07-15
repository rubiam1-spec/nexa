// Esqueleto ÚNICO dos e-mails do NEXA (Capítulo E-mail). PURO (sem Deno/Supabase),
// testável e reutilizável por qualquer Edge. Tabelas + inline, fundo claro para
// entregabilidade. Fiel ao protótipo aprovado v2 (docs/design/PROTO_emails-nexa_v2.html).
// Cores exatas: #F4F2EE / #FFFFFF / #E4E1DA / #12110F / #4ADE80 / #E8B45A / #C2410C / #8A867C.

const LOGO_URL = "https://phpbsiyxwsbzeevqgixk.supabase.co/storage/v1/object/public/logos/nexa-lockup-horizontal-dark.png";
const APP_URL = "https://app.nexacomercial.com.br";

export type NexaCta = { label: string; url: string; primary?: boolean };
export type NexaDataItem = { label: string; value: string; link?: string };
export type NexaStat = { value: string; label: string; color?: string }; // trio do digest (E-mail 2)
export type NexaListItem = { name: string; note?: string; link?: string };
export interface NexaEmailData {
  badge?: { label: string; color: string }; // color = fundo do badge (texto sempre #12110F); ausente no digest
  timestamp?: string;                        // ex: "HOJE · 13:21"
  title: string;                             // Georgia itálico
  meta?: string;                             // linha de contexto (texto simples, escapado)
  stats?: NexaStat[];                        // até 3 números (E-mail 2 — "O pulso de hoje")
  list?: { label: string; items: NexaListItem[] }; // "PRECISAM DE VOCÊ"
  dataGrid?: NexaDataItem[];                 // pares rótulo-mono / valor
  highlightBand?: { label: string; value: string; note?: string }; // faixa âmbar
  nextStep?: string;                         // texto do "PRÓXIMO PASSO"
  ctas?: NexaCta[];                          // até 2
  ruler?: string;                            // faixa de destaque/urgência abaixo do card
  footer: { account?: string; development?: string; preferencesUrl?: string };
}

/** Escapa HTML (dados de usuário podem conter caracteres perigosos). */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ctasHtml(ctas: NexaCta[]): string {
  const cells = ctas.slice(0, 2).map((c, i) => {
    if (c.primary !== false && (i === 0 || c.primary)) {
      return `<td style="background-color:#12110F;border-radius:8px"><a href="${esc(c.url)}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:bold;color:#4ADE80;text-decoration:none">${esc(c.label)}</a></td>`;
    }
    return `<td style="padding-left:12px"><a href="${esc(c.url)}" style="display:inline-block;padding:12px 18px;font-size:14px;color:#12110F;text-decoration:underline">${esc(c.label)}</a></td>`;
  }).join("");
  return `<tr><td style="padding:0 28px 26px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`;
}

function dataGridHtml(items: NexaDataItem[]): string {
  const cell = (it: NexaDataItem, full: boolean, first: boolean) => {
    const val = it.link
      ? `<a href="${esc(it.link)}" style="color:#12110F;text-decoration:none">${esc(it.value)}</a>`
      : esc(it.value);
    const pad = first ? "14px 0 4px" : "10px 0 18px";
    return `<td width="${full ? "100%" : "50%"}"${full ? ' colspan="2"' : ""} style="padding:${pad}">`
      + `<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#8A867C">${esc(it.label)}</div>`
      + `<div style="font-size:15px;color:#12110F;padding-top:3px">${val}</div></td>`;
  };
  let rows = "", i = 0;
  while (i < items.length) {
    const first = i < 2;
    if (i + 1 < items.length) { rows += `<tr>${cell(items[i], false, first)}${cell(items[i + 1], false, first)}</tr>`; i += 2; }
    else { rows += `<tr>${cell(items[i], true, first)}</tr>`; i += 1; }
  }
  return `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEEBE4">${rows}</table></td></tr>`;
}

/** Trio de números do digest (E-mail 2). Bordas entre colunas, fiel ao protótipo. */
function statsHtml(stats: NexaStat[]): string {
  const cols = stats.slice(0, 3);
  const w = Math.floor(100 / cols.length);
  const cells = cols.map((st, i) =>
    `<td width="${w}%" align="center" style="padding:18px 0${i > 0 ? ";border-left:1px solid #EEEBE4" : ""}">`
    + `<div style="font-family:Georgia,serif;font-size:30px;color:${esc(st.color ?? "#12110F")}">${esc(st.value)}</div>`
    + `<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1px;color:#8A867C">${esc(st.label)}</div></td>`
  ).join("");
  return `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEEBE4"><tr>${cells}</tr></table></td></tr>`;
}

/** Lista "PRECISAM DE VOCÊ" do digest (E-mail 2). */
function listHtml(list: { label: string; items: NexaListItem[] }): string {
  const lines = list.items.map((it) => {
    const name = it.link ? `<a href="${esc(it.link)}" style="color:#12110F;text-decoration:none"><strong>${esc(it.name)}</strong></a>` : `<strong>${esc(it.name)}</strong>`;
    return `• ${name}${it.note ? ` — ${esc(it.note)}` : ""}`;
  }).join("<br>");
  return `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEEBE4"><tr><td style="padding:16px 0">`
    + `<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#8A867C;padding-bottom:8px">${esc(list.label)}</div>`
    + `<div style="font-size:14px;color:#12110F;line-height:1.7">${lines}</div></td></tr></table></td></tr>`;
}

export function renderNexaEmail(d: NexaEmailData): string {
  const badge = d.badge
    ? `<span style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#12110F;background-color:${esc(d.badge.color)};border-radius:99px;padding:5px 12px;font-weight:bold">${esc(d.badge.label)}</span>`
      + (d.timestamp ? `<span style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:1px;color:#8A867C;padding-left:10px">${esc(d.timestamp)}</span>` : "")
    : "";

  const band = d.highlightBand
    ? `<tr><td style="padding:0 28px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF6E9;border:1px solid #F0DDB4;border-radius:10px"><tr><td style="padding:14px 18px">`
      + `<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#A16207">${esc(d.highlightBand.label)}</div>`
      + `<div style="font-family:Georgia,serif;font-size:24px;color:#12110F;padding-top:3px">${esc(d.highlightBand.value)}</div>`
      + (d.highlightBand.note ? `<div style="font-size:12.5px;color:#8A867C;padding-top:4px">${esc(d.highlightBand.note)}</div>` : "")
      + `</td></tr></table></td></tr>`
    : "";

  const next = d.nextStep
    ? `<tr><td style="padding:0 28px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEEBE4"><tr><td style="padding:14px 0 16px">`
      + `<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#8A867C">PRÓXIMO PASSO</div>`
      + `<div style="font-size:14px;color:#12110F;padding-top:4px;line-height:1.55">${esc(d.nextStep)}</div>`
      + `</td></tr></table></td></tr>`
    : "";

  const footerLine = [d.footer.account, d.footer.development].filter(Boolean).map(esc).join(" · ");
  const prefUrl = d.footer.preferencesUrl ? `${APP_URL}${esc(d.footer.preferencesUrl)}` : `${APP_URL}/configuracoes`;

  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background-color:#F4F2EE;font-family:Arial,Helvetica,sans-serif">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F2EE"><tr><td align="center" style="padding:36px 24px 28px">`
    + `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">`
    + `<tr><td align="left" style="padding:0 4px 22px"><img src="${LOGO_URL}" alt="NEXA" height="24" style="height:24px;width:auto;display:block"></td></tr>`
    + `<tr><td style="background-color:#FFFFFF;border:1px solid #E4E1DA;border-radius:12px;padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">`
    + (badge ? `<tr><td style="padding:22px 28px 0">${badge}</td></tr>` : "")
    + `<tr><td style="padding:${badge ? "16px" : "24px"} 28px 4px"><div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:28px;line-height:1.15;color:#12110F">${esc(d.title)}</div></td></tr>`
    + (d.meta ? `<tr><td style="padding:0 28px 18px"><div style="font-size:13.5px;color:#6E6A61">${esc(d.meta)}</div></td></tr>` : `<tr><td style="padding:0 0 6px"></td></tr>`)
    + band
    + (d.stats && d.stats.length ? statsHtml(d.stats) : "")
    + (d.dataGrid && d.dataGrid.length ? dataGridHtml(d.dataGrid) : "")
    + (d.list && d.list.items.length ? listHtml(d.list) : "")
    + next
    + (d.ctas && d.ctas.length ? ctasHtml(d.ctas) : `<tr><td style="padding:0 0 20px"></td></tr>`)
    + `</table></td></tr>`
    + (d.ruler ? `<tr><td style="padding:14px 6px 0"><div style="font-size:12.5px;color:#8A867C;line-height:1.5">${esc(d.ruler)}</div></td></tr>` : "")
    + `<tr><td style="padding:26px 4px 0"><div style="border-top:1px solid #DDD9D0;padding-top:14px;font-size:11.5px;color:#8A867C;line-height:1.6">`
    + `NEXA Plataforma Comercial${footerLine ? " · " + footerLine : ""}<br>`
    + `<a href="${prefUrl}" style="color:#8A867C">Preferências de notificação</a>`
    + `</div></td></tr></table></td></tr></table></body></html>`;
}

/** Assunto padronizado: "NEXA — {evento}: {contexto}" (o chamador monta {evento}: {contexto}). */
export function nexaSubject(eventContext: string): string {
  return `NEXA — ${eventContext}`;
}
