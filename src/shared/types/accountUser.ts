import type { UserRole } from "./auth";

export type AccountUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole | null;
  status: "active" | "inactive";
};
