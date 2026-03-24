import type { Brokerage } from "../../../shared/types/brokerage";

export const brokeragesMock: Brokerage[] = [
  {
    id: "brokerage_1",
    name: "Horizonte Imoveis",
    email: "contato@horizonteimoveis.com",
    phone: "(11) 3333-4401",
    city: "Sao Paulo",
    status: "active",
  },
  {
    id: "brokerage_2",
    name: "Atlantica Brokers",
    email: "atendimento@atlanticabrokers.com",
    phone: "(21) 3222-1800",
    city: "Rio de Janeiro",
    status: "active",
  },
  {
    id: "brokerage_3",
    name: "Sul House Negocios",
    email: "relacionamento@sulhouse.com",
    phone: "(41) 3344-8810",
    city: "Curitiba",
    status: "inactive",
  },
  {
    id: "brokerage_4",
    name: "Minas Prime Imoveis",
    email: "comercial@minasprime.com",
    phone: "(31) 3555-9900",
    city: "Belo Horizonte",
    status: "active",
  },
  {
    id: "brokerage_5",
    name: "Bahia Select",
    email: "contato@bahiaselect.com",
    phone: "(71) 3444-7070",
    city: "Salvador",
    status: "inactive",
  },
];
