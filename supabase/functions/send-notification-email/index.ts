import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth, unauthorized, forbidden, requireRole, checkRateLimit, rateLimited } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Shared building blocks ──

function header(accountName?: string, devName?: string): string {
  const branding = accountName || devName
    ? `<p style="color:#8A8985;font-size:11px;margin:8px 0 0;letter-spacing:0.1em;">${[accountName, devName].filter(Boolean).join(" · ")}</p>`
    : "";
  return `<div style="text-align:center;margin-bottom:28px;"><div style="display:inline-block;background:#1C1B18;border:1px solid #2A2926;border-radius:12px;padding:10px 20px;"><span style="color:#4ADE80;font-size:20px;font-weight:700;letter-spacing:0.05em;">NEXA</span></div>${branding}</div>`;
}

function footer(accountName?: string): string {
  const acct = accountName ? `<p style="color:#5A5955;font-size:11px;margin:0;">${accountName}</p>` : "";
  return `<div style="text-align:center;margin-top:24px;">${acct}<p style="color:#5A5955;font-size:11px;margin:4px 0 0;">NEXA Plataforma Comercial · app.nexacomercial.com.br</p></div>`;
}

function wrap(body: string, acctName?: string, devName?: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#12110F;font-family:Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:40px 20px;">${header(acctName, devName)}${body}${footer(acctName)}</div></body></html>`;
}

function cardOpen(barColor = "#4ADE80"): string {
  return `<div style="background:#1C1B18;border:1px solid #2A2926;border-radius:12px;overflow:hidden;"><div style="height:4px;background:${barColor};"></div><div style="padding:28px;">`;
}
const cardClose = `</div></div>`;

function btn(url: string, label: string): string {
  return `<a href="${url}" style="display:block;text-align:center;padding:14px;background:#4ADE80;color:#12110F;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;margin-top:24px;">${label}</a>`;
}

function row(label: string, value: string, color = "#E8E6E1", bold = false): string {
  const fw = bold ? "font-weight:700;font-size:16px;" : "font-weight:500;font-size:13px;";
  return `<tr><td style="color:#8A8985;font-size:12px;padding:6px 0;">${label}</td><td style="color:${color};${fw}font-family:monospace;text-align:right;padding:6px 0;">${value}</td></tr>`;
}

function sep(): string {
  return `<tr><td colspan="2" style="padding:4px 0;"><div style="height:1px;background:#2A2926;"></div></td></tr>`;
}

function dataCard(rows: string): string {
  return `<div style="background:#12110F;border-radius:8px;border-left:3px solid #4ADE80;padding:16px 16px 16px 20px;margin-bottom:24px;"><table style="width:100%;border-collapse:collapse;">${rows}</table></div>`;
}

// ── Templates ──

function renderNewProposal(title: string, message: string, url: string, m: Record<string, unknown>): string {
  const rows = [
    m.client_name ? row("Cliente", String(m.client_name)) : "",
    m.unit_label ? row("Unidade", String(m.unit_label)) : "",
    sep(),
    m.total_value ? row("Valor proposto", String(m.total_value), "#4ADE80", true) : "",
    m.entrada ? row("Entrada", String(m.entrada)) : "",
    m.parcelas ? row("Parcelas", String(m.parcelas)) : "",
    sep(),
    m.sent_by ? row("Enviada por", String(m.sent_by)) : "",
    m.development_name ? row("Empreendimento", String(m.development_name)) : "",
  ].filter(Boolean).join("");
  return cardOpen() +
    `<p style="color:#8A8985;font-size:13px;margin:0 0 6px;">Olá</p>` +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">${title}</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 24px;">${message}</p>` +
    dataCard(rows) + btn(url, "Analisar proposta no NEXA") + cardClose;
}

function renderDocsReady(title: string, message: string, url: string): string {
  return cardOpen("#A78BFA") +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">Documentos prontos para análise</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 8px;">${message}</p>` +
    `<p style="color:#A78BFA;font-size:13px;margin:0 0 16px;">Os documentos do cliente estão disponíveis para análise e preparação da minuta do contrato.</p>` +
    btn(url, "Analisar documentos") + cardClose;
}

