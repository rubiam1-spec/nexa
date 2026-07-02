import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { account_id } = await req.json().catch(() => ({} as Record<string, unknown>));

    let accountIds: string[];
    if (account_id) {
      accountIds = [account_id as string];
    } else {
      const { data: accounts } = await supabase.from("accounts").select("id").eq("active", true);
      accountIds = (accounts || []).map((a: Record<string, unknown>) => a.id as string);
    }

    const results: { account_id: string; briefing_generated: boolean; email_sent: boolean }[] = [];

    for (const accId of accountIds) {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 3600000);
      const todayStr = now.toISOString().slice(0, 10);

      // Check if briefing already exists for today
      const { data: existing } = await supabase
        .from("daily_briefings")
        .select("id")
        .eq("account_id", accId)
        .eq("briefing_date", todayStr)
        .limit(1)
        .maybeSingle();

      if (existing) {
        results.push({ account_id: accId, briefing_generated: false, email_sent: false });
        continue;
      }

      // Account name
      const { data: account } = await supabase.from("accounts").select("name").eq("id", accId).single();
      const accountName = (account?.name as string) || "Conta";

      // === COLLECT 24H METRICS ===
      const countQuery = async (table: string, filters: Record<string, unknown>) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true }).eq("account_id", accId);
        for (const [k, v] of Object.entries(filters)) {
          if (k === "gte") q = q.gte("created_at", v);
          else if (k === "status_in") q = q.in("status", v as string[]);
          else if (k === "status") q = q.eq("status", v);
          else q = q.eq(k, v);
        }
        const { count } = await q;
        return count || 0;
      };

      const metrics = {
        new_negotiations: await countQuery("negotiations", { gte: yesterday.toISOString() }),
        active_negotiations: await countQuery("negotiations", { status_in: ["OPEN", "IN_PROGRESS", "PROPOSAL", "RESERVATION"] }),
        new_proposals: await countQuery("proposals", { gte: yesterday.toISOString() }),
        active_reservations: await countQuery("reservations", { status_in: ["ATIVA", "ativa", "active"] }),
        new_clients: await countQuery("clients", { gte: yesterday.toISOString() }),
      };

      // Sales this month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: monthlySales } = await supabase
        .from("sales").select("*", { count: "exact", head: true })
        .eq("account_id", accId)
        .gte("created_at", monthStart);

      // Available units
      const { count: availableUnits } = await supabase
        .from("units").select("*", { count: "exact", head: true })
        .eq("account_id", accId)
        .in("status", ["available", "AVAILABLE", "DISPONIVEL", "disponivel"]);

      // Pending activities
      const { count: pendingActivities } = await supabase
        .from("activities").select("*", { count: "exact", head: true })
        .eq("account_id", accId)
        .in("status", ["pending", "scheduled"]);

      // Active alerts
      const { data: activeAlerts } = await supabase
        .from("intelligence_alerts")
        .select("priority, title")
        .eq("account_id", accId)
        .eq("resolved", false)
        .gt("expires_at", now.toISOString())
        .order("priority")
        .limit(10);

      const fullMetrics = {
        ...metrics,
        monthly_sales: monthlySales || 0,
        available_units: availableUnits || 0,
        pending_activities: pendingActivities || 0,
        alerts_count: (activeAlerts || []).length,
      };

      // === GENERATE BRIEFING VIA CLAUDE HAIKU ===
      const metricsText = `Empresa: ${accountName}
Data: ${now.toLocaleDateString("pt-BR")}

ÚLTIMAS 24H:
- Negociações novas: ${metrics.new_negotiations}
- Negociações ativas total: ${metrics.active_negotiations}
- Propostas enviadas: ${metrics.new_proposals}
- Reservas ativas: ${metrics.active_reservations}
- Clientes novos: ${metrics.new_clients}
- Vendas no mês: ${monthlySales || 0}
- Atividades pendentes: ${pendingActivities || 0}
- Unidades disponíveis: ${availableUnits || 0}

ALERTAS ATIVOS (${(activeAlerts || []).length}):
${(activeAlerts || []).map((a: Record<string, unknown>) => `- [${a.priority}] ${a.title}`).join("\n") || "Nenhum alerta."}`;

      let briefingText = "";
      let modelUsed = "fallback";
      let tokensUsed = 0;

      if (anthropicKey) {
        try {
          const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 600,
              system: `Você é o assistente de inteligência do NEXA, CRM imobiliário brasileiro.
Gere um briefing diário CURTO (máximo 8 linhas) para o diretor comercial.
Tom: profissional, direto, sem enrolação. Português brasileiro.
Estrutura:
1. Resumo do dia (2 linhas — destaques e números-chave)
2. Atenção (2-3 linhas — o que precisa de ação imediata)
3. Recomendação (1-2 linhas — 1 ação concreta para hoje)
NÃO use bullet points com asteriscos. Use frases corridas.
NÃO repita os números que já estão nos dados — interprete e destaque o que importa.`,
              messages: [{
                role: "user",
                content: `Gere o briefing diário:\n\n${metricsText}`,
              }],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            // deno-lint-ignore no-explicit-any
            briefingText = aiData.content?.find((b: any) => b.type === "text")?.text || "";
            modelUsed = "claude-haiku-4-5-20251001";
            tokensUsed = (aiData.usage?.input_tokens || 0) + (aiData.usage?.output_tokens || 0);
          }
        } catch (aiErr) {
          console.error("AI briefing error:", aiErr);
        }
      }

      if (!briefingText) {
        briefingText = `Resumo ${now.toLocaleDateString("pt-BR")}: ${metrics.active_negotiations} negociações ativas, ${pendingActivities || 0} atividades pendentes, ${(activeAlerts || []).length} alertas.`;
      }

      // === SAVE BRIEFING ===
      await supabase.from("daily_briefings").insert({
        account_id: accId,
        briefing_date: todayStr,
        summary: briefingText,
        metrics: fullMetrics,
        highlights: (activeAlerts || []).slice(0, 5),
        content: { text: briefingText, metrics: fullMetrics },
        model_used: modelUsed,
        tokens_used: tokensUsed,
      });

      // === SEND EMAIL VIA RESEND ===
      let emailSent = false;

      if (resendKey) {
        // Find recipients (directors/managers)
        const { data: recipients } = await supabase
          .from("user_account_access")
          .select("user_id")
          .eq("account_id", accId)
          .in("role", ["owner", "director", "manager"]);

        const emails: string[] = [];
        for (const r of recipients || []) {
          const { data: authUser } = await supabase.auth.admin.getUserById(r.user_id as string);
          if (authUser?.user?.email) emails.push(authUser.user.email);
        }

        if (emails.length > 0) {
          try {
            const dateFormatted = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
            const alertCount = (activeAlerts || []).length;
            const criticalAlerts = (activeAlerts || []).filter((a: Record<string, unknown>) => a.priority === "critical");

            const alertsHtml = alertCount > 0
              ? `<div style="margin-top:20px;">
                  <p style="color:#8A8985;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 10px;">ALERTAS ATIVOS</p>
                  ${(activeAlerts || []).slice(0, 5).map((a: Record<string, unknown>) => {
                    const color = a.priority === "critical" ? "#F87171" : a.priority === "warning" ? "#D97706" : "#60A5FA";
                    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#12110F;border-left:3px solid ${color};border-radius:4px;margin-bottom:6px;">
                      <span style="color:${color};font-size:12px;font-weight:600;">${(a.priority as string).toUpperCase()}</span>
                      <span style="color:#C4BFB3;font-size:13px;">${a.title}</span>
                    </div>`;
                  }).join("")}
                </div>`
              : "";

            const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#12110F;font-family:Arial,sans-serif;">
              <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
                <div style="text-align:center;margin-bottom:28px;">
                  <div style="display:inline-block;background:#1C1B18;border:1px solid #2A2926;border-radius:12px;padding:10px 20px;">
                    <span style="color:#4ADE80;font-size:20px;font-weight:700;letter-spacing:0.05em;">NEXA</span>
                  </div>
                  <p style="color:#8A8985;font-size:11px;margin:8px 0 0;letter-spacing:0.1em;">${accountName}</p>
                </div>
                <div style="background:#1C1B18;border:1px solid #2A2926;border-radius:12px;overflow:hidden;">
                  <div style="height:4px;background:${criticalAlerts.length > 0 ? "#F87171" : "#4ADE80"};"></div>
                  <div style="padding:28px;">
                    <p style="color:#8A8985;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">BRIEFING DIÁRIO · ${dateFormatted}</p>
                    <p style="color:#E8E6E1;font-size:14px;line-height:1.7;margin:0 0 24px;white-space:pre-line;">${briefingText}</p>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
                      <div style="background:#12110F;border-radius:8px;padding:12px 16px;flex:1;min-width:100px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#E8E6E1;font-family:monospace;">${metrics.active_negotiations}</div>
                        <div style="font-size:9px;color:#8A8985;text-transform:uppercase;letter-spacing:0.1em;">Negociações</div>
                      </div>
                      <div style="background:#12110F;border-radius:8px;padding:12px 16px;flex:1;min-width:100px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#E8E6E1;font-family:monospace;">${pendingActivities || 0}</div>
                        <div style="font-size:9px;color:#8A8985;text-transform:uppercase;letter-spacing:0.1em;">Pendentes</div>
                      </div>
                      <div style="background:#12110F;border-radius:8px;padding:12px 16px;flex:1;min-width:100px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:${alertCount > 0 ? "#D97706" : "#4ADE80"};font-family:monospace;">${alertCount}</div>
                        <div style="font-size:9px;color:#8A8985;text-transform:uppercase;letter-spacing:0.1em;">Alertas</div>
                      </div>
                    </div>
                    ${alertsHtml}
                    <a href="https://app.nexacomercial.com.br" style="display:block;text-align:center;padding:14px;background:#4ADE80;color:#12110F;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;margin-top:24px;">Abrir NEXA</a>
                  </div>
                </div>
                <div style="text-align:center;margin-top:24px;">
                  <p style="color:#5A5955;font-size:11px;margin:0;">Gerado pelo Motor de Inteligência NEXA</p>
                  <p style="color:#5A5955;font-size:11px;margin:4px 0 0;">app.nexacomercial.com.br</p>
                </div>
              </div>
            </body></html>`;

            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
              body: JSON.stringify({
                from: "NEXA <noreply@nexacomercial.com.br>",
                to: emails,
                subject: `Briefing diário — ${accountName} — ${dateFormatted}`,
                html: emailHtml,
              }),
            });

            emailSent = emailRes.ok;

            if (emailSent) {
              await supabase.from("daily_briefings")
                .update({ email_sent: true, sent_to: emails })
                .eq("account_id", accId)
                .eq("briefing_date", todayStr);
            }
          } catch (emailErr) {
            console.error("Email error:", emailErr);
          }
        }
      }

      results.push({ account_id: accId, briefing_generated: true, email_sent: emailSent });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily briefing error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
