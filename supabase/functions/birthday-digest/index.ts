// NEXA birthday-digest Edge Function
// Monthly digest of next month's birthdays sent to concierge + managers
// Triggered by pg_cron on the 28th of each month

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Aniversariante {
  id: string;
  account_id: string;
  tipo: string;
  name: string;
  email: string | null;
  phone: string | null;
  data_nascimento: string | null;
  mes_aniversario: number;
  dia_aniversario: number;
}

interface Recipient {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildEmailHtml(accountName: string, monthName: string, aniversariantes: Aniversariante[]): string {
  const rows = aniversariantes.map((a) => {
    const tipoLabel = a.tipo === "client" ? "Cliente" : a.tipo === "broker" ? "Corretor" : "Equipe";
    const tipoColor = a.tipo === "client" ? "#3B82F6" : a.tipo === "broker" ? "#F59E0B" : "#4ADE80";
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:#333;">
          ${String(a.dia_aniversario).padStart(2, "0")}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;">
          ${a.name}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <span style="background:${tipoColor}22;color:${tipoColor};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">
            ${tipoLabel}
          </span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">
          ${a.phone || "—"}
        </td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg, #FFB74D 0%, #FF9800 100%);padding:28px 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">🎂</div>
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
          Aniversariantes de ${capitalize(monthName)}
        </h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
          ${accountName} — ${aniversariantes.length} aniversariante${aniversariantes.length > 1 ? "s" : ""}
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Dia</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Nome</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Tipo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Telefone</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:24px;text-align:center;border-top:1px solid #f0f0f0;">
        <a href="https://app.nexacomercial.com.br" style="display:inline-block;background:#1C1B18;color:#4ADE80;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Abrir NEXA
        </a>
      </div>
    </div>
    <div style="text-align:center;padding:20px 0;color:#999;font-size:11px;">
      powered by NEXA · Plataforma Comercial
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Next month (1-based)
    const today = new Date();
    const currentMonth0 = today.getMonth(); // 0-based
    const nextMonth0 = (currentMonth0 + 1) % 12;
    const nextMonth1 = nextMonth0 + 1; // 1-based for SQL
    const monthName = MONTH_NAMES[nextMonth0];

    // Fetch all active accounts
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("status", "active");

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No active accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ account: string; sent: number; skipped: string }> = [];

    for (const account of accounts) {
      // Birthdays for next month
      const { data: aniversariantes } = await supabase
        .from("vw_aniversariantes")
        .select("*")
        .eq("account_id", account.id)
        .eq("mes_aniversario", nextMonth1)
        .order("dia_aniversario");

      if (!aniversariantes || aniversariantes.length === 0) {
        results.push({ account: account.name, sent: 0, skipped: "no birthdays" });
        continue;
      }

      // Recipients: concierge + manager + director + owner in this account
      const { data: accessRows } = await supabase
        .from("user_account_access")
        .select("user_id, role")
        .eq("account_id", account.id)
        .in("role", ["concierge", "manager", "director", "owner"]);

      if (!accessRows || accessRows.length === 0) {
        results.push({ account: account.name, sent: 0, skipped: "no recipients" });
        continue;
      }

      const userIds = accessRows.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .in("id", userIds);

      const recipients: Recipient[] = (profiles || []).filter((p) => p.email);
      if (recipients.length === 0) {
        results.push({ account: account.name, sent: 0, skipped: "no emails" });
        continue;
      }

      const emailHtml = buildEmailHtml(account.name, monthName, aniversariantes as Aniversariante[]);
      const subject = `🎂 Aniversariantes de ${capitalize(monthName)} — ${account.name}`;

      let sentCount = 0;
      for (const recipient of recipients) {
        try {
          const resendResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "NEXA <noreply@nexacomercial.com.br>",
              to: [recipient.email],
              subject,
              html: emailHtml,
            }),
          });
          if (resendResp.ok) sentCount++;
        } catch (err) {
          console.error(`Failed to send to ${recipient.email}:`, err);
        }
      }

      results.push({ account: account.name, sent: sentCount, skipped: "" });
    }

    return new Response(JSON.stringify({ success: true, month: monthName, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