function renderDocRejected(title: string, message: string, url: string): string {
  return cardOpen("#E24B4A") +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">${title}</h2>` +
    `<p style="color:#E24B4A;font-size:14px;line-height:1.6;margin:0 0 8px;">${message}</p>` +
    `<p style="color:#8A8985;font-size:13px;margin:0 0 16px;">Por favor, reenvie o documento corrigido o mais rápido possível para não atrasar o processo.</p>` +
    btn(url, "Reenviar documento") + cardClose;
}

function renderProposalApproved(title: string, message: string, url: string): string {
  return cardOpen() +
    `<h2 style="color:#4ADE80;font-size:22px;font-weight:600;margin:0 0 8px;">Proposta aprovada</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0;">${message}</p>` +
    btn(url, "Ver no NEXA") + cardClose;
}

function renderProposalRejected(title: string, message: string, url: string): string {
  return cardOpen("#E24B4A") +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">Proposta recusada</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0;">${message}</p>` +
    btn(url, "Ver negociação") + cardClose;
}

function renderCounterProposal(title: string, message: string, url: string): string {
  return cardOpen("#F59E0B") +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">Contraproposta recebida</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 8px;">${message}</p>` +
    `<p style="color:#F59E0B;font-size:13px;margin:0 0 16px;">Novos termos disponíveis para análise.</p>` +
    btn(url, "Ver contraproposta") + cardClose;
}

function renderReservationRequested(title: string, message: string, url: string, m: Record<string, unknown>): string {
  const rows = [
    m.client_name ? row("Cliente", String(m.client_name)) : "",
    m.unit_label ? row("Unidade", String(m.unit_label)) : "",
    m.sent_by ? row("Solicitada por", String(m.sent_by)) : "",
  ].filter(Boolean).join("");
  return cardOpen("#F59E0B") +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">Reserva solicitada</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 16px;">${message}</p>` +
    (rows ? dataCard(rows) : "") +
    btn(url, "Analisar no NEXA") + cardClose;
}

function renderReservationApproved(title: string, message: string, url: string): string {
  return cardOpen() +
    `<h2 style="color:#4ADE80;font-size:22px;font-weight:600;margin:0 0 8px;">Reserva aprovada</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0;">${message}</p>` +
    btn(url, "Ver no NEXA") + cardClose;
}

function renderReservationRejected(title: string, message: string, url: string): string {
  return cardOpen("#E24B4A") +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;">Reserva recusada</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0;">${message}</p>` +
    btn(url, "Ver no NEXA") + cardClose;
}

function renderSaleRegistered(title: string, message: string, url: string, m: Record<string, unknown>): string {
  const rows = [
    m.client_name ? row("Cliente", String(m.client_name)) : "",
    m.unit_label ? row("Unidade", String(m.unit_label)) : "",
    sep(),
    m.total_value ? row("Valor", String(m.total_value), "#4ADE80", true) : "",
    m.sent_by ? row("Vendido por", String(m.sent_by)) : "",
  ].filter(Boolean).join("");
  return cardOpen() +
    `<div style="text-align:center;margin-bottom:16px;"><div style="width:64px;height:64px;border-radius:50%;background:rgba(74,222,128,0.15);display:inline-flex;align-items:center;justify-content:center;"><span style="color:#4ADE80;font-size:32px;">&#9733;</span></div></div>` +
    `<h2 style="color:#4ADE80;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Venda registrada!</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 16px;text-align:center;">${message}</p>` +
    (rows ? dataCard(rows) : "") +
    btn(url, "Ver no NEXA") + cardClose;
}

function renderClientReady(title: string, message: string, url: string): string {
  return cardOpen() +
    `<div style="text-align:center;margin-bottom:16px;"><div style="width:64px;height:64px;border-radius:50%;background:rgba(74,222,128,0.15);display:inline-flex;align-items:center;justify-content:center;"><span style="color:#4ADE80;font-size:32px;">&#10003;</span></div></div>` +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Cliente pronto para contrato</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 8px;text-align:center;">${message}</p>` +
    `<p style="color:#4ADE80;font-size:13px;margin:0 0 16px;text-align:center;">Todos os documentos foram aprovados. Pronto para a minuta do contrato.</p>` +
    btn(url, "Ver cliente no NEXA") + cardClose;
}

