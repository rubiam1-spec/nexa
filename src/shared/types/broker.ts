export type Broker = {
  id: string;
  name: string;
  email: string;
  phone: string;
  brokerageId: string | null;
  brokerageName: string;
  city: string;
  status: "active" | "inactive";
  hasSystemAccess: boolean;
  profileId: string | null;
  createdBy: string | null;
  approvalStatus: "approved" | "pending_approval";
};
