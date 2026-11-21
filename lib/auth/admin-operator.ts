import "server-only";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { SINGLE_ADMIN_INDEX, User } from "@/models/User";
import { AuthRateLimit } from "@/models/AuthRateLimit";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { AdminFactor } from "@/models/AdminFactor";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { auditAdmin } from "@/lib/auth/admin-audit";
import { prepareEnrollment, installPendingEnrollment } from "@/lib/auth/admin-factor";
import { validateRegistration } from "@/lib/auth/validation";
import { isSingleAdminIndex, oneKey } from "./admin-index";

export type OperatorTarget = { database: string; replicaSet: string };

/** Require an existing application database. Refuse mongos, standalones and direct shard connections. */
export async function verifyOperatorIndexes(target: OperatorTarget, prepare = false): Promise<void> {
  const db = mongoose.connection.db;
  if (!db || !target.database || db.databaseName !== target.database ||
      ["admin", "config", "local", "test"].includes(db.databaseName)) throw Error("Unexpected database.");
  const hello = await db.admin().command({ hello: 1 });
  if (!target.replicaSet || hello.setName !== target.replicaSet || !hello.isWritablePrimary ||
      hello.msg === "isdbgrid" || hello.configsvr || hello.isreplicaset) throw Error("Unsupported deployment topology.");
  // A direct shard connection also answers hello as a replica set. Require positive confirmation.
  const options = await db.admin().command({ getCmdLineOpts: 1 });
  if (!options.parsed || options.parsed.sharding?.clusterRole ||
      options.argv?.some((arg: string) => ["--shardsvr", "--configsvr"].includes(arg))) throw Error("Unsupported deployment topology.");
  const users = db.collection(User.collection.name, { writeConcern: { w: "majority" } });
  const spec = await db.listCollections({ name: users.collectionName }, { nameOnly: false }).next();
  if (!spec || spec.type !== "collection" || spec.options?.collation && spec.options.collation.locale !== "simple") {
    throw Error("Expected existing users collection with simple collation.");
  }
  const invalid = await users.findOne({ $expr: { $not: [{ $or: [
    { $eq: [{ $type: "$role" }, "missing"] },
    { $in: ["$role", ["user", "admin"]] },
  ] }] } }, { projection: { _id: 1 } });
  if (invalid || await users.countDocuments({ role: "admin" }, { limit: 2 }) > 1) throw Error("Review existing role data.");
  const indexes = await users.indexes();
  const emailIndex = indexes.find(i => oneKey(i.key, "email", 1) && i.unique && !i.partialFilterExpression &&
    !i.sparse && !i.buildUUID && (!i.collation || i.collation.locale === "simple"));
  if (!emailIndex) throw Error("Verified unique email index required.");
  const candidates = indexes.filter(i => oneKey(i.key, "role", 1) || i.name === SINGLE_ADMIN_INDEX);
  if (prepare && !candidates.length) {
    await users.createIndex({ role: 1 }, {
      name: SINGLE_ADMIN_INDEX, unique: true, partialFilterExpression: { role: "admin" },
      collation: { locale: "simple" }, commitQuorum: "votingMembers",
    });
    return verifyOperatorIndexes(target);
  }
  if (candidates.length !== 1 || !isSingleAdminIndex(candidates[0])) {
    throw Error("Missing or mismatched single-admin index.");
  }
  // An in-progress or unusable index cannot satisfy an explicit hint.
  await users.find({ role: "admin" }).hint(SINGLE_ADMIN_INDEX).limit(1).project({ _id: 1 }).toArray();
}

/** Preflight the infrastructure used by enrollment, rate limiting and audited transactions. */
export async function verifyOperatorDependencies() {
  const db = mongoose.connection.db;
  if (!db) throw Error("No operator connection.");
  const indexes = await db.collection(AuthRateLimit.collection.name).indexes();
  const ready = (i: (typeof indexes)[number]) => !i.buildUUID && !i.hidden && !i.sparse && !i.partialFilterExpression;
  if (!indexes.some(i => ready(i) && i.unique && JSON.stringify(i.key) === '{"key":1,"window":1}') ||
      !indexes.some(i => ready(i) && oneKey(i.key, "expiresAt", 1) && i.expireAfterSeconds === 0)) {
    throw Error("Rate limiter indexes missing.");
  }
  for (const [collection, retention] of [[AdminAuditLog.collection.name, 365], [AdminSecurityEvent.collection.name, 90]] as const) {
    const defined = await db.collection(collection).indexes();
    if (!defined.some(i => ready(i) && oneKey(i.key, "occurredAt", 1) && i.expireAfterSeconds === retention * 86400)) {
      throw Error("Audit retention index missing.");
    }
  }
  if (!await db.listCollections({ name: AdminFactor.collection.name, type: "collection" }).hasNext()) {
    throw Error("Factor store missing.");
  }
}

export function validateOperatorPassword(password: string) {
  if (password.length < 16 || Buffer.byteLength(password, "utf8") > 72 || password.includes("\0")) {
    throw Error("Use a strong password of at least 16 characters and at most 72 UTF-8 bytes.");
  }
}

export async function provisionAdmin(target: OperatorTarget, emailInput: string, password: string) {
  await verifyOperatorIndexes(target);
  await verifyOperatorDependencies();
  const { values, errors } = validateRegistration({ email: emailInput, name: "Administrator", password });
  if (errors.email) throw Error("Invalid email.");
  const existing = await User.findOne({ role: "admin" }).select("email").lean();
  if (existing) {
    if (existing.email !== values.email) throw Error("Administrator conflict.");
    return { status: "already-provisioned" } as const;
  }
  validateOperatorPassword(password);
  if (await User.exists({ email: values.email }).collation({ locale: "en", strength: 2 })) throw Error("Existing identity conflict.");
  const userId = new mongoose.Types.ObjectId();
  const enrollment = prepareEnrollment(String(userId));
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await withRequiredTransaction(async session => {
      await User.create([{ _id: userId, name: values.name, email: values.email, passwordHash, role: "admin", emailVerifiedAt: new Date() }], { session });
      await installPendingEnrollment(String(userId), enrollment, session);
      await auditAdmin("provision", String(userId), String(userId), session);
    });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000 &&
        await User.exists({ role: "admin", email: values.email })) return { status: "already-provisioned" } as const;
    throw error;
  }
  return { status: "created", userId: String(userId), seed: enrollment.seed, proof: enrollment.proof } as const;
}



