export type UserRole =
  | "director"
  | "manager"
  | "commercial_consultant"
  | "broker"
  | "administrative"
  | "concierge";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
};

export type AuthenticatedProfile = {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  role: UserRole | null;
  avatarUrl: string | null;
  phone: string | null;
};
