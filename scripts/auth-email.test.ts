import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAuthEmail } from "../lib/email/templates";
import { generateOtp, hashOtp } from "../lib/auth/otp-crypto";
import { sendVerificationEmail } from "../lib/email/brevo";

test("verification email displays six separate digits and preserves leading zero", () => {
  const result = renderAuthEmail({ name: "<Kian>", code: "012345", purpose: "verification", context: "existing_account", baseUrl: "https://abii.example" });
  assert.equal((result.html.match(/class="otp"/g) || []).length, 6);
  assert.match(result.html, /&lt;Kian&gt;/);
  assert.match(result.html, /To continue using Abii/);
  assert.match(result.text, /012345/);
  assert.match(result.html, /https:\/\/abii\.example\/email\/verification-mascot\.png/);
  assert.match(result.html, /prefers-color-scheme:dark/);
});

test("reset email selects reset content and rejects malformed codes", () => {
  const result = renderAuthEmail({ name: "Kian", code: "731205", purpose: "password_reset", baseUrl: "https://abii.example" });
  assert.match(result.subject, /Reset your password/);
  assert.match(result.html, /password-reset-mascot\.png/);
  assert.match(result.text, /731205/);
  assert.throws(() => renderAuthEmail({ name: "Kian", code: "12345", purpose: "password_reset", baseUrl: "https://abii.example" }));
});

test("OTP values are six numeric digits and HMAC binds purpose and account", () => {
  process.env.AUTH_OTP_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
  const code = generateOtp();
  assert.match(code, /^\d{6}$/);
  const digest = hashOtp("user-a", "email_verification", "challenge-a", "012345");
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, hashOtp("user-a", "password_reset", "challenge-a", "012345"));
  assert.notEqual(digest, hashOtp("user-b", "email_verification", "challenge-a", "012345"));
});

test("Brevo delivery uses the configured sender, public assets, and checks provider status", async () => {
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "verified@example.com";
  process.env.BREVO_SENDER_NAME = "Abii Test";
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.EMAIL_ASSET_BASE_URL = "https://assets.example.com";
  const originalFetch = globalThis.fetch;
  let sentBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.brevo.com/v3/smtp/email");
    assert.equal(new Headers(init?.headers).get("api-key"), "test-api-key");
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ messageId: "mock-message" }), { status: 201 });
  };
  try {
    const result = await sendVerificationEmail("student@example.com", "Test", "012345", "registration");
    assert.equal(result.ok, true);
    assert.equal(result.messageId, "mock-message");
    assert.deepEqual(sentBody?.sender, { email: "verified@example.com", name: "Abii Test" });
    assert.equal((sentBody?.to as Array<{ email: string }>)[0].email, "student@example.com");
    assert.match(String(sentBody?.htmlContent), /https:\/\/assets\.example\.com\/email\/verification-mascot\.png/);
    assert.equal("textContent" in (sentBody || {}), false);
    globalThis.fetch = async () => new Response("rate limited", { status: 429 });
    assert.equal((await sendVerificationEmail("student@example.com", "Test", "012345", "registration")).ok, false);
  } finally { globalThis.fetch = originalFetch; }
});
