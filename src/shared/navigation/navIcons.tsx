// Ícones de navegação — fonte ÚNICA consumida pelo AppSidebar (desktop) e pela
// tab bar/sheet mobile. Chaveados pela `icone` semântica do navRegistry.
// stroke=currentColor: a cor é herdada do container (ativo/inativo).
import type { ReactElement } from "react";

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const NAV_ICONS: Record<string, (size: number) => ReactElement> = {
  meudia: (s) => (<svg {...base(s)}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
  simulador: (s) => (<svg {...base(s)}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>),
  unidades: (s) => (<svg {...base(s)}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>),
  imoveis: (s) => (<svg {...base(s)}><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><rect x="9" y="10" width="2" height="2" /><rect x="9" y="14" width="2" height="2" /></svg>),
  negociacoes: (s) => (<svg {...base(s)}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>),
  leads: (s) => (<svg {...base(s)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="1" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="23" /></svg>),
  contatos: (s) => (<svg {...base(s)}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>),
  corretores: (s) => (<svg {...base(s)}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>),
  imobiliarias: (s) => (<svg {...base(s)}><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>),
  atividades: (s) => (<svg {...base(s)}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
  feed: (s) => (<svg {...base(s)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>),
  relatorios: (s) => (<svg {...base(s)}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>),
  materiais: (s) => (<svg {...base(s)}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>),
  relacionamento: (s) => (<svg {...base(s)}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>),
  empreendimentos: (s) => (<svg {...base(s)}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>),
  usuarios: (s) => (<svg {...base(s)}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
  configuracoes: (s) => (<svg {...base(s)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83" /></svg>),
  // Aba fixa "Mais" (não é módulo do registry).
  mais: (s) => (<svg {...base(s)}><circle cx="5" cy="5" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="19" cy="5" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="19" r="1" /><circle cx="12" cy="19" r="1" /><circle cx="19" cy="19" r="1" /></svg>),
};
