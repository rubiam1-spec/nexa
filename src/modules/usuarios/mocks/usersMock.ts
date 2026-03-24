import type { AccountUser } from "../../../shared/types/accountUser";

export const usersMock: AccountUser[] = [
  {
    id: "account_user_1",
    fullName: "Ana Souza",
    email: "ana@nexa.local",
    role: "director",
    status: "active",
  },
  {
    id: "account_user_2",
    fullName: "Carlos Menezes",
    email: "carlos@nexa.local",
    role: "manager",
    status: "active",
  },
  {
    id: "account_user_3",
    fullName: "Julia Castro",
    email: "julia@nexa.local",
    role: "commercial_consultant",
    status: "active",
  },
  {
    id: "account_user_4",
    fullName: "Marcos Lima",
    email: "marcos@nexa.local",
    role: "broker",
    status: "inactive",
  },
  {
    id: "account_user_5",
    fullName: "Paula Fernandes",
    email: "paula@nexa.local",
    role: "administrative",
    status: "active",
  },
];
