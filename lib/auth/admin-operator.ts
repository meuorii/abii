import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { mongo } from "mongoose";
import { Admin } from "@/models/Admin";
import { User } from "@/models/User";
import { AuthRateLimit } from "@/models/AuthRateLimit";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { validateAdminMfaKeyring } from "./admin-factor-crypto";
import { verifyOperatorTopology, type OperatorTarget } from "./admin-operator-topology";

export type { OperatorTarget } from "./admin-operator-topology";
export class OperatorPrerequisiteError extends Error {}

function indexReady(index: mongo.IndexDescriptionInfo) {
  return !index.buildUUID && !index.hidden && !index.sparse && !index.partialFilterExpression && !index.prepareUnique &&
    (!index.collation || index.collation.locale === "simple");
}

async function collectionIndexes(db: mongo.Db, name: string, optional = false) {
  const spec = await db.listCollections({ name }, { nameOnly: false }).next();
  if (!spec && optional) return null;
  if (!spec || spec.type !== "collection" || spec.options?.collation && spec.options.collation.locale !== "simple") {
    throw new OperatorPrerequisiteError(`Expected existing standard collection ${name} with simple collation. Obtain separate approval for any missing security storage.`);
  }
  return db.collection(name).indexes();
}

export async function verifyOperatorStorage(target: OperatorTarget) {
  const db = await verifyOperatorTopology(target);
  const users = await collectionIndexes(db, User.collection.name);
  if (!users?.some(index => indexReady(index) && index.unique && isDeepStrictEqual(index.key, { email: 1 }))) {
    throw new OperatorPrerequisiteError("Verified unique users email index required.");
  }

  const admins = await collectionIndexes(db, Admin.collection.name, true);
  // MongoDB's ordinary _id index is intrinsically unique even when its metadata omits unique:true.
  if (admins && !admins.some(index => indexReady(index) && index.name === "_id_" && isDeepStrictEqual(index.key, { _id: 1 }))) {
    throw new OperatorPrerequisiteError("The admins collection must have its standard _id index.");
  }

  for (const model of [AuthRateLimit, AdminAuditLog, AdminSecurityEvent]) {
    const indexes = await collectionIndexes(db, model.collection.name);
    for (const [key, options] of model.schema.indexes()) {
      if (!indexes?.some(index => indexReady(index) && isDeepStrictEqual(Object.entries(index.key), Object.entries(key)) &&
          Boolean(index.unique) === Boolean(options.unique) && index.expireAfterSeconds === options.expireAfterSeconds)) {
        throw new OperatorPrerequisiteError(`Required security index missing or incompatible in ${model.collection.name}. Obtain separate approval to prepare existing security storage.`);
      }
    }
  }
}

export function validateOperatorConfiguration() {
  try { validateAdminMfaKeyring(); }
  catch { throw new OperatorPrerequisiteError("Configure a valid administrator MFA keyring."); }
  if ((process.env.AUTH_SECRET?.length ?? 0) < 32 || (process.env.AUTH_OTP_SECRET?.length ?? 0) < 32) {
    throw new OperatorPrerequisiteError("Configure AUTH_SECRET and AUTH_OTP_SECRET with at least 32 characters each.");
  }
}

export function validateOperatorPassword(password: string) {
  if (password.length < 16 || Buffer.byteLength(password, "utf8") > 72 || password.includes("\0")) {
    throw new OperatorPrerequisiteError("Use a strong password of at least 16 characters and at most 72 UTF-8 bytes.");
  }
}
