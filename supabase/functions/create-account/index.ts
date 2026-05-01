import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPERADMIN_EMAIL = "rubiam1@icloud.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { accountName, directorEmail, directorName, telefone, site, developmentName, city, state } = await req.json();
    if (!accountName || !directorEmail || !directorName || !developmentName) {
      return new Response(JSON.stringify({ error: "Campos obrigatorios: accountName, directorEmail, directorName, developmentName" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify superadmin
    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader! } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user || user.email !== SUPERADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Acesso restrito" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // 1. Create account
    const { data: account, error: accErr } = await admin.from("accounts").insert({ name: accountName, slug, telefone: telefone || null, site: site || null }).select("id").single();
    if (accErr) throw new Error(`Erro ao criar conta: ${accErr.message}`);

    // 2. Create account_settings
    await admin.from("account_settings").insert({ account_id: account.id, reservation_duration_hours: 48, require_accepted_proposal_for_reservation_request: true, require_complete_client_data_for_reservation_request: false, queue_enabled: false });

    // 3. Create development
    const { data: dev, error: devErr } = await admin.from("developments").insert({ account_id: account.id, name: developmentName, city: city || null, state: state || null, status: "active" }).select("id").single();
    if (devErr) throw new Error(`Erro ao criar empreendimento: ${devErr.message}`);

    // 4. Create development_settings
    await admin.from("development_settings").insert({ account_id: account.id, development_id: dev.id });

    // 5. Invite director
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(directorEmail, { data: { name: directorName, role: "director", account_id: account.id } });
    if (invErr) throw new Error(`Erro ao convidar diretor: ${invErr.message}`);

    // 6. Create profile + access
    await admin.from("profiles").upsert({ id: invited.user.id, full_name: directorName, email: directorEmail, role: "director", status: "active" });
    await admin.from("user_account_access").upsert({ user_id: invited.user.id, account_id: account.id, role: "director" }, { onConflict: "user_id,account_id" });

    return new Response(JSON.stringify({ success: true, accountId: account.id, developmentId: dev.id, directorId: invited.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
