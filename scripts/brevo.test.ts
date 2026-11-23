import assert from "node:assert/strict";
import { test } from "node:test";
import { sendTransactionalEmail } from "@/lib/email/brevo";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
function config() { process.env.BREVO_API_KEY = "test-key"; process.env.BREVO_SENDER_EMAIL = "sender@example.invalid"; process.env.BREVO_SENDER_NAME = "Abii Test"; process.env.APP_BASE_URL = "https://app.example.invalid"; process.env.EMAIL_ASSET_BASE_URL = "https://assets.example.invalid"; }
function restore() { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv); }

test("Brevo transport posts the configured sender, recipient, and support reply-to", async () => {
  config(); let url = ""; let init: RequestInit | undefined;
  globalThis.fetch = async (input, options) => { url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url; init = options; return new Response(JSON.stringify({ messageId: "provider-id" }), { status: 201, headers: { "content-type": "application/json" } }); };
  try {
    const result = await sendTransactionalEmail({ recipient: "customer@example.invalid", subject: "Support", html: "<p>safe</p>", text: "safe", replyTo: { email: "support@example.invalid", name: "Abii Support" } });
    assert.deepEqual(result, { ok: true, status: 201, messageId: "provider-id" }); assert.equal(url, "https://api.brevo.com/v3/smtp/email"); assert.equal(init?.method, "POST"); assert.equal((init?.headers as Record<string, string>)["api-key"], "test-key");
    const body = JSON.parse(init?.body as string) as { sender: { email: string; name: string }; to: { email: string }[]; replyTo: { email: string }; subject: string }; assert.equal(body.sender.email, "sender@example.invalid"); assert.equal(body.sender.name, "Abii Test"); assert.equal(body.to[0].email, "customer@example.invalid"); assert.equal(body.replyTo.email, "support@example.invalid"); assert.equal(body.subject, "Support");
  } finally { restore(); }
});

test("Brevo transport classifies provider and network failures without fallback delivery", async () => {
  config(); let calls = 0;
  try {
    for (const [status, expected] of [[400, "Brevo rejected the request or sender configuration."], [401, "Brevo rejected the API credentials."], [403, "The Brevo account is not authorized to send this message."], [429, "Brevo rate limit reached."], [500, "Brevo returned a temporary server error."]] as const) {
      globalThis.fetch = async () => { calls++; return new Response("{}", { status }); };
      assert.deepEqual(await sendTransactionalEmail({ recipient: "customer@example.invalid", subject: "S", html: "h", text: "t" }), { ok: false, status, error: expected });
    }
    globalThis.fetch = async () => { calls++; throw new Error("offline"); };
    assert.deepEqual(await sendTransactionalEmail({ recipient: "customer@example.invalid", subject: "S", html: "h", text: "t" }), { ok: false, status: 0, error: "Network request failed or timed out." }); assert.equal(calls, 6);
  } finally { restore(); }
});

test("Brevo transport fails before fetch when configuration is missing", async () => {
  restore(); delete process.env.BREVO_API_KEY; let called = false; globalThis.fetch = async () => { called = true; throw new Error("unexpected network"); };
  try { await assert.rejects(sendTransactionalEmail({ recipient: "customer@example.invalid", subject: "S", html: "h", text: "t" })); assert.equal(called, false); } finally { restore(); }
});
