export type NavigationItem = {
  key:
    | "meudia"
    | "dashboard"
    | "simulador"
    | "negociacoes"
    | "pipeline"
    | "unidades"
    | "empreendimentos"
    | "clientes"
    | "corretores"
    | "imobiliarias"
    | "atividades"
    | "feed"
    | "relatorios"
    | "materiais"
    | "usuarios"
    | "configuracoes";
  label: string;
  path: string;
};

export const navigationConfig: NavigationItem[] = [
  {
    key: "meudia",
    label: "Meu Dia",
    path: "/",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
  },
  {
    key: "simulador",
    label: "Simulador",
    path: "/simulador",
  },
  {
    key: "negociacoes",
    label: "Negociações",
    path: "/negociacoes",
  },
  {
    key: "pipeline",
    label: "Pipeline",
    path: "/pipeline",
  },
  {
    key: "unidades",
    label: "Unidades",
    path: "/unidades",
  },
  {
    key: "empreendimentos",
    label: "Empreendimentos",
    path: "/empreendimentos",
  },
  {
    key: "clientes",
    label: "Clientes",
    path: "/clientes",
  },
  {
    key: "corretores",
    label: "Corretores",
    path: "/corretores",
  },
  {
    key: "imobiliarias",
    label: "Imobiliárias",
    path: "/imobiliarias",
  },
  {
    key: "atividades",
    label: "Atividades",
    path: "/atividades",
  },
  {
    key: "feed",
    label: "Mural",
    path: "/feed",
  },
  {
    key: "relatorios",
    label: "Relatórios",
    path: "/relatorios",
  },
  {
    key: "materiais",
    label: "Materiais",
    path: "/materiais",
  },
  {
    key: "usuarios",
    label: "Usuários",
    path: "/usuarios",
  },
  {
    key: "configuracoes",
    label: "Configurações",
    path: "/configuracoes",
  },
];
