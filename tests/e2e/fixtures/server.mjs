import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import { dirname, resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SignJWT } from "jose";
import { SESSION_AUDIENCE, SESSION_ISSUER } from "../../../lib/auth/constants.ts";
import { User } from "../../../models/User.ts";
import { Subject } from "../../../models/Subject.ts";
import { SubjectFolder } from "../../../models/SubjectFolder.ts";
import { Folder } from "../../../models/Folder.ts";
import { Topic } from "../../../models/Topic.ts";
import { Flashcard } from "../../../models/Flashcard.ts";

const port = Number(process.env.ABII_PLAYWRIGHT_PORT ?? 4174);
const baseURL = "http://127.0.0.1:" + port;
const secret = "playwright-isolated-test-secret-not-for-production-7f91";
const fixturePath = resolve(".playwright/fixture.json");
let mongo;
let next;
let stopping = false;

async function assertPortAvailable() {
  const probe = net.createServer();
  try {
    probe.listen(port, "127.0.0.1");
    await once(probe, "listening");
  } finally {
    await new Promise((resolveClose) => probe.close(() => resolveClose()));
  }
}

async function stop() {
  if (stopping) return;
  stopping = true;
  if (next && next.exitCode === null) {
    next.kill();
    await Promise.race([once(next, "exit"), new Promise((resolveWait) => setTimeout(resolveWait, 5_000))]);
  }
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

try {
  await assertPortAvailable();
  mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
  const mongoUri = mongo.getUri("abii_phase1_playwright_isolated");
  const parsedMongoUri = new URL(mongoUri);
  assert.equal(parsedMongoUri.hostname, "127.0.0.1", "test database must bind only to loopback");
  assert.match(parsedMongoUri.pathname, /abii_phase1_playwright_isolated/, "test database must use its dedicated synthetic database name");
  assert.ok(secret.length >= 32 && secret.includes("isolated"), "test authentication secret must be isolated and sufficiently long");

  process.env.MONGODB_URI = mongoUri;
  await mongoose.connect(mongoUri);
  const user = await User.create({ name: "Phase One Learner", email: "phase1-learner@example.invalid", passwordHash: "fixture-only", emailVerifiedAt: new Date() });
  const emptyUser = await User.create({ name: "New Phase Two Learner", email: "phase2-empty@example.invalid", passwordHash: "fixture-only", emailVerifiedAt: new Date() });
  const subjectFolder = await SubjectFolder.create({ userId: user._id, name: "Biology", normalizedName: "biology", position: 0 });
  const subject = await Subject.create({ userId: user._id, subjectFolderId: subjectFolder._id, name: "Long Synthetic Biology Subject Name for Responsive Testing" });
  const folder = await Folder.create({ userId: user._id, subjectId: subject._id, name: "Cellular Biology" });
  const topic = await Topic.create({ userId: user._id, subjectId: subject._id, folderId: folder._id, name: "Long Synthetic Topic Name for Hero Wrapping Checks" });
  await Flashcard.create({ userId: user._id, subjectId: subject._id, topicId: topic._id, question: "What is the basic unit of life?", answer: "The cell." });
  const token = await new SignJWT({ sv: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user._id))
    .setIssuedAt()
    .setExpirationTime("20m")
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .sign(new TextEncoder().encode(secret));
  const emptyToken = await new SignJWT({ sv: emptyUser.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(emptyUser._id))
    .setIssuedAt()
    .setExpirationTime("20m")
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .sign(new TextEncoder().encode(secret));
  await mongoose.disconnect();
  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, JSON.stringify({ baseURL, token, emptyToken, subjectId: String(subject._id), topicId: String(topic._id), folderId: String(folder._id), subjectFolderId: String(subjectFolder._id) }), "utf8");

  const isolatedEnv = {
    ...process.env,
    MONGODB_URI: mongoUri,
    AUTH_SECRET: secret,
    AUTH_OTP_SECRET: "",
    APP_BASE_URL: baseURL,
    NODE_ENV: "development",
    ABII_ADMIN_UI_ENABLED: "false",
    ABII_ANNOUNCEMENTS_DELIVERY_ENABLED: "false",
    ABII_SECURITY_EVENTS_ENABLED: "false",
    ABII_PERF_MONGODB_URI: "",
    ABII_DEMO_PASSWORD: "",
    ADMIN_MFA_KEY_ID: "",
    ADMIN_MFA_KEYS: "",
    BREVO_API_KEY: "",
    BREVO_SENDER_EMAIL: "",
    BREVO_SENDER_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    CLOUDINARY_CLOUD_NAME: "",
    CRON_SECRET: "",
    EMAIL_ASSET_BASE_URL: "",
    SUPPORT_INBOX_EMAIL: "",
    SUPPORT_TICKET_ENCRYPTION_KEY: "",
    SUPPORT_TICKET_ENCRYPTION_KEY_ID: "",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
  };
  for (const name of ["ABII_TEST_ADMIN_LAYOUT_ONLY", "ABII_TEST_ADMIN_TARGETS", "ABII_TEST_ADMIN_VIEWPORTS", "ABII_ADMIN_SCREENSHOTS", "ABII_TEST_PRODUCTION_GATE"]) delete isolatedEnv[name];
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(), env: isolatedEnv, stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
  });
  next.once("exit", () => { if (!stopping) void stop(); });
  const shutdown = () => { void stop().finally(() => process.exit(0)); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await new Promise(() => {});
} catch (error) {
  console.error("Phase 01 Playwright isolated fixture server failed:", error);
  await stop();
  process.exitCode = 1;
}
