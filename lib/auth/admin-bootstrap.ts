import "server-only";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
import type ConnectionStringParser from "mongodb-connection-string-url" with { "resolution-mode": "require" };
import mongoose from "mongoose";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { TransactionUnavailableError, withRequiredTransaction } from "@/lib/mongodb-transaction";
import { AdminAuditStorageError, auditAdmin } from "./admin-audit";
import { AdminFactorRateLimitError, confirmEnrollment, pendingFactor, replaceAdminFactor, restartPendingEnrollment, type EnrollmentRestartStage } from "./admin-factor";
import { prepareEnrollment } from "./admin-factor-crypto";
import { AdminIntegrityError, assertNoLegacyAdmin, ordinaryEmailExists, readAdmin } from "./admin-identity";
import { OperatorPrerequisiteError, validateOperatorConfiguration, validateOperatorPassword, verifyOperatorStorage, type OperatorTarget } from "./admin-operator";
import { atlasIdentityCheck } from "./admin-operator-topology";
import { checkAuthRateLimit } from "./rate-limit";
import { validateRegistration } from "./validation";

const { default: ConnectionString }: { default: typeof ConnectionStringParser } =
  createRequire(import.meta.url)("mongodb-connection-string-url");

export const bootstrapTarget = { database: "abii", replicaSet: "atlas-v6lmhk-shard-0" } as const;

export class BootstrapStop extends Error {}

const atlasHost = /^(?:[a-z0-9][a-z0-9-]*\.)+mongodb\.net(?::27017)?$/;

export type AtlasBootstrapTarget = typeof bootstrapTarget & { atlas: NonNullable<OperatorTarget["atlas"]> };

export function approvedAtlasTarget(clusterType: string | undefined, inventoryMembers: string | undefined): AtlasBootstrapTarget {
  const members = inventoryMembers?.split(",").map(host => host.trim().toLowerCase()) ?? [];
  if (clusterType !== "REPLICASET" || !members.length || new Set(members).size !== members.length ||
      members.some(host => !atlasHost.test(host) || !host.endsWith(":27017"))) {
    throw new BootstrapStop("Supply the independently approved Atlas REPLICASET inventory and its complete member endpoints.");
  }
  return { ...bootstrapTarget, atlas: { clusterType, members, checkServerIdentity: atlasIdentityCheck(members) } };
}

export function validateBootstrapUri(uri: string | undefined, approvedHosts: string | undefined, target: AtlasBootstrapTarget) {
  if (!uri || !approvedHosts) throw new BootstrapStop("Configure MONGODB_URI in .env.local and approved seed hosts in .env.admin-inventory.local.");
  let connection: ConnectionStringParser;
  try { connection = new ConnectionString(uri); }
  catch { throw new BootstrapStop("MONGODB_URI is invalid. Check the Atlas connection configuration."); }
  if (connection.pathname !== `/${bootstrapTarget.database}`) throw new BootstrapStop("MONGODB_URI must select the abii database.");
  const approved = approvedHosts.split(",").map(host => host.trim().toLowerCase()).sort();
  const actual = connection.hosts.map(host => host.toLowerCase()).sort();
  if (!actual.every(host => atlasHost.test(host)) || new Set(actual).size !== actual.length ||
      approved.length !== actual.length || approved.some((host, index) => host !== actual[index]) ||
      (!connection.isSRV && actual.some(host => !target.atlas.members.includes(
        host.endsWith(":27017") ? host : `${host}:27017`,
      )))) {
    throw new BootstrapStop("Atlas seed hosts do not match the approved deployment inventory.");
  }
  for (const [name, value] of connection.searchParams) {
    const option = name.toLowerCase();
    const flag = value.toLowerCase();
    if ((option === "replicaset" && value !== bootstrapTarget.replicaSet) ||
        (["tls", "ssl"].includes(option) && flag !== "true") ||
        (["directconnection", "loadbalanced"].includes(option) && flag !== "false") ||
        (option.startsWith("tls") && option !== "tls") ||
        option.startsWith("proxy") || ["srvservicename", "srvmaxhosts", "dbname", "checkserveridentity", "rejectunauthorized",
          "ca", "crl", "cert", "key", "pfx", "servername", "securecontext"].includes(option)) {
      throw new BootstrapStop("Use the approved Atlas replica-set URI with normal TLS validation.");
    }
  }
  return uri;
}

