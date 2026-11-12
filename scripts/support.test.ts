import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSupportContact, supportCategories } from "../lib/support/validation";
import { renderSupportEmail } from "../lib/email/support-template";

test("support contact validation normalizes values and accepts known categories", () => {
  const result = validateSupportContact({
    name: "  Alex   Student ",
    email: " ALEX@EXAMPLE.COM ",
    category: "Flashcards",
    message: "Please help me edit my cards.",
  });

  assert.deepEqual(result.errors, {});
  assert.equal(result.values.name, "Alex Student");
  assert.equal(result.values.email, "alex@example.com");
  assert.equal(result.values.category, "Flashcards");
});

test("support contact validation rejects malformed and oversized input", () => {
  const result = validateSupportContact({
    name: " ".repeat(81),
    email: "not-an-email",
    category: "Arbitrary recipient",
    message: "short",
  });

  assert.deepEqual(Object.keys(result.errors).sort(), ["category", "email", "message", "name"]);
  assert.ok(supportCategories.includes("Other"));
});

test("support email escapes untrusted fields and provides a plain text alternative", () => {
  const message = renderSupportEmail({
    category: "Technical Issue",
    name: "<img src=x onerror=alert(1)>",
    email: "student@example.com",
    message: "First line\n<script>alert(1)</script>",
    submittedAt: new Date("2026-11-12T00:00:00.000Z"),
  });

  assert.equal(message.subject, "[Abii Support] Technical Issue");
  assert.ok(message.html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(message.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!message.html.includes("<script>"));
  assert.ok(message.text.includes("First line\n<script>alert(1)</script>"));
});
