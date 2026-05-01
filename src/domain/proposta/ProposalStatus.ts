export const ProposalStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  UNDER_ANALYSIS: "UNDER_ANALYSIS",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  COUNTER_PROPOSAL: "COUNTER_PROPOSAL",
} as const;

export type ProposalStatus =
  (typeof ProposalStatus)[keyof typeof ProposalStatus];
