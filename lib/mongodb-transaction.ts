import "server-only";
import mongoose, { type ClientSession } from "mongoose";

export class TransactionUnavailableError extends Error {
  constructor() {
    super("This operation requires a MongoDB replica set or sharded deployment with transactions. No changes were saved.");
    this.name = "TransactionUnavailableError";
  }
}

export async function withRequiredTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    try {
      result = await session.withTransaction(() => operation(session), {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }) as T;
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && (error.code === 20 || error.code === 303)) {
        throw new TransactionUnavailableError();
      }
      throw error;
    }
    return result;
  } finally {
    await session.endSession();
  }
}
