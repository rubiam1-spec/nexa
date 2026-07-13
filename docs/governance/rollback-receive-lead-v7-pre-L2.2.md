# Rollback — receive-lead v7 (pré-L2.2)

## Rollback do RPC assign_next_lead_consultant (ORIGINAL pré-patch `paused`)
Reverter = recriar exatamente esta função (sem `AND paused = false`):
```sql
CREATE OR REPLACE FUNCTION public.assign_next_lead_consultant(p_account_id uuid, p_development_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
  SELECT consultant_id INTO v_id
  FROM lead_distribution
  WHERE account_id = p_account_id
    AND active = true
    AND (development_id = p_development_id OR development_id IS NULL)
  ORDER BY (current_count::numeric / GREATEST(weight, 1)) ASC,
           last_assigned_at ASC NULLS FIRST,
           created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  UPDATE lead_distribution
    SET current_count = current_count + 1, last_assigned_at = now()
  WHERE account_id = p_account_id AND consultant_id = v_id
    AND (development_id = p_development_id OR development_id IS NULL);
  RETURN v_id;
END $function$;
```

---


Versão **ACTIVE em produção antes da L2.2** (Supabase Edge, version 7).
Rollback = redeployar este `index.ts` (via `deploy_edge_function` slug `receive-lead`).
Base fiel do fluxo atual (sem bloco de notificação — o WIP local com notif NÃO estava deployado).

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("FB_VERIFY_TOKEN") || "nexa-webhook-2026";
    if (mode === "subscribe" && token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) return json({ error: "Too many requests" }, 429);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
    if (!apiKey) return json({ error: "Missing x-api-key header or ?key= parameter" }, 401);
    const { data: webhook, error: whErr } = await supabase.from("webhook_endpoints")
      .select("id, account_id, name, source, is_active, default_temperature, default_assigned_to, default_development_id, field_mapping")
      .eq("api_key", apiKey).maybeSingle();
    if (whErr || !webhook) return json({ error: "Invalid API key" }, 401);
    if (!webhook.is_active) return json({ error: "Webhook endpoint is disabled" }, 403);
    const accountId = webhook.account_id as string;
    const fieldMapping = (webhook.field_mapping || {}) as Record<string, string>;
    const body = await req.json();
    const honeypot = body.website || body.Website || body.url || body.honeypot || "";
    if (typeof honeypot === "string" && honeypot.trim().length > 0) return json({ success: true });
    const mapped: Record<string, string> = {};
    for (const [extKey, nexaKey] of Object.entries(fieldMapping)) if (body[extKey] !== undefined) mapped[nexaKey] = String(body[extKey]);
    let name = mapped.name || body.name || body.nome || body.full_name || "";
    let email = mapped.email || body.email || "";
    let phone = mapped.phone || body.phone || body.telefone || body.whatsapp || body.phone_number || "";
    const sourceDetail = mapped.source_detail || body.source_detail || body.campaign || body.campanha || body.form || "";
    const observations = mapped.observations || body.observations || body.notes || body.observacoes || "";
    if (body.entry && body.entry[0]?.changes) {
      const fields = body.entry[0].changes[0]?.value?.field_data || [];
      const getField = (names: string[]) => { for (const n of names) { const f = fields.find((fd: { name: string; values: string[] }) => fd.name === n); if (f?.values?.[0]) return f.values[0]; } return ""; };
      name = name || getField(["full_name", "nome", "name"]);
      email = email || getField(["email"]);
      phone = phone || getField(["phone_number", "telefone", "whatsapp"]);
    }
    phone = phone.replace(/\D/g, "");
    name = name.slice(0, 200); email = email.slice(0, 200);
    if (!name && !phone && !email) return json({ error: "Dados insuficientes: precisa de nome, telefone ou email" }, 400);
    let existingClient = null;
    if (phone && phone.length >= 10) { const { data } = await supabase.from("clients").select("id, name, status").eq("account_id", accountId).eq("phone", phone).is("deleted_at", null).limit(1).maybeSingle(); existingClient = data; }
    if (!existingClient && email) { const { data } = await supabase.from("clients").select("id, name, status").eq("account_id", accountId).eq("email", email).is("deleted_at", null).limit(1).maybeSingle(); existingClient = data; }
    if (existingClient) {
      await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", existingClient.id);
      await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: existingClient.id, type: "system", title: `Lead recebido via ${webhook.source} (duplicado)`, description: sourceDetail || null, metadata: { webhook_id: webhook.id, source: webhook.source } });
      await supabase.rpc("increment_webhook_received", { webhook_id_param: webhook.id });
      return json({ success: true, contact_id: existingClient.id, is_new: false, message: "Contato já existe, interação registrada" });
    }
    let assignedTo: string | null = webhook.default_assigned_to || null;
    let consultantId: string | null = null;
    let assignmentType: string | null = assignedTo ? "manual" : null;
    const { data: settings } = await supabase.from("account_settings").select("lead_distribution_enabled").eq("account_id", accountId).maybeSingle();
    if (settings?.lead_distribution_enabled) {
      const { data: picked, error: rrErr } = await supabase.rpc("assign_next_lead_consultant", { p_account_id: accountId, p_development_id: webhook.default_development_id ?? null });
      if (!rrErr && picked) { assignedTo = picked as string; consultantId = picked as string; assignmentType = "round_robin"; }
    }
    const { data: newClient, error: insertErr } = await supabase.from("clients").insert({
      account_id: accountId, name: name || "Lead sem nome", email: email || null, phone: phone || null,
      status: "new", temperature: webhook.default_temperature || "warm", origin: webhook.source, origin_detail: sourceDetail || webhook.name,
      observations: observations || null, assigned_to: assignedTo, consultant_id: consultantId, assignment_type: assignmentType,
      assigned_at: assignedTo ? new Date().toISOString() : null, development_id: webhook.default_development_id || null,
    }).select("id").single();
    if (insertErr) return json({ error: "Erro ao criar contato", detail: insertErr.message }, 500);
    await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: newClient.id, type: "system", title: `Lead recebido via ${webhook.source}`, description: sourceDetail || null, metadata: { webhook_id: webhook.id, source: webhook.source } });
    await supabase.rpc("increment_webhook_received", { webhook_id_param: webhook.id });
    return json({ success: true, contact_id: newClient.id, is_new: true, assigned_to: assignedTo, assignment_type: assignmentType });
  } catch (err) {
    return json({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
```
