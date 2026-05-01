export type NavigationItem = {
  key:
    | "meudia"
    | "notificacoes"
    | "simulador"
    | "contatos"
    | "negociacoes"
    | "pipeline"
    | "unidades"
    | "imoveis"
    | "empreendimentos"
    | "corretores"
    | "imobiliarias"
    | "atividades"
    | "feed"
    | "relatorios"
    | "materiais"
    | "usuarios"
    | "configuracoes"
    | "relacionamento";
  label: string;
  path: string;
};

export const navigationConfig: NavigationItem[] = [
  {
    key: "meudia",
    label: "Central",
    path: "/",
  },
  {
    key: "notificacoes",
    label: "Notificações",
    path: "/notificacoes",
  },
  {
    key: "simulador",
    label: "Simulador",
    path: "/simulador",
  },
  {
    key: "contatos",
    label: "Contatos",
    path: "/contatos",
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
  {
    key: "relacionamento",
    label: "Relacionamento",
    path: "/relacionamento",
  },
];
