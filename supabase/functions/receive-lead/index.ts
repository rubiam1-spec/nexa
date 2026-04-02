import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();

    // Extract lead data — flexible format
    let leadData: { name: string; email: string; phone: string; origin: string; origin_detail: string; cpf: string } = {
      name: "", email: "", phone: "", origin: "site", origin_detail: "", cpf: "",
    };

    // Facebook Lead Ads format
    if (body.entry && body.entry[0]?.changes) {
      const fbData = body.entry[0].changes[0].value;
      const fields = fbData.field_data || [];
      const getField = (names: string[]) => {
        for (const n of names) {
          const f = fields.find((fd: { name: string; values: string[] }) => fd.name === n);
          if (f?.values?.[0]) return f.values[0];
        }
        return "";
      };
      leadData = {
        name: getField(["full_name", "nome", "name"]),
        email: getField(["email"]),
        phone: getField(["phone_number", "telefone", "whatsapp"]),
        origin: "facebook",
        origin_detail: fbData.form_id ? `Form ${fbData.form_id}` : "Facebook Lead Ad",
        cpf: "",
      };
    } else {
      // Generic format
      leadData = {
        name: body.name || body.nome || "",
        email: body.email || "",
        phone: body.phone || body.telefone || body.whatsapp || "",
        origin: body.origin || body.origem || "site",
        origin_detail: body.campaign || body.campanha || body.form || "",
        cpf: body.cpf || "",
      };
    }

    // Validation
    if (!leadData.name && !leadData.phone && !leadData.email) {
      return new Response(JSON.stringify({ error: "Dados insuficientes: precisa de nome, telefone ou email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accountId = body.account_id || "16d4b82f-880f-4818-bb07-93c3b606f982";

    // Deduplication by email or phone
    let existingClient = null;
    if (leadData.email) {
      const { data } = await supabase.from("clients").select("id, name, status").eq("account_id", accountId).eq("email", leadData.email).limit(1).maybeSingle();
      existingClient = data;
    }
    if (!existingClient && leadData.phone) {
      const cleanPhone = leadData.phone.replace(/\D/g, "");
      if (cleanPhone.length >= 8) {
        const { data } = await supabase.from("clients").select("id, name, status").eq("account_id", accountId).ilike("phone", `%${cleanPhone.slice(-8)}%`).limit(1).maybeSingle();
        existingClient = data;
      }
    }

    if (existingClient) {
      if (["lead", "lost"].includes(existingClient.status || "")) {
        await supabase.from("clients").update({ status: "lead", origin: leadData.origin, origin_detail: leadData.origin_detail }).eq("id", existingClient.id);
      }
      return new Response(JSON.stringify({ success: true, client_id: existingClient.id, duplicate: true, message: "Lead já existe" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Round-robin distribution
    const { data: distributors } = await supabase.from("lead_distribution").select("id, consultant_id, current_count").eq("account_id", accountId).eq("active", true).order("current_count", { ascending: true }).order("last_assigned_at", { ascending: true, nullsFirst: true }).limit(1);

    let assignedTo: string | null = null;
    if (distributors && distributors.length > 0) {
      const chosen = distributors[0];
      assignedTo = chosen.consultant_id as string;
      await supabase.from("lead_distribution").update({ current_count: (chosen.current_count as number) + 1, last_assigned_at: new Date().toISOString() }).eq("id", chosen.id);
    }

    // Create lead
    const { data: newClient, error } = await supabase.from("clients").insert({
      account_id: accountId,
      name: leadData.name || "Lead sem nome",
      email: leadData.email || null,
      phone: leadData.phone || null,
      cpf: leadData.cpf || null,
      status: "lead",
      origin: leadData.origin,
      origin_detail: leadData.origin_detail,
      assigned_to: assignedTo,
      assigned_at: assignedTo ? new Date().toISOString() : null,
    }).select("id").single();

    if (error) {
      return new Response(JSON.stringify({ error: "Erro ao criar lead", detail: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, client_id: newClient.id, assigned_to: assignedTo, duplicate: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
