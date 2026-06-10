// Ícones do catálogo (activity_kinds.icon = string-chave). SVG inline, nunca
// lucide. Fallback: 'file'. Estilo linha, stroke = currentColor/color.

const PATHS: Record<string, React.ReactNode> = {
  "map-pin": (
    <>
      <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0111 0" />
      <path d="M16 6.5a3 3 0 010 6M20.5 19a5 5 0 00-3.2-4.7" />
    </>
  ),
  "building-estate": (
    <>
      <path d="M3 21V8l6-4 6 4v13" />
      <path d="M15 21V11l4 2.5V21" />
      <path d="M3 21h18" />
      <path d="M7 12h2M7 16h2" />
    </>
  ),
  phone: (
    <path d="M5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5V19a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z" />
  ),
  refresh: (
    <>
      <path d="M4 12a8 8 0 0113.5-5.8L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 01-13.5 5.8L4 16" />
      <path d="M4 20v-4h4" />
    </>
  ),
  "users-group": (
    <>
      <circle cx="8" cy="9" r="2.4" />
      <circle cx="16" cy="9" r="2.4" />
      <path d="M3 18a5 5 0 019-2.5A5 5 0 0121 18" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M5 21h14" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2z" />
      <path d="M5 17.5A2 2 0 017 16h11" />
      <path d="M9 4v12" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h.01M12 11h.01M16 11h.01M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" />
    </>
  ),
  "chart-bar": (
    <>
      <path d="M4 20h16" />
      <rect x="6" y="11" width="3" height="6" />
      <rect x="11" y="7" width="3" height="10" />
      <rect x="16" y="13" width="3" height="4" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 17l-5-5-4 4-2-2-7 7" />
    </>
  ),
  "file-text": (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 16.5h6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  headset: (
    <>
      <path d="M4 13v-1a8 8 0 0116 0v1" />
      <rect x="3" y="13" width="3.5" height="6" rx="1.4" />
      <rect x="17.5" y="13" width="3.5" height="6" rx="1.4" />
      <path d="M20 19a4 4 0 01-4 3h-2" />
    </>
  ),
  checkbox: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12l2.5 2.5L16 9" />
    </>
  ),
};

export default function KindIcon({
  name,
  size = 20,
  color = "currentColor",
  sw = 1.6,
}: {
  name: string | null | undefined;
  size?: number;
  color?: string;
  sw?: number;
}) {
  const body = (name && PATHS[name]) || PATHS.file;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "block" }}
    >
      {body}
    </svg>
  );
}
