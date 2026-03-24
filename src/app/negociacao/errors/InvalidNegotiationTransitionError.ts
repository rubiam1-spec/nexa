export class InvalidNegotiationTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNegotiationTransitionError";
  }
}
