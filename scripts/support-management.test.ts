import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptSupportBody, encryptSupportBody, supportStatusTransition } from "../lib/support/tickets";

test("support correspondence is authenticated encrypted and detects tampering", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptSupportBody("Private customer message", `base64:${key}`);
  assert.notEqual(encrypted.ciphertext, "Private customer message");
  assert.equal(decryptSupportBody(encrypted, `base64:${key}`), "Private customer message");
  const tamperedTag = Buffer.from(encrypted.tag, "base64");
  tamperedTag[0] ^= 1;
  assert.throws(() => decryptSupportBody({ ...encrypted, tag: tamperedTag.toString("base64") }, `base64:${key}`));
});

test("support correspondence rejects a record encrypted with an unsupported key id", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptSupportBody("Private customer message", `base64:${key}`);
  assert.throws(() => decryptSupportBody({ ...encrypted, keyId: "retired" }, `base64:${key}`));
});

test("support statuses accept only declared lifecycle transitions", () => {
  assert.equal(supportStatusTransition("new", "open"), true);
  assert.equal(supportStatusTransition("open", "awaiting_reply"), true);
  assert.equal(supportStatusTransition("resolved", "open"), true);
  assert.equal(supportStatusTransition("new", "awaiting_reply"), false);
  assert.equal(supportStatusTransition("awaiting_reply", "new"), false);
});
