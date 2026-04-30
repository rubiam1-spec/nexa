export type ThemeMode = "dark" | "light" | "auto";

export interface ThemeTokens {
  surfaceBase: string; surfaceRaised: string; surfaceOverlay: string; surfaceHover: string; surfaceDisabled: string;
  borderDefault: string; borderSubtle: string; borderStrong: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textMuted: string; textDisabled: string;
  interactivePrimary: string; interactiveHover: string; interactiveOnPrimary: string;
  statusSproutMuted: string; statusTerracottaMuted: string; statusBlueMuted: string; statusPurpleMuted: string; statusRedMuted: string; statusYellowMuted: string;
  shadowSm: string; shadowMd: string; shadowLg: string;
  sidebarBg: string; sidebarBorder: string; sidebarText: string; sidebarTextActive: string; sidebarActiveBg: string; sidebarAvatarBg: string;
  scrollbarThumb: string; overlayBg: string;
}

export const darkTokens: ThemeTokens = {
  surfaceBase: "#0B0A08", surfaceRaised: "#1C1B18", surfaceOverlay: "#2A2822", surfaceHover: "#3D3A30", surfaceDisabled: "#5C5647",
  borderDefault: "#2A2822", borderSubtle: "#1C1B18", borderStrong: "#3D3A30",
  textPrimary: "#FAF9F6", textSecondary: "#E8E5DE", textTertiary: "#C4BFB3", textMuted: "#9C9686", textDisabled: "#706B5F",
  interactivePrimary: "#4ADE80", interactiveHover: "#22C55E", interactiveOnPrimary: "#12110F",
  statusSproutMuted: "rgba(74,222,128,0.12)", statusTerracottaMuted: "rgba(217,119,6,0.08)", statusBlueMuted: "rgba(96,165,250,0.12)", statusPurpleMuted: "rgba(167,139,250,0.12)", statusRedMuted: "rgba(248,113,113,0.12)", statusYellowMuted: "rgba(251,191,36,0.12)",
  shadowSm: "0 1px 2px rgba(0,0,0,0.3)", shadowMd: "0 4px 12px rgba(0,0,0,0.25)", shadowLg: "0 8px 24px rgba(0,0,0,0.3)",
  sidebarBg: "#0F0E0C", sidebarBorder: "rgba(61,58,48,0.15)", sidebarText: "#9C9686", sidebarTextActive: "#4ADE80", sidebarActiveBg: "rgba(74,222,128,0.08)", sidebarAvatarBg: "#2A2822",
  scrollbarThumb: "#3D3A30", overlayBg: "rgba(0,0,0,0.6)",
};

export const lightTokens: ThemeTokens = {
  surfaceBase: "#FAF9F6", surfaceRaised: "#FFFFFF", surfaceOverlay: "#1C1B18", surfaceHover: "#E8E5DE", surfaceDisabled: "#E0DDD5",
  borderDefault: "#D4D1CA", borderSubtle: "#EDEBE5", borderStrong: "#9C9686",
  textPrimary: "#12110F", textSecondary: "#3D3A30", textTertiary: "#5C5647", textMuted: "#706B5F", textDisabled: "#9C9686",
  interactivePrimary: "#16A34A", interactiveHover: "#15803D", interactiveOnPrimary: "#FFFFFF",
  statusSproutMuted: "rgba(22,163,74,0.10)", statusTerracottaMuted: "rgba(180,83,9,0.10)", statusBlueMuted: "rgba(37,99,235,0.10)", statusPurpleMuted: "rgba(124,58,237,0.10)", statusRedMuted: "rgba(220,38,38,0.10)", statusYellowMuted: "rgba(202,138,4,0.10)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.08)", shadowMd: "0 4px 12px rgba(0,0,0,0.10)", shadowLg: "0 8px 24px rgba(0,0,0,0.12)",
  sidebarBg: "#F5F4F0", sidebarBorder: "#E0DDD5", sidebarText: "#5C5647", sidebarTextActive: "#16A34A", sidebarActiveBg: "rgba(22,163,74,0.08)", sidebarAvatarBg: "#E8E5DE",
  scrollbarThumb: "#C4BFB3", overlayBg: "rgba(0,0,0,0.3)",
};

export const TOKEN_TO_CSS: Record<keyof ThemeTokens, string> = {
  surfaceBase: "--surface-base", surfaceRaised: "--surface-raised", surfaceOverlay: "--surface-overlay", surfaceHover: "--surface-hover", surfaceDisabled: "--surface-disabled",
  borderDefault: "--border-default", borderSubtle: "--border-subtle", borderStrong: "--border-strong",
  textPrimary: "--text-primary", textSecondary: "--text-secondary", textTertiary: "--text-tertiary", textMuted: "--text-muted", textDisabled: "--text-disabled",
  interactivePrimary: "--interactive-primary", interactiveHover: "--interactive-hover", interactiveOnPrimary: "--interactive-on-primary",
  statusSproutMuted: "--status-sprout-muted", statusTerracottaMuted: "--status-terracotta-muted", statusBlueMuted: "--status-blue-muted", statusPurpleMuted: "--status-purple-muted", statusRedMuted: "--status-red-muted", statusYellowMuted: "--status-yellow-muted",
  shadowSm: "--shadow-sm", shadowMd: "--shadow-md", shadowLg: "--shadow-lg",
  sidebarBg: "--sidebar-bg", sidebarBorder: "--sidebar-border", sidebarText: "--sidebar-text", sidebarTextActive: "--sidebar-text-active", sidebarActiveBg: "--sidebar-active-bg", sidebarAvatarBg: "--sidebar-avatar-bg",
  scrollbarThumb: "--scrollbar-thumb", overlayBg: "--overlay-bg",
};
