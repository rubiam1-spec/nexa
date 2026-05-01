import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: tela de login é pré-auth, precisa responder para app.nexacomercial.com.br
// e também preview/local. "*" é aceitável aqui pois o endpoint só lê conteúdo
// público (login_mural_items tem SELECT liberado por RLS).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type Daypart = "morning" | "afternoon" | "evening";

interface MuralItem {
  kind: "manifesto" | "announcement" | "pulse" | "maintenance";
  headline: string;
  subline: string | null;
  badge_label: string | null;
  badge_color: string | null;
  cta_label: string | null;
  cta_url: string | null;
}

const FALLBACK: MuralItem = {
  kind: "manifesto",
  headline: "Onde o terreno bruto vira patrimônio rastreável.",
  subline: "Plataforma comercial imobiliária.",
  badge_label: null,
  badge_color: null,
  cta_label: null,
  cta_url: null,
};

/**
 * Retorna a parte do dia no fuso America/Sao_Paulo.
 * 5h–11h → morning · 12h–17h → afternoon · 18h–4h → evening
 */
function currentDaypartBRT(now = new Date()): Daypart {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  });
  const hourStr = fmt.format(now).replace(/[^0-9]/g, "");
  // Intl às vezes devolve "24" para meia-noite; normalizamos para 0.
  const hour = (parseInt(hourStr, 10) || 0) % 24;
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  return "evening";
}

function pickItem(row: Record<string, unknown>): MuralItem {
  return {
    kind: (row.kind as MuralItem["kind"]) ?? "manifesto",
    headline: (row.headline as string) ?? "",
    subline: (row.subline as string | null) ?? null,
    badge_label: (row.badge_label as string | null) ?? null,
    badge_color: (row.badge_color as string | null) ?? null,
    cta_label: (row.cta_label as string | null) ?? null,
    cta_url: (row.cta_url as string | null) ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jsonHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
    // Sem cache: cada tap em /entrar sorteia manifesto de novo.
    // Consumo baixo; evita que o CDN sirva a mesma frase por N min.
    "Cache-Control": "no-store",
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify(FALLBACK), { headers: jsonHeaders });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Anúncio/pulse/maintenance ativo de maior prioridade.
    const nowIso = new Date().toISOString();
    const { data: ann } = await supabase
      .from("login_mural_items")
      .select("*")
      .eq("active", true)
      .in("kind", ["announcement", "maintenance", "pulse"])
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (ann && ann.length > 0) {
      return new Response(JSON.stringify(pickItem(ann[0])), { headers: jsonHeaders });
    }

    // 2) Manifesto do dia (daypart atual OU neutral).
    const daypart = currentDaypartBRT();
    const { data: manifestos } = await supabase
      .from("login_mural_items")
      .select("*")
      .eq("active", true)
      .eq("kind", "manifesto")
      .in("daypart", [daypart, "neutral"])
      .order("id");

    if (manifestos && manifestos.length > 0) {
      // Sorteio uniforme entre os manifestos do daypart atual + neutros.
      // O daypart continua filtrando; a variação por reload vem daqui.
      const idx = Math.floor(Math.random() * manifestos.length);
      return new Response(JSON.stringify(pickItem(manifestos[idx])), { headers: jsonHeaders });
    }

    // 3) Sem manifesto? fallback seguro.
    return new Response(JSON.stringify(FALLBACK), { headers: jsonHeaders });
  } catch (err) {
    console.error("[get-login-mural-item] error:", err);
    return new Response(JSON.stringify(FALLBACK), { headers: jsonHeaders, status: 200 });
  }
});
