export const ProposalStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  UNDER_ANALYSIS: "UNDER_ANALYSIS",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export type ProposalStatus =
  (typeof ProposalStatus)[keyof typeof ProposalStatus];
