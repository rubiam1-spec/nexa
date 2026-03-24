export class InvalidReservationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReservationRequestError";
  }
}
