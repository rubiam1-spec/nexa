export class InvalidUnitQueueEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUnitQueueEntryError";
  }
}
