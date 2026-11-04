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
  assert.match(result.html, /background:#FFE8EF/);
  assert.match(result.html, /class="hero-copy" width="67%"/);
  assert.match(result.html, /class="hero-art" width="33%"/);
  assert.match(result.html, /class="email-header" style="padding:28px 20px 24px"/);
  assert.match(result.html, /https:\/\/abii\.example\/abii-head\.png/);
  assert.match(result.html, /width="48" alt="Abii mascot"/);
  assert.match(result.html, /class="brand-name"[^>]*>abii\.<\/div>/);
  assert.match(result.html, /class="brand-tagline secondary"[^>]*>Learn a little, remember a lot\.<\/div>/);
  assert.match(result.html, /class="email-header"[^]*<table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="brand-icon-cell" valign="middle"/);
  assert.match(result.html, /align="center" cellpadding="0" cellspacing="0" aria-label="YOUR VERIFICATION CODE: 012345"/);
});

test("reset email selects reset content and rejects malformed codes", () => {
  const result = renderAuthEmail({ name: "Kian", code: "731205", purpose: "password_reset", baseUrl: "https://abii.example" });
  assert.match(result.subject, /Reset your password/);
  assert.match(result.html, /password-reset-mascot\.png/);
  assert.match(result.html, /class="hero-copy" width="67%"/);
  assert.match(result.html, /class="hero-art" width="33%"/);
  assert.match(result.text, /731205/);
  assert.throws(() => renderAuthEmail({ name: "Kian", code: "12345", purpose: "password_reset", baseUrl: "https://abii.example" }));
});

test("both email heroes preserve desktop sizing and use a two-column mobile scale", () => {
  for (const purpose of ["verification", "password_reset"] as const) {
    const html = renderAuthEmail({ name: "Kian", code: "731205", purpose, baseUrl: "https://abii.example" }).html;
    assert.match(html, /https:\/\/abii\.example\/abii-head\.png/);
    assert.match(html, /width="48" alt="Abii mascot"/);
    assert.match(html, /class="brand-tagline secondary"[^>]*>Learn a little, remember a lot\.<\/div>/);
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
    assert.match(html, /width="180" alt="" style="display:block;width:180px;max-width:100%;height:auto"/);
    assert.match(html, /class="hero-title" style="font-size:28px;line-height:1\.1;margin:14px 0"/);
    assert.match(html, /@media screen and \(max-width:430px\)\{\.hero-copy\{width:54%!important/);
    assert.match(html, /\.hero-art\{width:46%!important\}/);
    assert.match(html, /\.hero-title\{font-size:23px!important;line-height:1\.12!important/);
    assert.match(html, /@media screen and \(max-width:389px\)\{\.hero-title\{font-size:22px!important\}/);
    assert.match(html, /@media screen and \(max-width:359px\)\{\.hero-copy\{width:52%!important\}/);
    assert.match(html, /\.hero-image\{width:136px!important\}/);
    assert.match(html, /-webkit-text-size-adjust:100%/);
    assert.match(html, /\.hero\{background:#482936!important\}/);
    assert.match(html, /\.otp\{background:#302129!important;color:#FF92B3!important/);
    assert.match(html, /\[data-ogsc\] \.brand-name\{color:#FF8FB1!important\}/);
    assert.match(html, /@media screen and \(max-width:430px\)\{\.email-header\{padding:20px 20px 22px!important\}/);
    assert.match(html, /\.brand-icon\{width:42px!important\}/);
    assert.match(html, /\.brand-icon-cell\{padding-right:9px!important\}/);
    assert.match(html, /\.brand-name\{font-size:30px!important;line-height:1\.05!important\}/);
    assert.match(html, /\.brand-tagline\{font-size:12px!important/);
    assert.match(html, /\.email-content\{padding:20px 20px!important/);
    assert.match(html, /\.email-greeting\{font-size:24px!important/);
    assert.match(html, /\.email-intro\{font-size:14px!important/);
    assert.match(html, /\.email-code-label\{margin:20px 0 8px!important\}/);
    assert.match(html, /@media screen and \(max-width:359px\)\{\.brand-icon\{width:40px!important\}/);
    assert.doesNotMatch(html, /width="600"/);
  }
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
    assert.equal(result.status, 201);
    assert.equal(result.messageId, "mock-message");
    assert.deepEqual(sentBody?.sender, { email: "verified@example.com", name: "Abii Test" });
    assert.equal((sentBody?.to as Array<{ email: string }>)[0].email, "student@example.com");
    assert.match(String(sentBody?.htmlContent), /https:\/\/assets\.example\.com\/email\/verification-mascot\.png/);
    assert.equal("textContent" in (sentBody || {}), false);
    globalThis.fetch = async () => new Response("rate limited", { status: 429 });
    const limited = await sendVerificationEmail("student@example.com", "Test", "012345", "registration");
    assert.equal(limited.ok, false);
    assert.equal(limited.status, 429);
    assert.equal(limited.error, "Brevo rate limit reached.");
  } finally { globalThis.fetch = originalFetch; }
});