function renderWeeklyReport(_title: string, _msg: string, url: string, m: Record<string, unknown>): string {
  const ta = m.total_activities ?? 0;
  const th = m.total_hours ?? "0";
  const tn = m.total_negotiations ?? 0;
  const ts = m.total_sales ?? 0;
  const ws = m.week_start ?? "";
  const we = m.week_end ?? "";
  const dn = m.development_name ? String(m.development_name) : "";
  const an = m.account_name ? String(m.account_name) : "";
  const ranking = (m.ranking as [string, { count: number; hours: number }][]) || [];

  function kpi(label: string, value: string | number, color = "#E8E6E1"): string {
    return `<td style="background:#12110F;border-radius:8px;padding:16px;text-align:center;width:50%;"><p style="color:#8A8985;font-size:10px;margin:0;letter-spacing:0.1em;">${label}</p><p style="color:${color};font-size:28px;font-weight:700;margin:6px 0 0;font-family:monospace;">${value}</p></td>`;
  }

  const maxCount = ranking.length > 0 ? ranking[0][1].count : 1;
  const rankRows = ranking.map((r, i) => {
    const pct = Math.round((r[1].count / maxCount) * 100);
    const medal = i === 0 ? "&#x1F947;" : i === 1 ? "&#x1F948;" : i === 2 ? "&#x1F949;" : `${i + 1}&#186;`;
    return `<div style="padding:10px 0;${i < ranking.length - 1 ? "border-bottom:1px solid #2A2926;" : ""}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:14px;">${medal}</span><span style="color:#E8E6E1;font-size:13px;font-weight:500;">${r[0]}</span></div><div style="display:flex;gap:12px;"><span style="color:#4ADE80;font-size:12px;font-family:monospace;">${r[1].count} ativ.</span><span style="color:#8A8985;font-size:12px;font-family:monospace;">${r[1].hours.toFixed(1)}h</span></div></div><div style="height:4px;background:#2A2926;border-radius:2px;overflow:hidden;"><div style="height:4px;background:#4ADE80;border-radius:2px;width:${pct}%;"></div></div></div>`;
  }).join("");

  const sub = [dn, an].filter(Boolean).join(" · ");

  return cardOpen("linear-gradient(90deg, #4ADE80, #10B981)") +
    `<p style="color:#8A8985;font-size:13px;margin:0 0 6px;">Olá</p>` +
    `<h2 style="color:#E8E6E1;font-size:22px;font-weight:600;margin:0 0 4px;">Relatório semanal</h2>` +
    (sub ? `<p style="color:#8A8985;font-size:13px;margin:0 0 4px;">${sub}</p>` : "") +
    `<p style="color:#8A8985;font-size:12px;margin:0 0 24px;">${ws} a ${we}</p>` +
    `<table style="width:100%;border-collapse:separate;border-spacing:8px;" cellpadding="0"><tr>${kpi("ATIVIDADES", ta, "#4ADE80")}${kpi("HORAS EM CAMPO", th + "h")}</tr><tr>${kpi("NEGOCIAÇÕES", tn)}${kpi("VENDAS", ts, "#4ADE80")}</tr></table>` +
    (ranking.length > 0 ? `<p style="color:#8A8985;font-size:11px;letter-spacing:0.1em;margin:24px 0 10px;">RANKING DA EQUIPE</p><div style="background:#12110F;border-radius:8px;padding:4px 16px;">${rankRows}</div>` : "") +
    btn(url, "Ver relatório completo no NEXA") +
    (() => {
      const aid = m.account_id ? String(m.account_id) : "";
      if (!aid) return "";
      const pdfUrl = `https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/weekly-report-pdf?account_id=${aid}&week_start=${ws}&week_end=${we}`;
      return `<a href="${pdfUrl}" style="display:block;text-align:center;padding:14px;background:transparent;color:#4ADE80;font-size:14px;font-weight:500;border-radius:8px;text-decoration:none;margin-top:10px;border:1.5px solid #2A2926;">Baixar relatório em PDF</a>`;
    })() +
    cardClose;
}

