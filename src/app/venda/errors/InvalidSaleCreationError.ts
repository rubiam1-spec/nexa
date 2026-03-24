export class InvalidSaleCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSaleCreationError";
  }
}
