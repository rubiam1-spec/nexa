import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit, rateLimited } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES_ALLOWED_TO_INVITE = ["owner", "director", "manager"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, name, role, account_id } = await req.json();
    if (!email || !name || !role || !account_id) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, name, role, account_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token de autenticação ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado", detail: userError?.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit: 10 invites per minute per user
    if (!checkRateLimit(`invite-user:${user.id}`, 10, 60000)) return rateLimited();

    // Verificar permissão (owner, director ou manager podem convidar)
    const { data: access } = await userClient.from("user_account_access").select("role").eq("user_id", user.id).eq("account_id", account_id).single();
    if (!access || !ROLES_ALLOWED_TO_INVITE.includes(access.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para convidar usuários", userRole: access?.role }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verificar se o usuário já existe consultando a tabela profiles
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, email, role, status")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      // Usuário já existe — reativar com novo role
      const existingUserId = existingProfile.id;

      // Atualizar metadata no auth.users
      await adminClient.auth.admin.updateUserById(existingUserId, {
        user_metadata: { name, role, account_id },
        email_confirm: true,
      });

      // Atualizar profile com novo role e status ativo
      await adminClient.from("profiles").update({
        full_name: name,
        role,
        status: "active",
      }).eq("id", existingUserId);

      // Vincular à conta (upsert para criar ou atualizar o acesso)
      await adminClient.from("user_account_access").upsert(
        { user_id: existingUserId, account_id, role },
        { onConflict: "user_id,account_id" },
      );

      // Gerar magic link para o usuário existente (invite falha para users já registrados)
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: "https://app.nexacomercial.com.br/auth/callback",
        },
      });

      if (linkError) {
        return new Response(JSON.stringify({ error: "Erro ao gerar link: " + linkError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // generateLink NÃO envia email — enviar manualmente via Resend
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY && linkData?.properties?.action_link) {
        const actionLink = linkData.properties.action_link;
        const emailHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#12110F;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
      <tr><td style="padding:48px 48px 0;text-align:center;">
        <img src="https://phpbsiyxwsbzeevqgixk.supabase.co/storage/v1/object/public/logos/favicon-512.png" width="56" height="56" alt="NEXA" style="display:block;margin:0 auto 40px;border:0;border-radius:12px;" />
      </td></tr>
      <tr><td style="padding:0 44px;">
        <p style="font-size:18px;color:#9C9686;margin:0 0 8px;text-align:center;">Olá, ${name}.</p>
        <h1 style="font-size:34px;font-weight:300;color:#FAF9F6;line-height:1.3;text-align:center;margin:0;">Seu espaço está pronto.</h1>
        <div style="width:40px;height:2px;background:#4ADE80;margin:20px auto;"></div>
      </td></tr>
      <tr><td style="padding:0 44px;">
        <p style="font-size:18px;color:#9C9686;line-height:1.8;margin:0 0 10px;text-align:center;">Sua equipe já está usando a NEXA para gerenciar a operação comercial.</p>
        <p style="font-size:18px;color:#E8E5DE;line-height:1.8;margin:0;text-align:center;font-weight:500;">Falta apenas você.</p>
      </td></tr>
      <tr><td style="padding:40px 44px;text-align:center;">
        <table cellpadding="0" cellspacing="0" align="center"><tr><td style="background:#4ADE80;border-radius:14px;">
          <a href="${actionLink}" target="_blank" style="display:inline-block;background:#4ADE80;color:#12110F;text-decoration:none;padding:20px 52px;border-radius:14px;font-size:18px;font-weight:700;">Ativar meu acesso</a>
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

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "NEXA <noreply@nexacomercial.com.br>",
            to: email,
            subject: "Você foi convidado para a NEXA",
            html: emailHtml,
          }),
        });

        if (!resendRes.ok) {
          const resendErr = await resendRes.text();
          return new Response(JSON.stringify({ error: "Erro ao enviar email via Resend: " + resendErr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        userId: existingUserId,
        reactivated: true,
        message: "Usuário existente reativado com papel: " + role,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Usuário novo — convidar normalmente
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { name, role, account_id },
      redirectTo: "https://app.nexacomercial.com.br/auth/definir-senha",
    });
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Criar profile
    await adminClient.from("profiles").upsert({ id: invited.user.id, full_name: name, email, role, status: "active" });

    // Vincular à conta
    await adminClient.from("user_account_access").upsert(
      { user_id: invited.user.id, account_id, role },
      { onConflict: "user_id,account_id" },
    );

    return new Response(JSON.stringify({ success: true, userId: invited.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
