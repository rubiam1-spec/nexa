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

    // ── 5. Create new contact ──
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
      assigned_to: webhook.default_assigned_to || null,
      assigned_at: webhook.default_assigned_to ? new Date().toISOString() : null,
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

    return json({ success: true, contact_id: newClient.id, is_new: true, assigned_to: webhook.default_assigned_to || null });
  } catch (err) {
    return json({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
