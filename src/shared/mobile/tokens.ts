// Tokens de mobile/toque — fonte única. Alvo de toque mínimo (WCAG/Brand v7)
// e breakpoints usados nas mudanças condicionais (nunca alteram o desktop).
export const TOUCH_TARGET = 44;
export const MOBILE_BP = 480; // < 480: layout compacto
export const MOBILE_SMALL_BP = 400; // < 400: grids 2×2, etc.
// R1 · navegação: única faixa onde a largura decide o CHROME (não o conteúdo).
export const SIDEBAR_RAIL_BP = 768; // >= 768: sai a tab bar, entra o rail/sidebar
export const SIDEBAR_FULL_BP = 1180; // >= 1180: sidebar completa 240px; 768–1179: rail de ícones 64px
