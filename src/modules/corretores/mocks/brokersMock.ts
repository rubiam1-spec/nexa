import type { Broker } from "../../../shared/types/broker";

export const brokersMock: Broker[] = [
  {
    id: "broker_1",
    name: "Juliana Mendes",
    email: "juliana.mendes@email.com",
    phone: "(11) 99771-2301",
    brokerageName: "Horizonte Imoveis",
    city: "Sao Paulo",
    status: "active",
  },
  {
    id: "broker_2",
    name: "Thiago Ribeiro",
    email: "thiago.ribeiro@email.com",
    phone: "(21) 98842-5510",
    brokerageName: "Atlantica Negocios",
    city: "Rio de Janeiro",
    status: "inactive",
  },
  {
    id: "broker_3",
    name: "Patricia Gomes",
    email: "patricia.gomes@email.com",
    phone: "(31) 99412-7632",
    brokerageName: "Minas House",
    city: "Belo Horizonte",
    status: "active",
  },
  {
    id: "broker_4",
    name: "Bruno Cardoso",
    email: "bruno.cardoso@email.com",
    phone: "(41) 99100-8876",
    brokerageName: "Sul Brokers",
    city: "Curitiba",
    status: "active",
  },
  {
    id: "broker_5",
    name: "Larissa Teixeira",
    email: "larissa.teixeira@email.com",
    phone: "(71) 99666-4408",
    brokerageName: "Bahia Select",
    city: "Salvador",
    status: "inactive",
  },
];
