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

    const supabase = createClient(supabaseUrl, serviceKey);

    const { account_id } = await req.json().catch(() => ({} as Record<string, unknown>));

    // Resolve which accounts to process
    let accountIds: string[];
    if (account_id) {
      accountIds = [account_id as string];
    } else {
      const { data: accounts } = await supabase.from("accounts").select("id").eq("active", true);
      accountIds = (accounts || []).map((a: Record<string, unknown>) => a.id as string);
    }

    const results: { account_id: string; alerts_generated: number }[] = [];

    for (const accId of accountIds) {
      // 1. Fetch cadence settings
      const { data: cadence } = await supabase
        .from("cadence_settings")
        .select("*")
        .eq("account_id", accId)
        .limit(1)
        .maybeSingle();

      // Defaults if no cadence configured
      const cfg = {
        negotiation_idle_hours: cadence?.negotiation_idle_hours ?? 48,
        proposal_response_hours: cadence?.proposal_response_hours ?? 24,
        client_cooling_hours: cadence?.client_cooling_hours ?? 168,
        broker_inactivity_hours: cadence?.broker_inactivity_hours ?? 72,
      };

      const now = new Date();

      // 2. Purge expired alerts
      await supabase
        .from("intelligence_alerts")
        .delete()
        .eq("account_id", accId)
        .lt("expires_at", now.toISOString())
        .eq("resolved", false);

      // 3. Fetch operational data

      // Idle negotiations
      const idleCutoff = new Date(now.getTime() - cfg.negotiation_idle_hours * 3600000).toISOString();
      const { data: idleNegs } = await supabase
        .from("negotiations")
        .select("id, status, updated_at, client_id, broker_id, clients(name), brokers(name)")
        .eq("account_id", accId)
        .in("status", ["OPEN", "IN_PROGRESS", "PROPOSAL", "RESERVATION"])
        .lt("updated_at", idleCutoff)
        .limit(20);

      // Pending proposals
      const propCutoff = new Date(now.getTime() - cfg.proposal_response_hours * 3600000).toISOString();
      const { data: pendingProps } = await supabase
        .from("proposals")
        .select("id, status, created_at, negotiation_id")
        .eq("account_id", accId)
        .in("status", ["SENT", "UNDER_ANALYSIS", "sent", "under_analysis"])
        .lt("created_at", propCutoff)
        .limit(20);

      // Expiring reservations (within 24h)
      const { data: expiringRes } = await supabase
        .from("reservations")
        .select("id, expires_at, unit_id, negotiation_id")
        .eq("account_id", accId)
        .in("status", ["ATIVA", "ativa", "active"])
        .lt("expires_at", new Date(now.getTime() + 24 * 3600000).toISOString())
        .gt("expires_at", now.toISOString())
        .limit(20);

      // Overdue follow-ups
      const { data: overdueFU } = await supabase
        .from("activities")
        .select("id, type, activity_date, client_id, profile_id, clients(name)")
        .eq("account_id", accId)
        .in("status", ["pending", "scheduled"])
        .lt("activity_date", now.toISOString().slice(0, 10))
        .limit(20);

      // Clients with incomplete docs that have active negotiations
      const { data: incDocs } = await supabase
        .from("clients")
        .select("id, name, doc_status")
        .eq("account_id", accId)
        .in("doc_status", ["in_review", "needs_resubmission", "pending"])
        .not("status", "in", '("lost","inactive")')
        .limit(10);

      // 4. Build deterministic alerts
      interface AlertDraft {
        alert_type: string;
        priority: string;
        title: string;
        entity_name: string;
        hours: number;
        ai_suggestion?: string;
        metadata: Record<string, unknown>;
      }

      const alerts: AlertDraft[] = [];

      for (const neg of idleNegs || []) {
        const hoursIdle = Math.round((now.getTime() - new Date(neg.updated_at).getTime()) / 3600000);
        const clientName = (neg.clients as Record<string, unknown>)?.name as string || "Cliente";
        alerts.push({
          alert_type: "negotiation_idle",
          priority: hoursIdle > cfg.negotiation_idle_hours * 2 ? "critical" : "warning",
          title: `Negociação parada há ${hoursIdle}h`,
          entity_name: clientName,
          hours: hoursIdle,
          metadata: { negotiation_id: neg.id, client_id: neg.client_id, broker_id: neg.broker_id },
        });
      }

      for (const prop of pendingProps || []) {
        const hoursWaiting = Math.round((now.getTime() - new Date(prop.created_at).getTime()) / 3600000);
        alerts.push({
          alert_type: "proposal_no_response",
          priority: hoursWaiting > cfg.proposal_response_hours * 2 ? "critical" : "warning",
          title: `Proposta sem resposta há ${hoursWaiting}h`,
          entity_name: "Proposta #" + (prop.id as string).slice(0, 8),
          hours: hoursWaiting,
          metadata: { proposal_id: prop.id, negotiation_id: prop.negotiation_id },
        });
      }

      for (const res of expiringRes || []) {
        const hoursLeft = Math.round((new Date(res.expires_at).getTime() - now.getTime()) / 3600000);
        alerts.push({
          alert_type: "reservation_expiring",
          priority: hoursLeft <= 6 ? "critical" : "warning",
          title: `Reserva expira em ${hoursLeft}h`,
          entity_name: "Reserva",
          hours: hoursLeft,
          metadata: { reservation_id: res.id, unit_id: res.unit_id, negotiation_id: res.negotiation_id },
        });
      }

      for (const act of overdueFU || []) {
        const hoursOverdue = Math.round((now.getTime() - new Date(act.activity_date + "T23:59:59").getTime()) / 3600000);
        const clientName = (act.clients as Record<string, unknown>)?.name as string || "Cliente";
        alerts.push({
          alert_type: "follow_up_overdue",
          priority: hoursOverdue > 48 ? "critical" : "warning",
          title: `Follow-up atrasado ${hoursOverdue}h`,
          entity_name: clientName,
          hours: hoursOverdue,
          metadata: { activity_id: act.id, client_id: act.client_id, assigned_to: act.profile_id },
        });
      }

      for (const cli of incDocs || []) {
        alerts.push({
          alert_type: "documents_incomplete",
          priority: "info",
          title: `Documentos pendentes`,
          entity_name: cli.name,
          hours: 0,
          metadata: { client_id: cli.id },
        });
      }

      // 5. Generate AI suggestions if alerts exist and key is available
      if (alerts.length > 0 && anthropicKey) {
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
              max_tokens: 1024,
              system: `Você é o assistente de inteligência comercial do NEXA, CRM imobiliário brasileiro.
Analise alertas operacionais e gere sugestões práticas e curtas de ação.
Português brasileiro, tom profissional e direto. Máximo 2 frases por sugestão.
Foque em ações concretas que o gestor ou corretor pode tomar AGORA.`,
              tools: [{
                name: "generate_suggestions",
                description: "Gera sugestões de ação para alertas comerciais",
                input_schema: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          alert_index: { type: "number" },
                          suggestion: { type: "string" },
                        },
                        required: ["alert_index", "suggestion"],
                      },
                    },
                  },
                  required: ["suggestions"],
                },
              }],
              tool_choice: { type: "tool", name: "generate_suggestions" },
              messages: [{
                role: "user",
                content: `Analise estes ${alerts.length} alertas e gere sugestões:\n\n${alerts.map((a, i) =>
                  `[${i}] ${a.priority.toUpperCase()} | ${a.title} | ${a.entity_name} | ${a.hours}h`
                ).join("\n")}`,
              }],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            // deno-lint-ignore no-explicit-any
            const toolUse = aiData.content?.find((b: any) => b.type === "tool_use");
            const suggestions = toolUse?.input?.suggestions || [];
            for (const sug of suggestions) {
              if (alerts[sug.alert_index]) {
                alerts[sug.alert_index].ai_suggestion = sug.suggestion;
              }
            }
          }
        } catch (aiErr) {
          console.error("AI suggestion error (non-blocking):", aiErr);
        }
      }

      // 6. Persist alerts
      if (alerts.length > 0) {
        const records = alerts.map((a) => ({
          account_id: accId,
          alert_type: a.alert_type,
          priority: a.priority,
          title: a.title,
          message: `${a.entity_name} — ${a.title}`,
          ai_suggestion: a.ai_suggestion || null,
          metadata: a.metadata,
          expires_at: new Date(now.getTime() + 24 * 3600000).toISOString(),
        }));

        await supabase.from("intelligence_alerts").insert(records);

        // 7. Notify directors/managers
        const { data: managers } = await supabase
          .from("user_account_access")
          .select("user_id")
          .eq("account_id", accId)
          .in("role", ["owner", "director", "manager"]);

        if (managers && managers.length > 0) {
          const criticalCount = alerts.filter((a) => a.priority === "critical").length;
          const warningCount = alerts.filter((a) => a.priority === "warning").length;

          if (criticalCount > 0 || warningCount > 0) {
            const notifs = managers.map((m: Record<string, unknown>) => ({
              account_id: accId,
              recipient_id: m.user_id,
              sender_id: null,
              type: "intelligence_alert",
              title: "Alertas de inteligência",
              message: `${criticalCount} crítico(s), ${warningCount} atenção. Verifique a Central.`,
              read: false,
              action_url: "/",
            }));
            await supabase.from("notifications").insert(notifs);
          }
        }
      }

      results.push({ account_id: accId, alerts_generated: alerts.length });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Intelligence alerts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
