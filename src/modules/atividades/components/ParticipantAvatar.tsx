// Avatar de participante — cor estável por nome (hash → paleta calma e
// distinta). NUNCA Sprout (verde acento). Reusado em card, pickers e chips.

const PALETTE: [string, string][] = [
  ["#B5D4F4", "#0C447C"], // azul
  ["#9FE1CB", "#085041"], // teal
  ["#F0997B", "#4A1B0C"], // coral
  ["#FAC775", "#633806"], // âmbar
  ["#CECBF6", "#26215C"], // roxo
  ["#F4C0D1", "#4B1528"], // rosa
];

function paletteIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return sum % PALETTE.length;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ParticipantAvatar({
  name,
  size = 28,
  ring = "var(--surface-base)",
  title,
}: {
  name: string;
  size?: number;
  ring?: string;
  title?: string;
}) {
  const [bg, fg] = PALETTE[paletteIndex(name || "?")];
  return (
    <span
      title={title ?? name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 0 2px ${ring}`,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials(name)}
    </span>
  );
}

// Pílula "+N" no mesmo tamanho/estilo, fundo neutro.
export function MoreAvatar({ count, size = 28, ring = "var(--surface-base)" }: { count: number; size?: number; ring?: string }) {
  return (
    <span
      title={`+${count}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--surface-raised)",
        color: "var(--text-secondary)",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 0 2px ${ring}`,
        flexShrink: 0,
      }}
    >
      +{count}
    </span>
  );
}
