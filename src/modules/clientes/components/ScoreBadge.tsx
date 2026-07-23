import type { CSSProperties } from "react";
import { scoreBand, showScoreBadge } from "../scoreDisplay";

// N3-UI · badge discreto do score no card/lista. Aparece SÓ quando score ≥ 40
// (baixo não polui). Cor por faixa: alta = Sprout (interactive-primary),
// média = âmbar. Sprout NUNCA fora da faixa alta.
export function ScoreBadge({ score, style }: { score: number | null | undefined; style?: CSSProperties }) {
  if (!showScoreBadge(score)) return null;
  const color = scoreBand(score) === "high" ? "#4ADE80" : "#FBBF24"; // alta = Sprout · média = âmbar
  return (
    <span
      title={`Score ${score} / 100`}
      style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 5, color, background: color + "1F", whiteSpace: "nowrap", flexShrink: 0, ...style }}
    >
      {score}
    </span>
  );
}
