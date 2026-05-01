import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active accounts
    const { data: accounts } = await supabase.from("accounts").select("id, name");
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No accounts found" }), { headers: { "Content-Type": "application/json" } });
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekStartStr = weekAgo.split("T")[0];
    const weekEndStr = new Date().toISOString().split("T")[0];
    let emailsSent = 0;

    for (const account of accounts) {
      // Fetch week's data
      const { data: activities } = await supabase
        .from("activities")
        .select("id, profile_id, type, duration_minutes, activity_date, profiles!activities_profile_id_fkey(name)")
        .eq("account_id", account.id)
        .gte("activity_date", weekStartStr);

      const { data: negotiations } = await supabase
        .from("negotiations")
        .select("id")
        .eq("account_id", account.id)
        .gte("created_at", weekAgo);

      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("account_id", account.id)
        .gte("created_at", weekAgo);

      const { data: proposals } = await supabase
        .from("proposals")
        .select("id")
        .eq("account_id", account.id)
        .gte("created_at", weekAgo);

      // Calculate metrics
      const totalActivities = activities?.length || 0;
      const totalHours = (activities || []).reduce((sum, a: Record<string, unknown>) => sum + (Number(a.duration_minutes) || 0), 0) / 60;
      const totalNegotiations = negotiations?.length || 0;
      const totalSales = sales?.length || 0;
      const totalProposals = proposals?.length || 0;

      // Skip if no activity this week
      if (totalActivities === 0 && totalNegotiations === 0 && totalSales === 0) continue;

      // Ranking by member
      const memberMap: Record<string, { count: number; hours: number }> = {};
      for (const a of (activities || []) as Record<string, unknown>[]) {
        const p = a.profiles as Record<string, unknown> | null;
        const name = (p?.name as string) || "Desconhecido";
        if (!memberMap[name]) memberMap[name] = { count: 0, hours: 0 };
        memberMap[name].count++;
        memberMap[name].hours += (Number(a.duration_minutes) || 0) / 60;
      }
      const ranking = Object.entries(memberMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

      // Get managers and directors
      const { data: managers } = await supabase
        .from("user_account_access")
        .select("user_id")
        .eq("account_id", account.id)
        .in("role", ["owner", "director", "manager"]);

      // Send email to each manager via send-notification-email
      for (const mgr of (managers || []) as Record<string, unknown>[]) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              recipient_id: mgr.user_id,
              type: "weekly_report",
              title: "Relatório semanal de produtividade",
              message: `${totalActivities} atividades · ${totalHours.toFixed(1)}h em campo · ${totalNegotiations} negociações · ${totalProposals} propostas · ${totalSales} vendas`,
              action_url: "/atividades",
              metadata: {
                account_id: account.id,
                account_name: account.name,
                total_activities: totalActivities,
                total_hours: totalHours.toFixed(1),
                total_negotiations: totalNegotiations,
                total_proposals: totalProposals,
                total_sales: totalSales,
                ranking,
                week_start: weekStartStr,
                week_end: weekEndStr,
              },
            }),
          });
          emailsSent++;
        } catch (e) {
          console.error(`Email error for ${mgr.user_id}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Weekly report error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
