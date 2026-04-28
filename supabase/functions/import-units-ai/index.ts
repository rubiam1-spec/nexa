import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { validateAuth, unauthorized, checkRateLimit, rateLimited } from "../_shared/auth.ts";

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
    // Auth: any authenticated user can use AI import
    const auth = await validateAuth(req);
    if (!auth) return unauthorized("Autenticação necessária para importação AI");

    // Rate limit: 5 AI calls per minute per user (costs money)
    if (!checkRateLimit(`import-ai:${auth.userId}`, 5, 60000)) return rateLimited();

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

Regras:
- Se lote tinha *: socio_permutante = true
- Ignorar linhas sem quadra E sem lote
- Ignorar cabeçalhos, logos, totais, linhas vazias
- NÃO incluir campos extras como entrada, balão, parcela ou observações
- status: "available" se Disponível/em branco, "sold" se Vendido, "reserved" se Reservado

Tabela:
${conteudo}`;

    // ── Cookbook: Prompt Caching + Structured JSON via tool_use ──
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10000,
        system: [
          {
            type: "text",
            text: "Você extrai dados de tabelas de vendas imobiliárias. Analise os dados e retorne usando a ferramenta import_data. Extraia quadra, lote, área em m², valor em reais (número puro), status e se é sócio permutante.",
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: "import_data",
            description: "Retorna os dados extraídos da tabela de vendas como JSON estruturado",
            input_schema: {
              type: "object",
              properties: {
                unidades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      quadra: { type: "string", description: "Número da quadra" },
                      lote: { type: "string", description: "Número do lote (sem asterisco)" },
                      area: { type: "number", description: "Área em m² (número puro)" },
                      valor: { type: "number", description: "Valor em reais (número puro sem R$ ou pontos)" },
                      status: { type: "string", enum: ["available", "sold", "reserved"], description: "Status do lote" },
                      socio_permutante: { type: "boolean", description: "true se lote tinha asterisco (*)" },
                    },
                    required: ["quadra", "lote"],
                  },
                },
              },
              required: ["unidades"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "import_data" },
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

    // Extract structured data from tool_use block (guaranteed JSON)
    const toolUseBlock = claudeJson.content?.find((b: Record<string, unknown>) => b.type === "tool_use");
    if (toolUseBlock?.input) {
      // Log cache stats if available
      const usage = claudeJson.usage;
      if (usage?.cache_read_input_tokens) {
        console.log(`Cache hit: ${usage.cache_read_input_tokens} tokens read from cache`);
      }
      return new Response(
        JSON.stringify(toolUseBlock.input),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: try text extraction (shouldn't happen with tool_choice forced)
    const textContent = claudeJson.content?.[0]?.text ?? "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(
        JSON.stringify(JSON.parse(jsonMatch[0])),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "IA não retornou dados estruturados.", raw: textContent.slice(0, 500) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno na Edge Function." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
