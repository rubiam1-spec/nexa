export type DevelopmentContextData = {
  developmentId: string;
  accountId: string;
  developmentName: string;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  status: "active" | "inactive";
};
