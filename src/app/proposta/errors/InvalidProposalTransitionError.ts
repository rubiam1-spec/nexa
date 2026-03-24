export class InvalidProposalTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProposalTransitionError";
  }
}