export type SetupAction = "setup" | "rotate" | "recover";
export type SetupStage = EnrollmentRestartStage | "configuration" | "preflight" | "authorization" |
  "post-authorization preflight" | "operator rate limit" | "credential verification" |
  "administrator creation" | "factor recovery" | "factor rotation" | "enrollment confirmation";

export type BootstrapTerminal = {
  onStage?: (stage: SetupStage) => void;
  describe: (status: "absent" | "pending" | "active" | "suspended") => void;
  name: () => Promise<string>;
  email: () => Promise<string>;
  password: (existing: boolean) => Promise<string>;
  confirmPassword: () => Promise<string>;
  recoveryCode: () => Promise<string>;
  authorizeWrite: () => Promise<boolean>;
  showSetupKey: (key: string, email: string) => void;
  code: () => Promise<string>;
  showRecoveryCodes: (codes: readonly string[]) => void;
};

const pending = "Administrator MFA enrollment is pending. After the ten-minute enrollment window expires, rerun admin:setup with the same email and password.";

async function createPendingAdmin(values: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(values.password, 12);
  const enrollment = prepareEnrollment(ADMIN_SUBJECT);
  try {
    return await withRequiredTransaction(async session => {
      await assertNoLegacyAdmin(session);
      if (await readAdmin(session)) throw new BootstrapStop("Another operator has claimed the administrator slot. Rerun admin:setup to check its state.");
      if (await ordinaryEmailExists(values.email, session)) throw new BootstrapStop("Use a dedicated email address that does not exist in abii.users.");
      await Admin.create([{
        _id: ADMIN_ID, name: values.name, email: values.email, passwordHash,
        status: "pending", sessionVersion: 0, mfa: pendingFactor(enrollment),
      }], { session });
      await auditAdmin("provision", ADMIN_SUBJECT, ADMIN_SUBJECT, session);
      return enrollment;
    });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000 && await readAdmin()) {
      throw new BootstrapStop("Another operator has claimed the administrator slot. Rerun admin:setup to check its state.");
    }
    throw error;
  }
}

