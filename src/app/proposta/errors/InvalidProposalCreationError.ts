export class InvalidProposalCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProposalCreationError";
  }
}
