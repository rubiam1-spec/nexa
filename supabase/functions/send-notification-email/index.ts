import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth, unauthorized, forbidden, requireRole, checkRateLimit, rateLimited } from "../_shared/auth.ts";
import { renderNexaEmail, nexaSubject, type NexaEmailData, type NexaDataItem } from "../_shared/emailTemplate.ts";

// Capítulo E-mail: hub de e-mails transacionais sobre o esqueleto único
// (renderNexaEmail). Cada tipo → badge/título/dados/CTAs próprios. Assunto
// padronizado "NEXA — {evento}: {contexto}".

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPROUT = "#4ADE80", AMBER = "#E8B45A", TERRA = "#C2410C";

// Config por evento: badge + CTA primário.
const EVENT: Record<string, { badge: { label: string; color: string }; cta: string }> = {
  new_lead: { badge: { label: "NOVO LEAD", color: SPROUT }, cta: "Atender agora →" },
  new_proposal: { badge: { label: "NOVA PROPOSTA", color: SPROUT }, cta: "Analisar proposta →" },
  proposal_approved: { badge: { label: "PROPOSTA APROVADA", color: SPROUT }, cta: "Ver no NEXA →" },
  proposal_rejected: { badge: { label: "PROPOSTA RECUSADA", color: TERRA }, cta: "Ver negociação →" },
  counter_proposal: { badge: { label: "CONTRAPROPOSTA", color: AMBER }, cta: "Ver contraproposta →" },
  reservation_requested: { badge: { label: "RESERVA SOLICITADA", color: AMBER }, cta: "Analisar no NEXA →" },
  reservation_approved: { badge: { label: "RESERVA APROVADA", color: AMBER }, cta: "Abrir a reserva →" },
  reservation_rejected: { badge: { label: "RESERVA RECUSADA", color: TERRA }, cta: "Ver no NEXA →" },
  reservation_expiring: { badge: { label: "RESERVA EXPIRANDO", color: TERRA }, cta: "Confirmar agora →" },
  sale_registered: { badge: { label: "VENDA REGISTRADA", color: SPROUT }, cta: "Ver no NEXA →" },
  docs_ready_for_review: { badge: { label: "DOCUMENTOS PRONTOS", color: SPROUT }, cta: "Analisar documentos →" },
  doc_rejected: { badge: { label: "DOCUMENTO RECUSADO", color: TERRA }, cta: "Reenviar documento →" },
  client_ready_for_contract: { badge: { label: "PRONTO PARA CONTRATO", color: SPROUT }, cta: "Ver cliente →" },
  brokerage_manager_assigned: { badge: { label: "GESTOR DEFINIDO", color: SPROUT }, cta: "Acessar o NEXA →" },
  user_invite: { badge: { label: "CONVITE", color: SPROUT }, cta: "Aceitar convite →" },
  weekly_report: { badge: { label: "RELATÓRIO SEMANAL", color: SPROUT }, cta: "Ver relatório →" },
};

const isReservationFamily = (t: string) => t.startsWith("reservation_") || t === "sale_registered";

function s(m: Record<string, unknown>, k: string): string | undefined {
  const v = m[k]; return v == null || v === "" ? undefined : String(v);
}

