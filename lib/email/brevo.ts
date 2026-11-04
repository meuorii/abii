import "server-only";
import { renderAuthEmail } from "./templates";

type Message = { recipient: string; subject: string; html: string; text: string };

function config() {
  const apiKey = process.env.BREVO_API_KEY;
  const email = process.env.BREVO_SENDER_EMAIL;
  const name = process.env.BREVO_SENDER_NAME || "Abii";
  const baseUrl = process.env.APP_BASE_URL;
  if (!apiKey || !email || !baseUrl) throw new Error("Email service configuration is incomplete.");
  const url = new URL(baseUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_BASE_URL must use HTTPS in production.");
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid APP_BASE_URL.");
  const assetUrl = new URL(process.env.EMAIL_ASSET_BASE_URL || url.origin);
  if (assetUrl.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(assetUrl.hostname)) throw new Error("Email assets must use a public HTTPS origin.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("BREVO_SENDER_EMAIL must be a valid verified sender address.");
  return { apiKey, email, name, baseUrl: url.origin, assetUrl: assetUrl.origin };
}

export async function sendTransactionalEmail(message: Message): Promise<{ ok: boolean; messageId?: string }> {
  const settings = config();
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": settings.apiKey, accept: "application/json", "content-type": "application/json" },
      // Brevo documents htmlContent, textContent, and templateId as mutually exclusive body modes.
      body: JSON.stringify({ sender: { email: settings.email, name: settings.name }, to: [{ email: message.recipient }], subject: message.subject, htmlContent: message.html }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false };
    const payload = await response.json().catch(() => ({})) as { messageId?: unknown };
    return { ok: true, ...(typeof payload.messageId === "string" ? { messageId: payload.messageId } : {}) };
  } catch {
    return { ok: false };
  }
}

export async function sendVerificationEmail(recipient: string, name: string, code: string, context: "registration" | "existing_account") {
  const content = renderAuthEmail({ name, code, context, purpose: "verification", baseUrl: config().assetUrl });
  return sendTransactionalEmail({ recipient, ...content });
}

export async function sendPasswordResetEmail(recipient: string, name: string, code: string) {
  const content = renderAuthEmail({ name, code, purpose: "password_reset", baseUrl: config().assetUrl });
  return sendTransactionalEmail({ recipient, ...content });
}
