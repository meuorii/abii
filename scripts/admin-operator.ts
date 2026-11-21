import { createInterface } from "node:readline/promises";
import { createRequire } from "node:module";
import { Writable } from "node:stream";
import mongoose from "mongoose";
import type ConnectionStringParser from "mongodb-connection-string-url" with { "resolution-mode": "require" };
import bcrypt from "bcryptjs";
import { User } from "@/models/User";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { confirmEnrollment, replaceAdminFactor, restartPendingEnrollment } from "@/lib/auth/admin-factor";
import { verifyOperatorDependencies, verifyOperatorIndexes, provisionAdmin, validateOperatorPassword } from "@/lib/auth/admin-operator";
import { normalizeEmail } from "@/lib/auth/validation";

// The package ships declarations for its CommonJS export.
const { default: ConnectionString }: { default: typeof ConnectionStringParser } =
  createRequire(import.meta.url)("mongodb-connection-string-url");

async function run() {
  const [action, ...extra] = process.argv.slice(2);
  const allowed = ["verify", "prepare", "provision", "resume", "rotate", "recover"];
  if (extra.length || !allowed.includes(action) || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw Error("Run one operator action interactively on a private terminal.");
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw Error("Database configuration missing.");
  let silent = false;
  const output = new Writable({ write(chunk, _, done) { if (!silent) process.stdout.write(chunk); done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const hidden = async (label: string) => {
    process.stdout.write(label);
    silent = true;
    try { return await rl.question(""); }
    finally { silent = false; process.stdout.write("\n"); }
  };
  try {
    const approvedHosts = await rl.question("Approved MongoDB host list (include configured ports, comma-separated): ");
    const hostList = (hosts: string[]) => hosts.map(host => host.trim().toLowerCase()).sort().join(",");
    if (hostList(new ConnectionString(uri).hosts) !== hostList(approvedHosts.split(","))) {
      throw Error("Unexpected hosts.");
    }
    const database = await rl.question("Expected application database: ");
    const replicaSet = await rl.question("Expected replica set name: ");
    const target = { database, replicaSet };
    if (await rl.question(`Type '${action} ${replicaSet}/${database}' to confirm: `) !== `${action} ${replicaSet}/${database}`) return;
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    await verifyOperatorIndexes(target, action === "prepare");
    if (action !== "prepare") await verifyOperatorDependencies();
    if (action === "prepare" || action === "verify") {
      process.stdout.write("Verified expected identity indexes.\n");
      return;
    }
    if (await rl.question("Type VERIFIED after independent operator approval and mailbox verification: ") !== "VERIFIED") return;
    const email = normalizeEmail(await hidden("Private administrator email: "));
    let enrollment: { seed: string; proof: string } | null;
    let userId: string;
    if (action === "provision") {
      const password = await hidden("New administrator password: ");
      if (password !== await hidden("Repeat password: ")) throw Error("Confirmation mismatch.");
      const result = await provisionAdmin(target, email, password);
      if (result.status === "already-provisioned") {
        process.stdout.write("Already provisioned. Credentials preserved.\n");
        return;
      }
      userId = result.userId;
      enrollment = result;
    } else {
      if (!await checkAuthRateLimit("admin-operator", "single-admin", 8, 15 * 60_000)) throw Error("Rate limited.");
      const admin = await User.findOne({ email, role: "admin", suspendedAt: null, emailVerifiedAt: { $type: "date" } }).select("+passwordHash sessionVersion");
      if (!admin) throw Error("Verification failed.");
      userId = String(admin._id);
      if (action === "recover") {
        const recoveryCode = await hidden("One unused offline recovery code: ");
        const password = await hidden("Replacement password: ");
        validateOperatorPassword(password);
        if (password !== await hidden("Repeat replacement password: ")) throw Error("Confirmation mismatch.");
        enrollment = await replaceAdminFactor(userId, { recoveryCode }, admin.sessionVersion, await bcrypt.hash(password, 12));
      } else {
        if (!await bcrypt.compare(await hidden("Current administrator password: "), admin.passwordHash)) throw Error("Verification failed.");
        enrollment = action === "resume" ? await restartPendingEnrollment(userId, admin.sessionVersion) :
          await replaceAdminFactor(userId, { totp: await hidden("Current factor code: ") }, admin.sessionVersion);
      }
    }
    if (!enrollment) throw Error("Operation unavailable.");
    process.stdout.write(`Enter this setup key into the administrator authenticator (TOTP, 6 digits, SHA-1, 30 seconds):\n${enrollment.seed}\n`);
    const codes = await confirmEnrollment(userId, enrollment.proof, await hidden("Authenticator confirmation code: "));
    if (!codes) throw Error("Enrollment confirmation failed.");
    process.stdout.write(`Save these single-use codes in offline custody now:\n${codes.join("\n")}\n`);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}
run().catch(() => {
  process.stderr.write("Operation stopped. Check target, approval, indexes, configuration and credential state.\n");
  process.exitCode = 1;
});


