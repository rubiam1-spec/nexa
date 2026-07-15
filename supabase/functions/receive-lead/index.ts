import { createClient } from "jsr:@supabase/supabase-js@2";
import { normalizeLead, isHoneypot, sourceDetailOf } from "./leadAdapters.ts";

// receive-lead v6 (L2.2) — ingestão multicanal. Ordem: resolve canal → LOG BRUTO
// (webhook_events) → adaptador por provider_adapter → dedupe (telefone/email +
// lead_id) → origem/campanha → distribuição por distribution_mode → cria client →
// fecha o log. NUNCA perde lead: qualquer falha pós-log vira status='failed' + 200
// (payload salvo = reprocessável). 4xx só para chave inválida / payload ilegível.
// Fluxo pós-criação idêntico ao v7 (interaction + increment_webhook_received).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateBucket.get(ip);
  if (!entry || now > entry.resetAt) { rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; }
  entry.count++;
  if (rateBucket.size > 5000) rateBucket.clear();
  return entry.count > RATE_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Facebook webhook verification (GET) — preservado do v7.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("FB_VERIFY_TOKEN") || "nexa-webhook-2026";
    if (mode === "subscribe" && token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) return json({ error: "Too many requests" }, 429);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Corpo lido UMA vez; payload ilegível → 4xx (nunca chega ao log).
    const rawText = await req.text();
    // deno-lint-ignore no-explicit-any
    let body: Record<string, any>;
    try { body = rawText ? JSON.parse(rawText) : {}; } catch { return json({ error: "Payload ilegível (JSON inválido)" }, 400); }

    // ── 1. Resolver canal por api_key: header x-api-key, ?key=, ou body.google_key (Google) ──
    const apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key") || (body?.google_key != null ? String(body.google_key) : null);
    if (!apiKey) return json({ error: "Missing x-api-key header or ?key= parameter" }, 401);

    const { data: channel, error: whErr } = await supabase
      .from("webhook_endpoints")
      .select("id, account_id, name, source, is_active, default_temperature, default_assigned_to, default_development_id, field_mapping, distribution_mode, provider_adapter, fallback_assigned_to, api_key")
      .eq("api_key", apiKey).maybeSingle();
    if (whErr || !channel) return json({ error: "Invalid API key" }, 401);
    if (!channel.is_active) return json({ error: "Webhook endpoint is disabled" }, 403);

    const accountId = channel.account_id as string;

    // ── 2. LOG BRUTO PRIMEIRO (webhook_events) — antes de qualquer processamento ──
    let eventId: string | null = null;
    try {
      const { data: ev } = await supabase.from("webhook_events")
        .insert({ account_id: accountId, endpoint_id: channel.id, raw_payload: body, status: "received" })
        .select("id").single();
      eventId = (ev?.id as string) ?? null;
    } catch (_) { /* best-effort: segue mesmo sem eventId (nunca perder lead) */ }

    const closeEvent = async (status: string, patch: Record<string, unknown> = {}) => {
      if (eventId) await supabase.from("webhook_events").update({ status, ...patch }).eq("id", eventId);
    };

    try {
      // Honeypot anti-bot: sucesso falso, não grava client.
      if (isHoneypot(body)) { await closeEvent("processed", { error: "honeypot" }); return json({ success: true }); }

      const provider = (channel.provider_adapter as string) || "generic";
      const fieldMapping = (channel.field_mapping || {}) as Record<string, string>;
      const lead = normalizeLead(provider, body, fieldMapping);

      // ── 3. Validações específicas do Google ──
      if (provider === "google_lead_form") {
        if (lead.googleKey && lead.googleKey !== channel.api_key) {
          await closeEvent("failed", { error: "google_key não confere com a api_key do canal" });
          return json({ success: true, ignored: "google_key mismatch" });
        }
        if (lead.isTest) { // botão "enviar dados de teste" do Google: registra, NÃO cria client.
          await closeEvent("processed", { error: "google_test" });
          return json({ success: true, is_test: true });
        }
      }

      if (!lead.name && !lead.phone && !lead.email) {
        await closeEvent("failed", { error: "Dados insuficientes: nome, telefone ou email" });
        return json({ success: true, ignored: "insufficient_data" });
      }

      const sourceDetail = sourceDetailOf(body) || (channel.name as string);

      // ── 4. Idempotência: lead_id do provedor (Google reenvia o mesmo) ──
      if (lead.leadId) {
        const { data: dup } = await supabase.from("webhook_events").select("id")
          .eq("endpoint_id", channel.id).eq("status", "processed")
          .eq("raw_payload->>lead_id", lead.leadId)
          .neq("id", eventId ?? "00000000-0000-0000-0000-000000000000").limit(1).maybeSingle();
        if (dup) { await closeEvent("duplicate", { error: "lead_id já processado neste canal" }); return json({ success: true, is_new: false, dedupe: "lead_id" }); }
      }

      // Dedupe por telefone/email (v7).
      let existing: { id: string } | null = null;
      if (lead.phone && lead.phone.length >= 10) {
        const { data } = await supabase.from("clients").select("id").eq("account_id", accountId).eq("phone", lead.phone).is("deleted_at", null).limit(1).maybeSingle();
        existing = data as { id: string } | null;
      }
      if (!existing && lead.email) {
        const { data } = await supabase.from("clients").select("id").eq("account_id", accountId).eq("email", lead.email).is("deleted_at", null).limit(1).maybeSingle();
        existing = data as { id: string } | null;
      }
      if (existing) {
        await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", existing.id);
        await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: existing.id, type: "system", title: `Lead recebido via ${channel.source} (duplicado)`, description: sourceDetail || null, metadata: { webhook_id: channel.id, source: channel.source } });
        await supabase.rpc("increment_webhook_received", { webhook_id_param: channel.id });
        await closeEvent("duplicate", { client_id: existing.id });
        return json({ success: true, contact_id: existing.id, is_new: false });
      }

      // ── 5. Origem (slug do canal) + campanha (match exato case-insensitive de utm_campaign_match) ──
      const origin = channel.source as string;
      let campaignId: string | null = null;
      if (lead.utm.campaign) {
        const { data: camp } = await supabase.from("lead_campaigns").select("id")
          .eq("account_id", accountId).eq("active", true).ilike("utm_campaign_match", lead.utm.campaign).limit(1).maybeSingle();
        campaignId = (camp?.id as string) ?? null;
      }

      // ── 6. Distribuição por distribution_mode do canal ──
      const mode = (channel.distribution_mode as string) || "fixed";
      let assignedTo: string | null = null, consultantId: string | null = null, assignmentType: string | null = null, fallbackNote: string | null = null;
      if (mode === "fixed") {
        assignedTo = (channel.default_assigned_to as string) || null;
        assignmentType = assignedTo ? "auto_fixed" : null;
      } else if (mode === "round_robin") {
        const { data: settings } = await supabase.from("account_settings").select("lead_distribution_enabled").eq("account_id", accountId).maybeSingle();
        let picked: string | null = null;
        if (settings?.lead_distribution_enabled) {
          const { data: p, error: rrErr } = await supabase.rpc("assign_next_lead_consultant", { p_account_id: accountId, p_development_id: channel.default_development_id ?? null });
          if (!rrErr && p) picked = p as string;
        }
        if (picked) { assignedTo = picked; consultantId = picked; assignmentType = "auto_round_robin"; }
        else { assignedTo = (channel.fallback_assigned_to as string) || null; assignmentType = assignedTo ? "auto_fallback" : null; fallbackNote = "fallback aplicado (roleta vazia/pausada/desligada)"; }
      } // 'unassigned' → sem responsável.

      // ── 6b. Criar contato ──
      const { data: newClient, error: insertErr } = await supabase.from("clients").insert({
        account_id: accountId, name: lead.name || "Lead sem nome", email: lead.email || null, phone: lead.phone || null,
        status: "new", temperature: (channel.default_temperature as string) || "warm",
        origin, origin_detail: sourceDetail, campaign_id: campaignId,
        utm_source: lead.utm.source, utm_medium: lead.utm.medium, utm_campaign: lead.utm.campaign, utm_content: lead.utm.content, utm_term: lead.utm.term,
        observations: lead.message || null,
        assigned_to: assignedTo, consultant_id: consultantId, assignment_type: assignmentType,
        assigned_at: assignedTo ? new Date().toISOString() : null,
        development_id: channel.default_development_id || null,
      }).select("id").single();
      if (insertErr) { await closeEvent("failed", { error: `insert client: ${insertErr.message}` }); return json({ success: true, saved: true, note: "erro ao criar contato; payload salvo p/ reprocesso" }); }

      // Pós-criação idêntico ao v7.
      await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: newClient.id, type: "system", title: `Lead recebido via ${channel.source}`, description: sourceDetail || null, metadata: { webhook_id: channel.id, source: channel.source, assignment_type: assignmentType } });
      await supabase.rpc("increment_webhook_received", { webhook_id_param: channel.id });

      // ── 7. Fechar o log ──
      await closeEvent("processed", { client_id: newClient.id, error: fallbackNote });

      // ── 8. Notificar concierge + gestores (in-app + e-mail) — regra L1 reincorporada.
      // Lead novo esfria em minutos. BEST-EFFORT: Promise.allSettled; falha de
      // notificação/e-mail NUNCA quebra a captura (o client já foi criado acima).
      try {
        const leadName = lead.name || "Lead sem nome";
        const originLabel = sourceDetail ? `${channel.source} · ${sourceDetail}` : (channel.source as string);
        const title = `Novo lead: ${leadName} · ${channel.source}`;
        const emailBody = [`Nome: ${leadName}`, lead.phone ? `Telefone: ${lead.phone}` : null, `Origem: ${originLabel}`].filter(Boolean).join("<br>");
        const { data: recipients } = await supabase.from("user_account_access").select("user_id").eq("account_id", accountId).in("role", ["concierge", "owner", "director", "manager"]);
        const userIds = [...new Set((recipients ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          // NB: notifications NÃO tem coluna metadata — incluí-la fazia o insert
          // falhar silenciosamente (causa-raiz da regressão de L1: 0 new_lead em prod).
          await supabase.from("notifications").insert(userIds.map((uid) => ({
            account_id: accountId, recipient_id: uid, sender_id: null,
            type: "new_lead", title, message: emailBody.replace(/<br>/g, " · "),
            action_url: "/leads", read: false,
          })));

          // Enriquecimento do E-mail 1 (best-effort: nomes ausentes não bloqueiam).
          const nameOf = async (table: string, id: string | null) => {
            if (!id) return undefined;
            const { data } = await supabase.from(table).select("name").eq("id", id).maybeSingle();
            return (data?.name as string) || undefined;
          };
          const [accountName, developmentName, assigneeName, campaignName] = await Promise.all([
            nameOf("accounts", accountId),
            nameOf("developments", (channel.default_development_id as string) || null),
            assignedTo ? (async () => {
              const { data } = await supabase.from("profiles").select("full_name").eq("id", assignedTo).maybeSingle();
              return (data?.full_name as string) || undefined;
            })() : Promise.resolve(undefined),
            campaignId ? (async () => {
              const { data } = await supabase.from("lead_campaigns").select("name").eq("id", campaignId).maybeSingle();
              return (data?.name as string) || undefined;
            })() : Promise.resolve(undefined),
          ]);
          const metadata = {
            lead_name: leadName, phone: lead.phone || undefined, email: lead.email || undefined,
            origin_label: originLabel, source: channel.source, campaign_name: campaignName,
            account_name: accountName, development_name: developmentName, assignee_name: assigneeName,
          };

          const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          await Promise.allSettled(userIds.map((uid) =>
            fetch(emailUrl, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ recipient_id: uid, type: "new_lead", title, message: emailBody, action_url: "/leads", metadata }) })));
        }
      } catch (notifyErr) {
        console.warn("[receive-lead] notificação de novo lead falhou (ignorada; lead criado):", notifyErr);
      }

      return json({ success: true, contact_id: newClient.id, is_new: true, assigned_to: assignedTo, assignment_type: assignmentType, campaign_id: campaignId });
    } catch (procErr) {
      // Falha pós-log: NUNCA perder o lead → payload já salvo, marca failed, 200.
      await closeEvent("failed", { error: procErr instanceof Error ? procErr.message : String(procErr) });
      return json({ success: true, saved: true, note: "erro no processamento; payload salvo p/ reprocesso" });
    }
  } catch (err) {
    return json({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
