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

function providerError(status: number): string {
  if (status === 400) return "Brevo rejected the request or sender configuration.";
  if (status === 401) return "Brevo rejected the API credentials.";
  if (status === 403) return "The Brevo account is not authorized to send this message.";
  if (status === 429) return "Brevo rate limit reached.";
  if (status >= 500) return "Brevo returned a temporary server error.";
  return `Brevo rejected the request (HTTP ${status}).`;
}

export async function sendTransactionalEmail(message: Message): Promise<{ ok: boolean; status: number; messageId?: string; error?: string }> {
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
    if (!response.ok) return { ok: false, status: response.status, error: providerError(response.status) };
    const payload = await response.json().catch(() => ({})) as { messageId?: unknown };
    return { ok: true, status: response.status, ...(typeof payload.messageId === "string" ? { messageId: payload.messageId } : {}) };
  } catch {
    return { ok: false, status: 0, error: "Network request failed or timed out." };
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
