export default function Avatar({ name, avatarUrl, size = 32, color }: { name: string; avatarUrl?: string | null; size?: number; color?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: (color || "var(--interactive-primary)") + "20", color: color || "var(--interactive-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}
