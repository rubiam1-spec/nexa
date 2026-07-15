import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderNexaEmail, nexaSubject, type NexaStat, type NexaListItem } from "../_shared/emailTemplate.ts";

// E-mail 2 — "O pulso de hoje" (Capítulo E-mail, Parte 3). 1 por destinatário/dia.
// 3 números (novos / sem resposta >2h #C2410C / convertidos) + "Precisam de você"
// (máx. 5). Envia SÓ se houver conteúdo. Escopo: gestão vê a conta; consultor/
// corretor vê os leads sob sua responsabilidade. Best-effort: NUNCA silencioso.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACCOUNT_ROLES = ["concierge", "owner", "director", "manager"];
const PERSONAL_ROLES = ["commercial_consultant", "broker"];
const OPEN_STATUS = ["new", "contacted", "active"]; // ainda em aberto (não convertido/perdido)

const dias = (ms: number) => {
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
};

async function sendResend(key: string, to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "NEXA <noreply@nexacomercial.com.br>", to, subject, html }),
  });
  if (!res.ok) console.error("[daily-lead-digest] Resend:", await res.text()); // NUNCA silencioso
  return res.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // ── Modo de teste de renderização: to_email → 1 exemplar representativo, sem DB. ──
    if (body.to_email) {
      const stats: NexaStat[] = [
        { value: "6", label: "LEADS NOVOS" },
        { value: "2", label: "SEM RESPOSTA >2H", color: "#C2410C" },
        { value: "1", label: "CONVERTIDO" },
      ];
      const list = { label: "PRECISAM DE VOCÊ", items: [
        { name: "Cabral de Oliveira", note: "WhatsApp, sem resposta há 2 dias", link: "https://app.nexacomercial.com.br/leads" },
        { name: "Elza Gusteman", note: "sem responsável desde ontem", link: "https://app.nexacomercial.com.br/leads" },
      ] as NexaListItem[] };
      const html = renderNexaEmail({
        title: "O pulso de hoje", meta: "Vivendas do Bosque · hoje",
        stats, list,
        ctas: [{ label: "Abrir o painel →", url: "https://app.nexacomercial.com.br/leads", primary: true }],
        footer: { account: "Bomm Urbanizadora", development: "Vivendas do Bosque" },
      });
      const ok = await sendResend(resendKey, String(body.to_email), nexaSubject("Seu dia: 6 leads novos, 2 sem resposta há mais de 2h"), html);
      return new Response(JSON.stringify({ success: ok, mode: "render_test" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Produção: itera contas ativas → destinatários → computa escopo → envia se houver conteúdo. ──
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 3600000).toISOString();
    const twoHAgo = new Date(now - 2 * 3600000).toISOString();
    const today = new Date(now).toISOString().slice(0, 10); // data UTC (casa com lead_digest_log.digest_date)

    let accountIds = body.account_id ? [String(body.account_id)] : [];
    if (accountIds.length === 0) {
      const { data: accounts } = await supabase.from("accounts").select("id, name").eq("active", true);
      accountIds = (accounts ?? []).map((a: Record<string, unknown>) => a.id as string);
    }

    const results: { account_id: string; sent: number }[] = [];

    for (const accId of accountIds) {
      const { data: account } = await supabase.from("accounts").select("name").eq("id", accId).maybeSingle();
      const accountName = (account?.name as string) || undefined;

      const { data: access } = await supabase.from("user_account_access").select("user_id, role")
        .eq("account_id", accId).in("role", [...ACCOUNT_ROLES, ...PERSONAL_ROLES]);
      // dedup por usuário: gestão tem prioridade de escopo (conta) sobre pessoal.
      const scopeByUser = new Map<string, "account" | "personal">();
      for (const r of access ?? []) {
        const uid = r.user_id as string; if (!uid) continue;
        const isAccount = ACCOUNT_ROLES.includes(r.role as string);
        if (isAccount) scopeByUser.set(uid, "account");
        else if (!scopeByUser.has(uid)) scopeByUser.set(uid, "personal");
      }

      let sent = 0;
      for (const [uid, scope] of scopeByUser) {
        // Preferência: digest pode ser desligado pelo usuário (default ON).
        const { data: pref } = await supabase.from("notification_preferences").select("daily_digest").eq("profile_id", uid).maybeSingle();
        if (pref && pref.daily_digest === false) continue;
        // Dedup 1/dia: se já enviou hoje, pula (idempotente a reinvocações).
        const { data: already } = await supabase.from("lead_digest_log").select("recipient_id").eq("recipient_id", uid).eq("digest_date", today).maybeSingle();
        if (already) continue;

        const cnt = async (build: (q: any) => any) => {
          let q = supabase.from("clients").select("*", { count: "exact", head: true }).eq("account_id", accId);
          q = scope === "personal" ? q.eq("assigned_to", uid) : q;
          const { count } = await build(q);
          return count || 0;
        };
        const novos = await cnt((q) => q.gte("created_at", dayAgo));
        const semResposta = await cnt((q) => q.is("last_interaction_at", null).lt("created_at", twoHAgo).in("status", OPEN_STATUS));
        const convertidos = await cnt((q) => q.gte("converted_at", dayAgo));

        if (novos + semResposta + convertidos === 0) continue; // só se houver conteúdo

        // "Precisam de você": leads sem resposta, mais antigos primeiro, máx. 5.
        let needQ = supabase.from("clients").select("name, phone, assigned_to, created_at")
          .eq("account_id", accId).is("last_interaction_at", null).lt("created_at", twoHAgo)
          .in("status", OPEN_STATUS).order("created_at", { ascending: true }).limit(5);
        needQ = scope === "personal" ? needQ.eq("assigned_to", uid) : needQ;
        const { data: need } = await needQ;
        const items: NexaListItem[] = (need ?? []).map((c: Record<string, unknown>) => ({
          name: (c.name as string) || "Lead sem nome",
          note: c.assigned_to ? `sem resposta ${dias(now - new Date(c.created_at as string).getTime())}` : "sem responsável",
          link: "https://app.nexacomercial.com.br/leads",
        }));

        const { data: authUser } = await supabase.auth.admin.getUserById(uid);
        const email = authUser?.user?.email;
        if (!email) continue;

        const stats: NexaStat[] = [
          { value: String(novos), label: "LEADS NOVOS" },
          { value: String(semResposta), label: "SEM RESPOSTA >2H", color: semResposta > 0 ? "#C2410C" : undefined },
          { value: String(convertidos), label: convertidos === 1 ? "CONVERTIDO" : "CONVERTIDOS" },
        ];
        const html = renderNexaEmail({
          title: "O pulso de hoje", meta: accountName,
          stats, list: items.length ? { label: "PRECISAM DE VOCÊ", items } : undefined,
          ctas: [{ label: "Abrir o painel →", url: "https://app.nexacomercial.com.br/leads", primary: true }],
          footer: { account: accountName },
        });
        const subject = nexaSubject(`Seu dia: ${novos} ${novos === 1 ? "lead novo" : "leads novos"}${semResposta > 0 ? `, ${semResposta} sem resposta há mais de 2h` : ""}`);
        if (await sendResend(resendKey, email, subject, html)) {
          sent++;
          // Marca como enviado hoje (best-effort: falha aqui não reenvia no mesmo run).
          await supabase.from("lead_digest_log").insert({ recipient_id: uid, account_id: accId });
        }
      }
      results.push({ account_id: accId, sent });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[daily-lead-digest] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