function buildEmailData(type: string, title: string, message: string, fullUrl: string, m: Record<string, unknown>): NexaEmailData {
  const cfg = EVENT[type] ?? { badge: { label: "NEXA", color: SPROUT }, cta: "Ver no NEXA →" };
  const account = s(m, "account_name");
  const development = s(m, "development_name");
  const footer = { account, development };

  // ── E-mail 1 — Novo lead ──
  if (type === "new_lead") {
    const phone = s(m, "phone");
    const waLink = phone ? `https://wa.me/55${phone.replace(/\D/g, "")}` : undefined;
    const metaParts = [s(m, "origin_label") ?? s(m, "source"), s(m, "campaign_name") ? `Campanha ${s(m, "campaign_name")}` : undefined, development].filter(Boolean);
    const grid: NexaDataItem[] = [];
    if (phone) grid.push({ label: "TELEFONE", value: phone, link: waLink });
    if (s(m, "email")) grid.push({ label: "E-MAIL", value: s(m, "email")! });
    if (s(m, "assignee_name")) grid.push({ label: "RESPONSÁVEL", value: s(m, "assignee_name")! });
    const ctas = [{ label: cfg.cta, url: fullUrl, primary: true }];
    if (waLink) ctas.push({ label: "Chamar no WhatsApp", url: waLink });
    return {
      badge: cfg.badge, timestamp: s(m, "timestamp"),
      title: s(m, "lead_name") ?? title.replace(/^Novo lead:\s*/i, ""),
      meta: metaParts.join(" · ") || undefined,
      dataGrid: grid, ctas,
      ruler: "Lead de anúncio esfria em minutos — a conversão cai pela metade após a primeira hora sem contato.",
      footer,
    };
  }

  // ── E-mail 3 — Família de reserva/venda ──
  if (isReservationFamily(type)) {
    const grid: NexaDataItem[] = [];
    if (s(m, "client_name")) grid.push({ label: "CLIENTE", value: s(m, "client_name")! });
    if (s(m, "broker_name") ?? s(m, "sent_by")) grid.push({ label: "CORRETOR(A)", value: (s(m, "broker_name") ?? s(m, "sent_by"))! });
    if (s(m, "approved_by")) grid.push({ label: "APROVADA POR", value: s(m, "approved_by")! });
    if (s(m, "proposal_summary")) grid.push({ label: "PROPOSTA VINCULADA", value: s(m, "proposal_summary")! });
    const band = s(m, "deadline_value")
      ? { label: s(m, "deadline_label") ?? "UNIDADE TRAVADA · PRAZO DA RESERVA", value: s(m, "deadline_value")!, note: s(m, "deadline_note") ?? "Se expirar sem confirmação, a unidade volta ao mercado e o primeiro da fila é promovido automaticamente." }
      : undefined;
    const metaParts = [development, s(m, "total_value"), s(m, "area")].filter(Boolean);
    return {
      badge: cfg.badge, timestamp: s(m, "timestamp"),
      title: s(m, "unit_label") ?? title,
      meta: metaParts.join(" · ") || message || undefined,
      highlightBand: band,
      dataGrid: grid.length ? grid : undefined,
      nextStep: s(m, "next_step"),
      ctas: [{ label: cfg.cta, url: fullUrl, primary: true }],
      footer,
    };
  }

  // ── Genérico (propostas, docs, convite, weekly, etc.) sobre o esqueleto ──
  const grid: NexaDataItem[] = [];
  if (s(m, "client_name")) grid.push({ label: "CLIENTE", value: s(m, "client_name")! });
  if (s(m, "unit_label")) grid.push({ label: "UNIDADE", value: s(m, "unit_label")! });
  if (s(m, "total_value")) grid.push({ label: "VALOR", value: s(m, "total_value")! });
  if (s(m, "sent_by")) grid.push({ label: "POR", value: s(m, "sent_by")! });
  return {
    badge: cfg.badge, timestamp: s(m, "timestamp"),
    title, meta: message || undefined,
    dataGrid: grid.length ? grid : undefined,
    ctas: [{ label: cfg.cta, url: fullUrl, primary: true }],
    footer,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "___never___");
    if (!isServiceRole) {
      const auth = await validateAuth(req);
      if (!auth) return unauthorized("Autenticação necessária");
      if (!requireRole(auth, ["owner", "director", "manager"])) return forbidden("Sem permissão para enviar emails");
      if (!checkRateLimit(`email:${auth.userId}`, 20, 60000)) return rateLimited();
    }

    const { recipient_id, type, title, message, action_url, metadata, to_email } = await req.json();
    if (!recipient_id && !to_email) return new Response(JSON.stringify({ error: "recipient_id or to_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!title) return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let email = to_email as string | undefined; // to_email: envio direto (teste de renderização)
    if (!email) {
      const { data: { user } } = await supabase.auth.admin.getUserById(recipient_id);
      email = user?.email;
    }
    if (!email) return new Response(JSON.stringify({ error: "Recipient email not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const appUrl = "https://app.nexacomercial.com.br";
    const fullUrl = action_url ? `${appUrl}${action_url}` : appUrl;
    const m = (metadata || {}) as Record<string, unknown>;

    const html = renderNexaEmail(buildEmailData(type, title, message || "", fullUrl, m));

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "NEXA <noreply@nexacomercial.com.br>", to: email, subject: nexaSubject(title), html }),
    });
    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText); // best-effort NUNCA silencioso
      return new Response(JSON.stringify({ error: "Email send failed", detail: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = await resendRes.json();
    return new Response(JSON.stringify({ success: true, email_id: result.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
