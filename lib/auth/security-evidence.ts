import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after } from "next/server.js";
import mongoose from "mongoose";
import { isAccountId, isScope, eventRetentionDays, type EventKind, type Scope } from "@/lib/admin/security-contract";

type Counter = Exclude<EventKind, "learner-login" | "email-login" | "password-reset" | "password-change" | "rate-limited">;
type Verified = "learner-login" | "email-login" | "password-reset" | "password-change";
export type Observation =
  | { kind: Counter; verifiedAccess?: boolean }
  | { kind: "rate-limited"; scope: Scope }
  | { kind: Verified; learnerId: string; operation?: string };

type Evidence = {
  _id: string; kind: EventKind; occurredAt: Date; lastAt: Date; count?: number;
  actorId?: string; verifiedAccess?: true; scope?: Scope; format: 2;
};

export function securityCollectionEnabled() {
  return process.env.ABII_SECURITY_EVENTS_ENABLED === "true";
}

let client: InstanceType<typeof mongoose.mongo.MongoClient> | undefined;
export function securityDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Security storage unavailable");
  client ??= new mongoose.mongo.MongoClient(uri, { maxPoolSize: 3, maxConnecting: 1,
    connectTimeoutMS: 1000, serverSelectionTimeoutMS: 1000, timeoutMS: 1700, retryWrites: true, writeConcern: { w: "majority" } });
  return client.db();
}

let storageCheck: { result: Promise<void>; until: number } | undefined;
function requireEventStorage() {
  if (storageCheck && storageCheck.until > Date.now()) return storageCheck.result;
  const result = Promise.resolve().then(async () => {
    const indexes = await securityDatabase().collection("adminsecurityevents").listIndexes().toArray();
    if (!indexes.some(index => index.key.occurredAt === 1 && Object.keys(index.key).length === 1 &&
      index.expireAfterSeconds === eventRetentionDays * 86400 && !index.partialFilterExpression && !index.sparse)) {
      throw new Error("Security event retention index unavailable");
    }
  }).catch((error: unknown) => {
    storageCheck = { result, until: Date.now() + 30_000 };
    throw error;
  });
  storageCheck = { result, until: Date.now() + 300_000 };
  return result;
}

export function securityEvidence(event: Observation, now: Date): Evidence | null {
  const { kind } = event;
  if ("learnerId" in event) {
    if (!isAccountId(event.learnerId)) return null;
    const id = event.operation
      ? createHash("sha256").update(JSON.stringify([kind, event.learnerId, event.operation])).digest("hex").slice(0, 32)
      : randomUUID().replaceAll("-", "");
    return { _id: id, kind, actorId: event.learnerId, occurredAt: now, lastAt: now, format: 2 };
  }

  const scope = "scope" in event && isScope(event.scope) ? event.scope : undefined;
  if (kind === "rate-limited" && !scope) return null;
  const verifiedAccess = kind === "access-denied" && event.verifiedAccess === true;
  const minute = Math.floor(+now / 60_000);
  return { _id: `v2/${kind}/${scope ?? (verifiedAccess ? "verified" : "all")}/${minute}`, kind,
    occurredAt: new Date(minute * 60_000), lastAt: now, count: 1, format: 2,
    ...(scope ? { scope } : {}), ...(verifiedAccess ? { verifiedAccess: true } : {}) };
}

export async function persistSecurityEvidence(rows: Evidence[]) {
  await requireEventStorage();
  const groups = new Map<string, Evidence>();
  for (const row of rows) {
    const earlier = groups.get(row._id);
    if (earlier && row.count) {
      earlier.count = (earlier.count ?? 0) + row.count;
      if (row.lastAt > earlier.lastAt) earlier.lastAt = row.lastAt;
    } else if (!earlier) groups.set(row._id, { ...row });
  }
  if (groups.size === 0) return;
  await securityDatabase().collection<Evidence>("adminsecurityevents").bulkWrite(
    [...groups.values()].map(({ _id, count, lastAt, ...fields }) => ({
      updateOne: {
        filter: { _id }, upsert: true,
        update: count === undefined ? { $setOnInsert: { ...fields, lastAt } }
          : { $setOnInsert: fields, $inc: { count }, $max: { lastAt } },
      },
    })), { ordered: false });
}

let lastDrop = 0;
function dropped() {
  if (Date.now() - lastDrop < 60_000) return;
  lastDrop = Date.now();
  try { console.warn("abii.security.evidence_incomplete"); } catch { /* Optional diagnostics. */ }
}

type Batch = { rows: Evidence[]; done: Promise<void> };
let open: Batch | undefined;
let flushing = 0;
function enqueue(row: Evidence) {
  if (open && open.rows.length < 64) {
    open.rows.push(row);
    return open.done;
  }
  if (flushing >= 2) return dropped();
  flushing++;
  const rows = [row];
  const done = delay(125).then(async () => {
    if (open?.rows === rows) open = undefined;
    await persistSecurityEvidence(rows);
  }).catch(dropped).finally(() => { flushing--; });
  open = { rows, done };
  return done;
}

/** Best-effort evidence from decisions already made by the authentication code. */
export function observeSecurity(event: Observation) {
  if (!securityCollectionEnabled()) return;
  try {
    const row = securityEvidence(event, new Date());
    if (!row) return;
    try { after(() => enqueue(row)); }
    catch { void enqueue(row); } // Operator commands have no HTTP lifecycle.
  } catch { dropped(); }
}
