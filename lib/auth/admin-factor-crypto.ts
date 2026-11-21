import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";

function getKey(id: string): Buffer {
  try {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id)) throw new Error();
    const keys: unknown = JSON.parse(process.env.ADMIN_MFA_KEYS ?? "");
    if (!keys || typeof keys !== "object" || !Object.hasOwn(keys, id)) throw new Error();
    const value: unknown = Reflect.get(keys, id);
    if (typeof value !== "string") throw new Error();
    const key = Buffer.from(value, "base64");
    if (key.length !== 32 || key.toString("base64") !== value) throw new Error();
    return key;
  } catch {
    throw new Error("Administrator factor key unavailable.");
  }
}

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function prepareEnrollment(userId: string) {
  const kid = process.env.ADMIN_MFA_KEY_ID ?? "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(kid), iv);
  cipher.setAAD(Buffer.from("abii-totp:" + userId + ":" + kid));
  const seed = new Secret({ size: 20 }).base32;
  const ciphertext = Buffer.concat([cipher.update(seed, "ascii"), cipher.final()]);
  const encryptedSeed = [kid, iv, ciphertext, cipher.getAuthTag()]
    .map(part => typeof part === "string" ? part : part.toString("base64url")).join(".");
  const proof = randomBytes(32).toString("base64url");
  return { seed, proof, encryptedSeed, proofHash: digest(proof), expiresAt: new Date(Date.now() + 10 * 60_000) };
}

export function readSeed(userId: string, encryptedSeed: string) {
  const [kid, iv, ciphertext, tag] = encryptedSeed.split(".");
  const decipher = createDecipheriv("aes-256-gcm", getKey(kid), Buffer.from(iv, "base64url"), { authTagLength: 16 });
  decipher.setAAD(Buffer.from("abii-totp:" + userId + ":" + kid));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("ascii");
}

export function totpAt(seed: string, timeMs: number) {
  return new TOTP({ secret: seed }).generate({ timestamp: timeMs });
}

export function acceptedStep(userId: string, encryptedSeed: string, code: string, lastStep: number) {
  if (!/^\d{6}$/.test(code)) return null;
  const timestamp = Date.now();
  const otp = new TOTP({ secret: readSeed(userId, encryptedSeed) });
  const delta = otp.validate({ token: code, timestamp, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(timestamp / 30_000) + delta;
  return step > lastStep ? step : null;
}
