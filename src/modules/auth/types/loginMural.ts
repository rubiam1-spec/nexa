export type LoginMuralKind = "manifesto" | "announcement" | "pulse" | "maintenance";

export type LoginMuralBadgeColor =
  | "sprout"
  | "terracotta"
  | "blue"
  | "purple"
  | "red"
  | "yellow";

export interface LoginMuralItem {
  kind: LoginMuralKind;
  headline: string;
  subline: string | null;
  badge_label: string | null;
  badge_color: LoginMuralBadgeColor | string | null;
  cta_label: string | null;
  cta_url: string | null;
}

export const LOGIN_MURAL_FALLBACK: LoginMuralItem = {
  kind: "manifesto",
  headline: "Onde o terreno bruto vira patrimônio rastreável.",
  subline: "Plataforma comercial imobiliária.",
  badge_label: null,
  badge_color: null,
  cta_label: null,
  cta_url: null,
};
