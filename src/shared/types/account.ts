import type { UserRole } from "./auth";

export type AccountContextData = {
  accountId: string;
  accountName: string;
  slug: string;
  role: UserRole | null;
};
