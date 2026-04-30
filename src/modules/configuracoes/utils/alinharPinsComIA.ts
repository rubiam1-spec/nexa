import type { PinComMetadata, PinAlinhado } from "./alinharPins";
import { supabase } from "../../../infra/supabase/supabaseClient";

function getQuadraRegion(quadra: string): string {
  const regions: Record<string, string> = {
    "1": "Extremo esquerdo. x: 5-15%, y: 10-95%",
    "2": "Segunda coluna. x: 16-28%, y: 10-95%",
    "3": "Terceira coluna. x: 29-42%, y: 10-95%",
    "4": "Quarta coluna (centro). x: 43-55%, y: 10-95%",
    "5": "Quinta coluna. x: 56-68%, y: 25-95%",
    "6": "Sexta coluna. x: 69-78%, y: 25-70%",
    "7": "Sétima coluna. x: 69-85%, y: 55-95%",
    "8": "Extremo direito. x: 78-95%, y: 55-95%",
  };
  return regions[quadra] || `Região ${quadra} do mapa. Distribua proporcionalmente.`;
}

export async function alinharPinsComIA(
  pins: PinComMetadata[],
  onProgress?: (step: string, progress: number) => void,
): Promise<PinAlinhado[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  // Group by quadra
  const grupos: Record<string, PinComMetadata[]> = {};
  for (const pin of pins) {
    if (!grupos[pin.quadra]) grupos[pin.quadra] = [];
    grupos[pin.quadra].push(pin);
  }

  const quadraKeys = Object.keys(grupos).sort((a, b) => parseInt(a) - parseInt(b));
  const allPins: PinAlinhado[] = [];

  for (let i = 0; i < quadraKeys.length; i++) {
    const quadra = quadraKeys[i];
    const group = grupos[quadra];
    const progress = Math.round(((i + 1) / quadraKeys.length) * 100);

    onProgress?.(`Processando Quadra ${quadra} (${group.length} lotes)...`, progress);

    const prompt = `Voce e um assistente de posicionamento de lotes em um mapa de loteamento.

TAREFA: Reposicionar ${group.length} lotes da Quadra ${quadra}, alinhando-os de forma esteticamente uniforme.

Posicoes atuais (percentual 0-100 da imagem):
${JSON.stringify(group.map((p) => ({ unitId: p.unitId, lote: p.lote, x: p.xPct, y: p.yPct })))}

REGIAO SUGERIDA: ${getQuadraRegion(quadra)}

REGRAS:
- Mantenha o centro geral da quadra no mesmo local
- Alinhe em fileiras/colunas uniformes
- Espacamento minimo de 1.5% entre lotes
- Valores entre 0 e 100, arredondados a 2 casas
- Respeite a ordem numerica dos lotes
- Se a quadra tem 1 pin, nao mova

Responda APENAS com JSON valido, sem explicacoes, sem markdown:
[{"unitId":"uuid","xPct":45.23,"yPct":32.10}]`;

    try {
      const { data, error } = await supabase.functions.invoke("claude-proxy", {
        body: { prompt, max_tokens: 4000 },
      });

      if (error) throw new Error(error.message);

      const texto: string = data?.content?.[0]?.text ?? data?.content ?? data?.text ?? (typeof data === "string" ? data : JSON.stringify(data));
      const parsed = JSON.parse(texto.replace(/```json|```/g, "").trim());
      const arr = Array.isArray(parsed) ? parsed : parsed.pins ?? [];

      allPins.push(...arr.map((p: Record<string, unknown>) => ({
        unitId: (p.unitId ?? p.unit_id) as string,
        xPct: Number(p.xPct ?? p.x_pct),
        yPct: Number(p.yPct ?? p.y_pct),
      })));

      console.log(`[IA] Quadra ${quadra}: ${arr.length} pins`);
    } catch (err: unknown) {
      console.error(`[IA] Erro Quadra ${quadra}:`, err);
      // Keep original positions for this quadra on failure
      allPins.push(...group.map((p) => ({ unitId: p.unitId, xPct: p.xPct, yPct: p.yPct })));
      onProgress?.(`Erro na Q${quadra} — mantendo posições originais`, progress);
    }

    // Delay between calls
    if (i < quadraKeys.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  onProgress?.(`Concluído! ${allPins.length} pins posicionados.`, 100);
  return allPins;
}
