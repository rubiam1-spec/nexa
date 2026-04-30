// NEXA Icon Library — SVG inline, stroke-based, 18x18 default
// All icons use currentColor and are consistent with sidebar icons

interface P { size?: number; color?: string; sw?: number }
const d = { size: 18, sw: 1.5 };
const s = (p: P) => ({ width: p.size || d.size, height: p.size || d.size, viewBox: "0 0 24 24", fill: "none", stroke: p.color || "currentColor", strokeWidth: p.sw || d.sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

// ── Navigation / Module icons ──
export const IcDashboard = (p: P = {}) => <svg {...s(p)}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
export const IcSimulador = (p: P = {}) => <svg {...s(p)}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
export const IcPipeline = (p: P = {}) => <svg {...s(p)}><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="8" width="5" height="13" rx="1"/><rect x="17" y="5" width="5" height="16" rx="1"/></svg>;
export const IcUnidades = (p: P = {}) => <svg {...s(p)}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
export const IcNegociacoes = (p: P = {}) => <svg {...s(p)}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
export const IcClientes = (p: P = {}) => <svg {...s(p)}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
export const IcCorretores = (p: P = {}) => <svg {...s(p)}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>;
export const IcImobiliarias = (p: P = {}) => <svg {...s(p)}><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>;
export const IcAtividades = (p: P = {}) => <svg {...s(p)}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
export const IcRelatorios = (p: P = {}) => <svg {...s(p)}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
export const IcMateriais = (p: P = {}) => <svg {...s(p)}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
export const IcEmpreendimentos = (p: P = {}) => <svg {...s(p)}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>;
export const IcUsuarios = (p: P = {}) => <svg {...s(p)}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
export const IcConfiguracoes = (p: P = {}) => <svg {...s(p)}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83"/></svg>;

// ── Activity type icons ──
export const IcVisita = (p: P = {}) => <svg {...s(p)}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
export const IcLigacao = (p: P = {}) => <svg {...s(p)}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
export const IcFollowUp = (p: P = {}) => <svg {...s(p)}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>;
export const IcTreinamento = (p: P = {}) => <svg {...s(p)}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>;
export const IcReuniao = (p: P = {}) => <svg {...s(p)}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="19" cy="11" r="3"/></svg>;
export const IcOutro = (p: P = {}) => <svg {...s(p)}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

// ── Report icons ──
export const IcEstoque = (p: P = {}) => <svg {...s(p)}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
export const IcHandshake = (p: P = {}) => <svg {...s(p)}><path d="M12 22s-4-2.35-4-6.64A4 4 0 0112 11.5a4 4 0 014 3.86C16 19.65 12 22 12 22z"/><path d="M5 12l-2 2 4 4 3-3"/><path d="M19 12l2 2-4 4-3-3"/></svg>;

// ── Utility icons ──
export const IcWarning = (p: P = {}) => <svg {...s(p)}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
export const IcCheck = (p: P = {}) => <svg {...s(p)}><polyline points="20 6 9 17 4 12"/></svg>;
export const IcX = (p: P = {}) => <svg {...s(p)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
export const IcPlus = (p: P = {}) => <svg {...s(p)}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
export const IcSearch = (p: P = {}) => <svg {...s(p)}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
export const IcPdf = (p: P = {}) => <svg {...s(p)}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
export const IcStreak = (p: P = {}) => <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke={p.color || "#F97316"} strokeWidth={p.sw || 1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-4.97 0-9-2.686-9-6v-.002C3 12.168 7.477 8.862 8 3c.5 3 2.5 5.5 5 7-.5-3 .5-6 3-8 0 4 1 7 3 9 1.5 1.5 2 3.5 2 5v.002c0 3.314-4.03 6-9 6z"/></svg>;
export const IcBolt = (p: P = {}) => <svg {...s(p)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;

// ── Medal (position indicator) ──
export const IcMedal = ({ pos, size = 20 }: { pos: number; size?: number }) => {
  const c = pos === 1 ? "#FFD700" : pos === 2 ? "#C0C0C0" : pos === 3 ? "#CD7F32" : "#706B5F";
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="6" stroke={c} strokeWidth="1.5"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><text x="12" y="11.5" textAnchor="middle" fill={c} fontSize="8" fontWeight="700" fontFamily="sans-serif">{pos}</text></svg>;
};
