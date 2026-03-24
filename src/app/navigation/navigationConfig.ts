export type NavigationItem = {
  key:
    | "dashboard"
    | "simulador"
    | "negociacoes"
    | "unidades"
    | "empreendimentos"
    | "clientes"
    | "corretores"
    | "imobiliarias"
    | "usuarios"
    | "configuracoes";
  label: string;
  path: string;
};

export const navigationConfig: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/",
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
