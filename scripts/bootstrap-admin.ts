import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { rootCertificates } from "node:tls";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import mongoose from "mongoose";
import { BootstrapStop, approvedAtlasTarget, bootstrapAdmin, safeSetupError, validateBootstrapUri, type AtlasBootstrapTarget, type SetupStage } from "@/lib/auth/admin-bootstrap";

export async function readAtlasOperatorConfig(uri: string | undefined) {
  const file = await readFile(".env.admin-inventory.local", "utf8").catch(() => {
    throw new BootstrapStop("Load the independently approved Atlas inventory from .env.admin-inventory.local.");
  });
  const inventory = parseEnv(file);
  const target = approvedAtlasTarget(inventory.ABII_ADMIN_ATLAS_CLUSTER_TYPE, inventory.ABII_ADMIN_ATLAS_MEMBERS);
  return { target, uri: validateBootstrapUri(uri, inventory.ABII_ADMIN_BOOTSTRAP_HOSTS, target) };
}

export async function connectAtlasOperator(uri: string, target: AtlasBootstrapTarget) {
  await mongoose.connect(uri, {
    autoIndex: false, autoCreate: false, bufferCommands: false, serverSelectionTimeoutMS: 10000,
    replicaSet: target.replicaSet, readPreference: "primary", directConnection: false, tls: true,
    rejectUnauthorized: true, checkServerIdentity: target.atlas.checkServerIdentity, ca: [...rootCertificates],
    w: "majority",
  }).catch(() => { throw new BootstrapStop("Could not connect to the approved Atlas replica set. Check network access, TLS, and operator credentials."); });
}

async function run(onStage: (stage: SetupStage) => void) {
  const [input = "setup", ...extra] = process.argv.slice(2);
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY || extra.length ||
      (input !== "setup" && input !== "rotate" && input !== "recover")) {
    throw new BootstrapStop("Run admin:setup in a private interactive terminal with recording disabled.");
  }
  const file = await readFile(".env.local", "utf8").catch(() => {
    throw new BootstrapStop("Configure .env.local from the Abii repository root.");
  });
  const local = parseEnv(file);
  const { uri, target } = await readAtlasOperatorConfig(local.MONGODB_URI);
  let appUrl: URL;
  try { appUrl = new URL(local.APP_BASE_URL ?? ""); }
  catch { throw new BootstrapStop("Configure APP_BASE_URL with the trusted application origin."); }
  if ((appUrl.protocol !== "https:" && appUrl.origin !== "http://localhost:3000") ||
      appUrl.username || appUrl.password || appUrl.pathname !== "/" || appUrl.search || appUrl.hash) {
    throw new BootstrapStop("Set APP_BASE_URL to the trusted HTTPS origin or http://localhost:3000 for local sign-in.");
  }
  for (const name of ["AUTH_SECRET", "AUTH_OTP_SECRET", "ADMIN_MFA_KEY_ID", "ADMIN_MFA_KEYS"] as const) {
    process.env[name] = local[name] ?? "";
  }
  process.env.MONGODB_URI = uri;

  let silent = false;
  const output = new Writable({ write(chunk, _, done) { if (!silent) process.stdout.write(chunk); done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const controller = new AbortController();
  rl.on("close", () => controller.abort());
  rl.on("SIGINT", () => rl.close());
  const write = (text: string) => process.stdout.write(text);
  const question = (prompt: string) => rl.question(prompt, { signal: controller.signal });
  async function hidden(prompt: string) {
    write(prompt);
    silent = true;
    try { return await question(""); }
    finally { silent = false; write("\n"); }
  }

  try {
    write(`Abii Administrator Setup\n\nDatabase: ${target.database}\nAdministrator storage: admins\n`);
    await connectAtlasOperator(uri, target);
    let showingNewFactor = false;
    const result = await bootstrapAdmin(target, {
      onStage,
      describe: status => write(`Existing administrator: ${status === "absent" ? "None" : status}\n\n`),
      name: () => question("Administrator name: "),
      email: () => hidden("Administrator email: "),
      password: existing => hidden(existing ? "Current administrator password: " : "New administrator password: "),
      confirmPassword: () => hidden("Confirm password: "),
      recoveryCode: () => hidden("One unused offline recovery code: "),
      authorizeWrite: async () => {
        write("\nConfirm recorded production approval, a verified restore, backed-up MFA keys, verified mailbox ownership, and compatible authentication on every deployment using abii. For first setup, confirm registration requests are paused and drained.\n");
        const phrase = `AUTHORIZE ${input.toUpperCase()} ${target.replicaSet}/${target.database}`;
        return (await question(`Type '${phrase}' to authorize production writes: `)).trim() === phrase;
      },
      showSetupKey: (seed, email) => {
        showingNewFactor = true;
        write(`\nIn Google Authenticator, add a time-based key for Abii (${email}). Use 6 digits, SHA-1 and a 30-second period.\nSetup key: ${seed}\n`);
      },
      code: () => hidden(showingNewFactor ? "New six-digit authenticator code: " : "Current six-digit authenticator code: "),
      showRecoveryCodes: codes => write(`\nMFA verified. Save these single-use recovery codes offline now:\n${codes.join("\n")}\n`),
    }, input);
    if (result === "already-active") {
      write("Administrator already active. No database writes were made.\n");
      return;
    }
    write(`\nAdministrator active. Sign in at ${appUrl.origin}/login.\n`);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let stage: SetupStage = "configuration";
  run(currentStage => { stage = currentStage; }).catch((error: unknown) => {
    process.stderr.write(safeSetupError(error, stage) + "\n");
    process.exitCode = 1;
  });
}
