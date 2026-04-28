import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit, rateLimited } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Token ausente" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessao invalida" }, 401);

    // Rate limit: 10 invites per minute per user
    if (!checkRateLimit(`invite-broker:${user.id}`, 10, 60000)) return rateLimited();

    // Permissão: owner, director ou manager
    const { data: callerAccess } = await userClient.from("user_account_access").select("role").eq("user_id", user.id).limit(1).single();
    if (!callerAccess || !["owner", "director", "manager"].includes(callerAccess.role)) {
      return json({ error: "Sem permissão para convidar corretores" }, 403);
    }

    const { broker_id } = await req.json();
    if (!broker_id) return json({ error: "broker_id obrigatório" }, 400);

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Buscar broker
    const { data: broker, error: brokerErr } = await adminClient.from("brokers").select("*").eq("id", broker_id).single();
    if (brokerErr || !broker) return json({ error: "Corretor não encontrado" }, 404);
    if (broker.has_system_access && broker.profile_id) return json({ error: "Corretor já possui acesso" }, 409);
    if (!broker.email) return json({ error: "Corretor sem email cadastrado" }, 400);

    const email = broker.email;
    const name = broker.name || "Corretor";
    const account_id = broker.account_id;

    // Verificar se email já existe
    const { data: existingProfile } = await adminClient.from("profiles").select("id").eq("email", email).maybeSingle();
    let userId: string;
    let link: string | null = null;

    if (existingProfile) {
      userId = existingProfile.id;
      await adminClient.from("profiles").upsert({ id: userId, name, role: "broker", email, status: "active" }, { onConflict: "id" });
      await adminClient.from("user_account_access").upsert({ user_id: userId, account_id, role: "broker" }, { onConflict: "user_id,account_id" });

      const { data: linkData } = await adminClient.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: "https://app.nexacomercial.com.br/auth/callback" } });
      link = linkData?.properties?.action_link || null;
    } else {
      const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: "https://app.nexacomercial.com.br/auth/definir-senha", data: { name, role: "broker", account_id } });
      if (inviteErr) return json({ error: inviteErr.message }, 400);

      userId = invited.user.id;
      await adminClient.from("profiles").upsert({ id: userId, name, role: "broker", email, status: "active" });
      await adminClient.from("user_account_access").upsert({ user_id: userId, account_id, role: "broker" }, { onConflict: "user_id,account_id" });

      const { data: linkData } = await adminClient.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: "https://app.nexacomercial.com.br/auth/definir-senha" } });
      link = linkData?.properties?.action_link || null;
    }

    // Vincular broker ao profile
    await adminClient.from("brokers").update({ profile_id: userId, has_system_access: true }).eq("id", broker_id);

    // Enviar email via Resend com template NEXA
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY && link) {
      const emailHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#12110F;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
  <tr><td style="padding:48px 48px 0;text-align:center;">
    <img src="https://phpbsiyxwsbzeevqgixk.supabase.co/storage/v1/object/public/logos/favicon-512.png" width="56" height="56" alt="NEXA" style="display:block;margin:0 auto 40px;border:0;border-radius:12px;" />
  </td></tr>
  <tr><td style="padding:0 44px;">
    <p style="font-size:18px;color:#9C9686;margin:0 0 8px;text-align:center;">Olá, ${name}.</p>
    <h1 style="font-size:34px;font-weight:300;color:#FAF9F6;line-height:1.3;text-align:center;margin:0;">Seu acesso está pronto.</h1>
    <div style="width:40px;height:2px;background:#4ADE80;margin:20px auto;"></div>
  </td></tr>
  <tr><td style="padding:0 44px;">
    <p style="font-size:18px;color:#9C9686;line-height:1.8;margin:0 0 10px;text-align:center;">Você foi convidado para acessar a plataforma NEXA como corretor.</p>
    <p style="font-size:18px;color:#E8E5DE;line-height:1.8;margin:0;text-align:center;font-weight:500;">Defina sua senha e comece a operar.</p>
  </td></tr>
  <tr><td style="padding:40px 44px;text-align:center;">
    <table cellpadding="0" cellspacing="0" align="center"><tr><td style="background:#4ADE80;border-radius:14px;">
      <a href="${link}" target="_blank" style="display:inline-block;background:#4ADE80;color:#12110F;text-decoration:none;padding:20px 52px;border-radius:14px;font-size:18px;font-weight:700;">Ativar meu acesso</a>
    </td></tr></table>
    <p style="font-size:16px;color:#5C5647;margin:14px 0 0;line-height:1.6;">Ao clicar, você vai definir sua senha.<br/>Leva menos de um minuto.</p>
  </td></tr>
  <tr><td style="padding:0 44px 44px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1C1B18;border-radius:14px;">
      <tr><td style="padding:24px 28px;">
        <div style="font-size:11px;color:#5C5647;letter-spacing:1.5px;font-family:Courier New,monospace;margin-bottom:16px;">COMO FUNCIONA</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;"><span style="color:#4ADE80;font-size:16px;font-weight:700;">1</span>&nbsp;&nbsp;<span style="font-size:16px;color:#E8E5DE;">Clique no botão verde acima</span></td></tr>
          <tr><td style="padding:8px 0;"><span style="color:#4ADE80;font-size:16px;font-weight:700;">2</span>&nbsp;&nbsp;<span style="font-size:16px;color:#E8E5DE;">Escolha uma senha</span></td></tr>
          <tr><td style="padding:8px 0;"><span style="color:#4ADE80;font-size:16px;font-weight:700;">3</span>&nbsp;&nbsp;<span style="font-size:16px;color:#E8E5DE;">Pronto. Acesse app.nexacomercial.com.br</span></td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#0E0D0B;padding:28px 48px;text-align:center;">
    <p style="margin:0 0 6px;font-size:14px;color:#706B5F;font-style:italic;">Velocidade para vender. Controle para crescer.</p>
    <p style="margin:0;font-size:12px;color:#3D3A30;font-family:Courier New,monospace;letter-spacing:1.5px;">NEXA · nexacomercial.com.br</p>
  </td></tr>
</table>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "NEXA <noreply@nexacomercial.com.br>", to: email, subject: "Seu acesso ao NEXA está pronto", html: emailHtml }),
        });
      } catch (emailErr) {
        console.log("[invite-broker] email falhou mas link gerado:", emailErr);
      }
    }

    return json({ success: true, broker_id, user_id: userId, email, link, message: "Convite enviado" });
  } catch (err: unknown) {
    console.error("[invite-broker] erro:", err);
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});
