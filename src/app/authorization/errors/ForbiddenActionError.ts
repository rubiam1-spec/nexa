export class ForbiddenActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenActionError";
  }
}