function renderBrokerageManagerAssigned(_title: string, message: string, url: string, m: Record<string, unknown>): string {
  const brokerageName = m.brokerage_name ? String(m.brokerage_name) : "sua imobiliária";
  return cardOpen("#4ADE80") +
    `<div style="text-align:center;margin-bottom:16px;"><div style="width:64px;height:64px;border-radius:50%;background:rgba(74,222,128,0.15);display:inline-flex;align-items:center;justify-content:center;"><span style="color:#4ADE80;font-size:28px;">&#9733;</span></div></div>` +
    `<h2 style="color:#E8E6E1;font-size:20px;font-weight:600;margin:0 0 8px;text-align:center;">Você foi definido como gestor</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;">${message || `Você agora é gestor da imobiliária ${brokerageName}.`}</p>` +
    `<div style="background:#12110F;border-radius:8px;padding:16px 20px;margin-bottom:24px;">` +
    `<p style="color:#8A8985;font-size:11px;letter-spacing:0.1em;margin:0 0 12px;">COMO GESTOR, VOCÊ PODE:</p>` +
    `<p style="color:#E8E6E1;font-size:13px;line-height:1.8;margin:0;">` +
    `✓ Visualizar as negociações de toda a sua equipe<br>` +
    `✓ Acompanhar métricas e desempenho dos corretores<br>` +
    `✓ Ter visão completa do pipeline da imobiliária</p></div>` +
    btn(url, "Acessar o NEXA") + cardClose;
}

function renderGeneric(title: string, message: string, url: string): string {
  return cardOpen() +
    `<h2 style="color:#E8E6E1;font-size:18px;font-weight:600;margin:0 0 12px;">${title}</h2>` +
    `<p style="color:#8A8985;font-size:14px;line-height:1.6;margin:0 0 24px;">${message || ""}</p>` +
    btn(url, "Ver no NEXA") + cardClose;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: allow service_role (internal calls from other functions/cron) or authenticated users with role
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "___never___");

    if (!isServiceRole) {
      const auth = await validateAuth(req);
      if (!auth) return unauthorized("Autenticação necessária");
      if (!requireRole(auth, ["owner", "director", "manager"])) return forbidden("Sem permissão para enviar emails");
      if (!checkRateLimit(`email:${auth.userId}`, 20, 60000)) return rateLimited();
    }

    const { recipient_id, type, title, message, action_url, metadata } = await req.json();
    if (!recipient_id || !title) {
      return new Response(JSON.stringify({ error: "recipient_id and title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.admin.getUserById(recipient_id);
    const email = user?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Recipient email not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appUrl = "https://app.nexacomercial.com.br";
    const fullUrl = action_url ? `${appUrl}${action_url}` : appUrl;
    const m = (metadata || {}) as Record<string, unknown>;
    const acctName = m.account_name as string | undefined;
    const devName = m.development_name as string | undefined;

    let body: string;
    switch (type) {
      case "new_proposal": body = renderNewProposal(title, message || "", fullUrl, m); break;
      case "docs_ready_for_review": body = renderDocsReady(title, message || "", fullUrl); break;
      case "doc_rejected": body = renderDocRejected(title, message || "", fullUrl); break;
      case "proposal_approved": body = renderProposalApproved(title, message || "", fullUrl); break;
      case "proposal_rejected": body = renderProposalRejected(title, message || "", fullUrl); break;
      case "counter_proposal": body = renderCounterProposal(title, message || "", fullUrl); break;
      case "reservation_requested": body = renderReservationRequested(title, message || "", fullUrl, m); break;
      case "reservation_approved": body = renderReservationApproved(title, message || "", fullUrl); break;
      case "reservation_rejected": body = renderReservationRejected(title, message || "", fullUrl); break;
      case "sale_registered": body = renderSaleRegistered(title, message || "", fullUrl, m); break;
      case "client_ready_for_contract": body = renderClientReady(title, message || "", fullUrl); break;
      case "weekly_report": body = renderWeeklyReport(title, message || "", fullUrl, m); break;
      case "brokerage_manager_assigned": body = renderBrokerageManagerAssigned(title, message || "", fullUrl, m); break;
      default: body = renderGeneric(title, message || "", fullUrl);
    }

    const html = wrap(body, acctName, devName);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "NEXA <noreply@nexacomercial.com.br>", to: email, subject: `NEXA — ${title}`, html }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Email send failed", detail: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ success: true, email_id: result.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