export async function bootstrapAdmin(target: OperatorTarget, terminal: BootstrapTerminal, action: SetupAction = "setup") {
  const { onStage } = terminal;
  onStage?.("preflight");
  await verifyOperatorStorage(target);
  validateOperatorConfiguration();
  await assertNoLegacyAdmin();
  const account = await readAdmin(undefined, { allowUnreadableFactor: action === "recover" });
  terminal.describe(account?.status ?? "absent");

  if (account?.status === "suspended") throw new BootstrapStop("The administrator is suspended. Ask the database owner to review the account under a separately approved change.");
  if (action === "setup" && account?.status === "active") return "already-active";
  if (action !== "setup" && account?.status !== "active") throw new BootstrapStop("An active administrator is required. Use admin:setup to complete pending enrollment.");
  if (account?.status === "pending" && account.mfa.enrollmentExpiresAt! > new Date()) throw new BootstrapStop(pending);

  const { values, errors } = validateRegistration({
    name: account?.name ?? await terminal.name(), email: await terminal.email(), password: "",
  });
  if (errors.email || errors.name) throw new BootstrapStop("Enter a valid administrator name and email address.");
  if (account && account.email !== values.email) throw new BootstrapStop("Administrator credentials could not be verified.");
  if (await ordinaryEmailExists(values.email)) throw new BootstrapStop("Use a dedicated email address that does not exist in abii.users.");

  const existingPassword = !!account && action !== "recover";
  const password = await terminal.password(existingPassword);
  validateOperatorPassword(password);
  if (!existingPassword && password !== await terminal.confirmPassword()) throw new BootstrapStop("Passwords did not match.");
  onStage?.("authorization");
  if (!await terminal.authorizeWrite()) throw new BootstrapStop("Production write approval was not confirmed.");

  // Recheck the deployment and prerequisites after interactive approval and before any write.
  onStage?.("post-authorization preflight");
  await verifyOperatorStorage(target);
  await assertNoLegacyAdmin();
  let enrollment: { seed: string; proof: string } | null;
  if (!account) {
    onStage?.("administrator creation");
    enrollment = await createPendingAdmin({ ...values, password });
  } else {
    onStage?.("operator rate limit");
    if (!await checkAuthRateLimit("admin-operator", ADMIN_SUBJECT, 8, 15 * 60_000)) {
      throw new BootstrapStop("Too many operator attempts. Wait before retrying.");
    }
    onStage?.("credential verification");
    if (existingPassword && !await bcrypt.compare(password, account.passwordHash)) {
      throw new BootstrapStop("Administrator credentials could not be verified.");
    }
    if (action === "recover") {
      onStage?.("factor recovery");
      const recoveryCode = await terminal.recoveryCode();
      enrollment = await replaceAdminFactor({ recoveryCode }, account.sessionVersion, await bcrypt.hash(password, 12));
    } else if (action === "rotate") {
      onStage?.("factor rotation");
      enrollment = await replaceAdminFactor({ totp: (await terminal.code()).trim() }, account.sessionVersion);
    } else {
      enrollment = await restartPendingEnrollment(account.sessionVersion, onStage);
    }
  }
  if (!enrollment) throw new BootstrapStop("Credentials could not be verified or enrollment changed. Check its state with admin:setup.");

  onStage?.("enrollment confirmation");
  terminal.showSetupKey(enrollment.seed, values.email);
  let codes: string[] | null = null;
  try {
    for (let attempt = 0; attempt < 3 && !codes; attempt++) {
      codes = await confirmEnrollment(enrollment.proof, (await terminal.code()).trim());
    }
  } catch (error) {
    if (error instanceof AdminFactorRateLimitError) throw new BootstrapStop(pending);
    throw error;
  }
  if (!codes) throw new BootstrapStop(pending);
  terminal.showRecoveryCodes(codes);
  return account ? "resumed" : "created";
}

function setupErrorCategory(error: unknown) {
  if (error instanceof TransactionUnavailableError) return "database transactions unavailable";
  if (error instanceof AdminAuditStorageError) return "required audit collection missing or invalid";
  if (error instanceof AdminFactorRateLimitError) return "too many attempts";
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError ||
      error instanceof mongoose.Error.StrictModeError) return "Mongoose validation failed";
  if (error instanceof mongoose.mongo.MongoNetworkError || error instanceof mongoose.mongo.MongoServerSelectionError) {
    return "database connection failed";
  }
  if (error instanceof mongoose.mongo.MongoServerError) {
    switch (error.code) {
      case 13: return "database permission denied, MongoDB code 13";
      case 121: return "database document validation failed, MongoDB code 121";
      case 8000: return "Atlas rejected a database command, MongoDB code 8000";
      default: return typeof error.code === "number" && Number.isSafeInteger(error.code)
        ? `database command failed, MongoDB code ${error.code}` : "database command failed";
    }
  }
  if (error instanceof Error && error.name === "AbortError") return "terminal input interrupted";
  return "unexpected error";
}

export function safeSetupError(error: unknown, stage: SetupStage) {
  if (error instanceof BootstrapStop || error instanceof AdminIntegrityError || error instanceof OperatorPrerequisiteError) return error.message;
  if (error instanceof Error && ["Unexpected database.", "Unsupported deployment topology."].includes(error.message)) return error.message;
  return `Setup stopped during ${stage} (${setupErrorCategory(error)}). See docs/ADMIN_OPERATOR.md. Rerun admin:setup to check the account state.`;
}
