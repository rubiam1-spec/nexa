import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Facebook webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("FB_VERIFY_TOKEN") || "nexa-webhook-2026";
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Authenticate via x-api-key header or ?key= query param ──
    const apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
    if (!apiKey) {
      return json({ error: "Missing x-api-key header or ?key= parameter" }, 401);
    }

    const { data: webhook, error: whErr } = await supabase
      .from("webhook_endpoints")
      .select("id, account_id, name, source, is_active, default_temperature, default_assigned_to, default_development_id, field_mapping")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (whErr || !webhook) {
      return json({ error: "Invalid API key" }, 401);
    }
    if (!webhook.is_active) {
      return json({ error: "Webhook endpoint is disabled" }, 403);
    }

    const accountId = webhook.account_id as string;
    const fieldMapping = (webhook.field_mapping || {}) as Record<string, string>;

    // ── 2. Parse body ──
    const body = await req.json();

    // Apply field_mapping: rename keys from external names to NEXA names
    const mapped: Record<string, string> = {};
    for (const [extKey, nexaKey] of Object.entries(fieldMapping)) {
      if (body[extKey] !== undefined) mapped[nexaKey] = String(body[extKey]);
    }

    // Extract lead data — check mapped first, then body directly
    let name = mapped.name || body.name || body.nome || body.full_name || "";
    let email = mapped.email || body.email || "";
    let phone = mapped.phone || body.phone || body.telefone || body.whatsapp || body.phone_number || "";
    const sourceDetail = mapped.source_detail || body.source_detail || body.campaign || body.campanha || body.form || "";
    const observations = mapped.observations || body.observations || body.notes || body.observacoes || "";

    // Facebook Lead Ads format
    if (body.entry && body.entry[0]?.changes) {
      const fbData = body.entry[0].changes[0]?.value;
      const fields = fbData?.field_data || [];
      const getField = (names: string[]) => {
        for (const n of names) {
          const f = fields.find((fd: { name: string; values: string[] }) => fd.name === n);
          if (f?.values?.[0]) return f.values[0];
        }
        return "";
      };
      name = name || getField(["full_name", "nome", "name"]);
      email = email || getField(["email"]);
      phone = phone || getField(["phone_number", "telefone", "whatsapp"]);
    }

    // Clean phone
    phone = phone.replace(/\D/g, "");

    // ── 3. Validate ──
    if (!name && !phone && !email) {
      return json({ error: "Dados insuficientes: precisa de nome, telefone ou email" }, 400);
    }

    // ── 4. Deduplicate ──
    let existingClient = null;
    if (phone && phone.length >= 10) {
      const { data } = await supabase.from("clients").select("id, name, status")
        .eq("account_id", accountId).eq("phone", phone).is("deleted_at", null).limit(1).maybeSingle();
      existingClient = data;
    }
    if (!existingClient && email) {
      const { data } = await supabase.from("clients").select("id, name, status")
        .eq("account_id", accountId).eq("email", email).is("deleted_at", null).limit(1).maybeSingle();
      existingClient = data;
    }

    if (existingClient) {
      // Update last_interaction_at + register interaction
      await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", existingClient.id);
      await supabase.from("contact_interactions").insert({
        account_id: accountId, client_id: existingClient.id,
        type: "system", title: `Lead recebido via ${webhook.source} (duplicado)`,
        description: sourceDetail || null,
        metadata: { webhook_id: webhook.id, source: webhook.source },
      });
      // Update webhook stats
      await supabase.from("webhook_endpoints").update({
        total_received: (webhook as Record<string, unknown>).total_received
          ? ((webhook as Record<string, unknown>).total_received as number) + 1 : 1,
        last_received_at: new Date().toISOString(),
      }).eq("id", webhook.id);

      return json({ success: true, contact_id: existingClient.id, is_new: false, message: "Contato já existe, interação registrada" });
    }

    // ── 5. Resolve assignee ──
    // Round-robin com peso quando a conta tem lead_distribution_enabled=true e
    // há participante ativo elegível para o empreendimento do webhook. Caso
    // contrário, mantém o comportamento antigo (default_assigned_to / 'manual').
    let assignedTo: string | null = webhook.default_assigned_to || null;
    let consultantId: string | null = null;
    let assignmentType: string | null = assignedTo ? "manual" : null;

    const { data: settings } = await supabase
      .from("account_settings")
      .select("lead_distribution_enabled")
      .eq("account_id", accountId)
      .maybeSingle();

    if (settings?.lead_distribution_enabled) {
      const { data: picked, error: rrErr } = await supabase.rpc("assign_next_lead_consultant", {
        p_account_id: accountId,
        p_development_id: webhook.default_development_id ?? null,
      });
      if (!rrErr && picked) {
        assignedTo = picked as string;
        consultantId = picked as string;
        assignmentType = "round_robin";
      }
    }

    // ── 6. Create new contact ──
    const { data: newClient, error: insertErr } = await supabase.from("clients").insert({
      account_id: accountId,
      name: name || "Lead sem nome",
      email: email || null,
      phone: phone || null,
      status: "new",
      temperature: webhook.default_temperature || "warm",
      origin: webhook.source,
      origin_detail: sourceDetail || webhook.name,
      observations: observations || null,
      assigned_to: assignedTo,
      consultant_id: consultantId,
      assignment_type: assignmentType,
      assigned_at: assignedTo ? new Date().toISOString() : null,
      development_id: webhook.default_development_id || null,
    }).select("id").single();

    if (insertErr) {
      return json({ error: "Erro ao criar contato", detail: insertErr.message }, 500);
    }

    // Register interaction
    await supabase.from("contact_interactions").insert({
      account_id: accountId, client_id: newClient.id,
      type: "system", title: `Lead recebido via ${webhook.source}`,
      description: sourceDetail || null,
      metadata: { webhook_id: webhook.id, source: webhook.source },
    });

    // Update webhook stats
    await supabase.rpc("increment_webhook_received" as never, { webhook_id_param: webhook.id } as never).catch(() => {
      // Fallback if rpc doesn't exist
      supabase.from("webhook_endpoints").update({
        total_received: ((webhook as Record<string, unknown>).total_received as number || 0) + 1,
        last_received_at: new Date().toISOString(),
      }).eq("id", webhook.id);
    });

    // ── 7. Notificar concierge + gestores (in-app + e-mail best-effort) ──
    // Leads L1: lead novo esfria em minutos. Falha de notificação/e-mail NUNCA
    // quebra a captura — o lead já foi criado acima; este bloco é best-effort.
    try {
      const leadName = name || "Lead sem nome";
      const originLabel = sourceDetail ? `${webhook.source} · ${sourceDetail}` : webhook.source;
      const title = `Novo lead: ${leadName} · ${webhook.source}`;
      const emailBody = [
        `Nome: ${leadName}`,
        phone ? `Telefone: ${phone}` : null,
        `Origem: ${originLabel}`,
      ].filter(Boolean).join("<br>");

      const { data: recipients } = await supabase
        .from("user_account_access")
        .select("user_id")
        .eq("account_id", accountId)
        .in("role", ["concierge", "owner", "director", "manager"]);
      const userIds = [...new Set((recipients ?? []).map((r) => r.user_id).filter(Boolean))] as string[];

      if (userIds.length > 0) {
        // (a) Notificação in-app para todos os perfis notificados.
        await supabase.from("notifications").insert(
          userIds.map((uid) => ({
            account_id: accountId, recipient_id: uid, sender_id: null,
            type: "new_lead", title, message: emailBody.replace(/<br>/g, " · "),
            action_url: "/leads", read: false,
            metadata: { client_id: newClient.id, source: webhook.source },
          })),
        );

        // (b) E-mail best-effort via send-notification-email (Resend
        // noreply@nexacomercial.com.br). O type 'new_lead' cai no template
        // genérico (título + corpo + botão → /leads). Só quem tem e-mail
        // cadastrado recebe (a função resolve 404 e ignora os demais).
        const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        await Promise.allSettled(
          userIds.map((uid) =>
            fetch(emailUrl, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient_id: uid, type: "new_lead", title, message: emailBody, action_url: "/leads",
              }),
            }),
          ),
        );
      }
    } catch (notifyErr) {
      console.warn("[receive-lead] notificação de novo lead falhou (ignorada; lead criado):", notifyErr);
    }

    return json({ success: true, contact_id: newClient.id, is_new: true, assigned_to: assignedTo, assignment_type: assignmentType });
  } catch (err) {
    return json({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
