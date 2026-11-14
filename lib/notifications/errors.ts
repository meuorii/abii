export class NotificationInputError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "NotificationInputError";
  }
}
