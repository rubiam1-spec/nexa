import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimited } from "../_shared/auth.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account_id");
  const weekStart = url.searchParams.get("week_start");
  const weekEnd = url.searchParams.get("week_end");

  if (!accountId || !weekStart || !weekEnd) {
    return new Response("Parâmetros obrigatórios: account_id, week_start, week_end", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Rate limit by IP (PDF generation is expensive)
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(`pdf:${ip}`, 10, 60000)) return rateLimited();

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [acctRes, actRes, negRes, salesRes] = await Promise.all([
      supabase.from("accounts").select("name").eq("id", accountId).maybeSingle(),
      supabase.from("activities").select("id, profile_id, type, duration_minutes, activity_date, profiles!activities_profile_id_fkey(name)").eq("account_id", accountId).gte("activity_date", weekStart).lte("activity_date", weekEnd),
      supabase.from("negotiations").select("id").eq("account_id", accountId).gte("created_at", weekStart + "T00:00:00Z").lte("created_at", weekEnd + "T23:59:59Z"),
      supabase.from("sales").select("id").eq("account_id", accountId).gte("created_at", weekStart + "T00:00:00Z").lte("created_at", weekEnd + "T23:59:59Z"),
    ]);

    const accountName = (acctRes.data as Record<string, unknown> | null)?.name as string || "NEXA";
    const activities = (actRes.data || []) as Record<string, unknown>[];
    const totalActivities = activities.length;
    const totalHours = activities.reduce((s, a) => s + (Number(a.duration_minutes) || 0), 0) / 60;
    const totalNegotiations = negRes.data?.length || 0;
    const totalSales = salesRes.data?.length || 0;

    // Ranking
    const memberMap: Record<string, { count: number; hours: number }> = {};
    for (const a of activities) {
      const p = a.profiles as Record<string, unknown> | null;
      const name = (p?.name as string) || "Desconhecido";
      if (!memberMap[name]) memberMap[name] = { count: 0, hours: 0 };
      memberMap[name].count++;
      memberMap[name].hours += (Number(a.duration_minutes) || 0) / 60;
    }
    const ranking = Object.entries(memberMap).sort((a, b) => b[1].count - a[1].count);
    const maxCount = ranking.length > 0 ? ranking[0][1].count : 1;

    // Format dates for display
    const fmtDate = (d: string) => { const p = d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };

    const rankingHtml = ranking.map((r, i) => {
      const pct = Math.round((r[1].count / maxCount) * 100);
      const medal = i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : i === 2 ? "\u{1F949}" : `${i + 1}\u00BA`;
      return `<div style="padding:12px 0;${i < ranking.length - 1 ? "border-bottom:1px solid #e5e5e0;" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:15px;font-weight:500;">${medal} ${r[0]}</span>
          <span><span style="color:#16a34a;font-size:14px;font-weight:600;">${r[1].count} ativ.</span><span style="color:#8A8985;font-size:14px;margin-left:12px;">${r[1].hours.toFixed(1)}h</span></span>
        </div>
        <div style="height:6px;background:#e5e5e0;border-radius:3px;margin-top:8px;"><div style="height:6px;background:#4ADE80;border-radius:3px;width:${pct}%;"></div></div>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relat\u00f3rio Semanal \u2014 ${accountName}</title>
<style>
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}
body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px 24px;color:#1C1B18;line-height:1.5}
h1{font-size:28px;font-weight:700;margin:0 0 4px}
.sub{color:#6b6b65;font-size:14px;margin:0 0 4px}
.date{color:#8A8985;font-size:13px;margin:0 0 32px}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px}
.kpi{background:#f5f5f0;border-radius:10px;padding:24px;text-align:center}
.kpi-label{font-size:11px;color:#8A8985;letter-spacing:0.1em;margin:0;text-transform:uppercase}
.kpi-value{font-size:36px;font-weight:700;margin:8px 0 0;font-family:monospace}
.kpi-value.green{color:#16a34a}
.ranking-title{font-size:12px;color:#8A8985;letter-spacing:0.1em;margin:0 0 12px;text-transform:uppercase}
.footer{text-align:center;color:#8A8985;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #e5e5e0}
.print-btn{display:block;text-align:center;padding:16px;background:#4ADE80;color:#12110F;font-size:16px;font-weight:600;border-radius:8px;border:none;cursor:pointer;margin-top:32px;width:100%}
</style>
</head>
<body>
<h1>Relat\u00f3rio semanal</h1>
<p class="sub">${accountName}</p>
<p class="date">${fmtDate(weekStart)} a ${fmtDate(weekEnd)}</p>

<div class="kpis">
<div class="kpi"><p class="kpi-label">Atividades</p><p class="kpi-value green">${totalActivities}</p></div>
<div class="kpi"><p class="kpi-label">Horas em campo</p><p class="kpi-value">${totalHours.toFixed(1)}h</p></div>
<div class="kpi"><p class="kpi-label">Negocia\u00e7\u00f5es</p><p class="kpi-value">${totalNegotiations}</p></div>
<div class="kpi"><p class="kpi-label">Vendas</p><p class="kpi-value green">${totalSales}</p></div>
</div>

${ranking.length > 0 ? `<p class="ranking-title">Ranking da equipe</p><div>${rankingHtml}</div>` : ""}

<button class="print-btn no-print" onclick="window.print()">Imprimir / Salvar como PDF</button>

<div class="footer">${accountName}<br>NEXA Plataforma Comercial \u00b7 app.nexacomercial.com.br</div>
</body>
</html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return new Response(`Erro: ${err instanceof Error ? err.message : String(err)}`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
});
