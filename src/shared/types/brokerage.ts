export type Brokerage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  cnpj: string | null;
  creci: string | null;
  responsavel: string | null;
  status: "active" | "inactive";
};
