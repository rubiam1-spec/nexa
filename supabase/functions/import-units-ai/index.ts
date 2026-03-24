import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada. Configure em Project Settings > Edge Functions > Secrets." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Body inválido. Envie JSON com campo 'conteudo'." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conteudo = body.conteudo;
    if (!conteudo || typeof conteudo !== "string") {
      return new Response(
        JSON.stringify({ error: "Campo 'conteudo' é obrigatório (texto CSV/tabela)." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Analise esta tabela de vendas imobiliária e extraia os dados de cada lote/unidade.

Retorne APENAS JSON puro, sem texto antes ou depois, sem markdown, sem backticks.

Formato exato:
{"unidades":[{"quadra":"1","lote":"2","area":1000,"valor":1035000,"status":"available","socio_permutante":false}]}

Campos obrigatórios por unidade (APENAS estes, nenhum outro):
- quadra: string
- lote: string (remover * do valor)
- area: número em m² sem unidade
- valor: número em reais sem R$ ou pontos
- status: "available" se Disponível/em branco, "sold" se Vendido, "reserved" se Reservado
- socio_permutante: boolean (true se lote tinha *)

Regras:
- Se lote tinha *: socio_permutante = true
- Ignorar linhas sem quadra E sem lote
- Ignorar cabeçalhos, logos, totais, linhas vazias
- NÃO incluir campos extras como entrada, balão, parcela ou observações

Tabela:
${conteudo}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10000,
        system: "Você extrai dados de tabelas de vendas imobiliárias. Retorne APENAS JSON puro válido, sem texto adicional, sem markdown, sem backticks.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `Claude API ${resp.status}: ${errText.slice(0, 300)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeJson = await resp.json();
    const textContent = claudeJson.content?.[0]?.text ?? "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "IA não retornou JSON válido.", raw: textContent.slice(0, 500) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno na Edge Function." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
