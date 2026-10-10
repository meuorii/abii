import "server-only";
import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached = (global.mongooseCache ??= { conn: null, promise: null });

/**
 * Connect to MongoDB once and reuse the connection across requests and
 * Next.js development hot reloads. Import this helper from server code only.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it to your local .env.local file before using database features.",
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Clear the failed promise so a later request can retry the connection.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
