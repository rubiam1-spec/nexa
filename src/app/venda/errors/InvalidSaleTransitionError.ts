export class InvalidSaleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSaleTransitionError";
  }
}
