export class InvalidReservationTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReservationTransitionError";
  }
}
