import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Profile is authenticated, receives account data, and renders one branded hero", async () => {
  const page = await read("../app/(authenticated)/profile/page.tsx");
  assert.match(page, /getCurrentUser\(\)/);
  assert.match(page, /if \(!user\) redirect\("\/login"\)/);
  assert.match(page, /<ProfileClient[\s\S]*?initialUser=\{[\s\S]*?name: user\.name[\s\S]*?email: user\.email[\s\S]*?profileImage: user\.profileImage[\s\S]*?memberSince,/);
  const profile = await read("../components/profile/profile-client.tsx");
  assert.match(profile, /AbiiPageHero/);
  assert.match(profile, /variant="profile"/);
  assert.match(profile, /mascotSrc="\/dashboard-hero\/profile-hero\.png"/);
  assert.match(profile, /Your Profile, Your Space\./);
  assert.equal((profile.match(/<h1\b/g) ?? []).length, 1, "the Profile page should expose one primary heading");
});

test("Profile owns account controls and synchronizes updates through existing AppShell events", async () => {
  const profile = await read("../components/profile/profile-client.tsx");
  const shell = await read("../components/app-shell.tsx");
  for (const endpoint of ["/api/account/profile", "/api/account/profile-picture", "/api/account/password", "/api/account"]) {
    assert.ok(profile.includes(endpoint), `Profile should use ${endpoint}`);
  }
  assert.match(profile, /abii-profile-name-updated/);
  assert.match(profile, /abii-profile-image-updated/);
  assert.match(profile, /profile-picture-crop-modal/);
  assert.match(profile, /confirmation: "DELETE"/);
  assert.match(profile, /profile-image-updated/);
  assert.match(shell, /abii-profile-name-updated/);
  assert.match(shell, /abii-profile-image-updated/);
  assert.match(shell, /aria-current=\{pathname === "\/profile" \? "page" : undefined\}/);
});

test("Profile preserves email verification, password invalidation, and deletion safeguards", async () => {
  const profile = await read("../components/profile/profile-client.tsx");
  const profileRoute = await read("../app/api/account/profile/route.ts");
  const passwordRoute = await read("../app/api/account/password/route.ts");
  const accountRoute = await read("../app/api/account/route.ts");
  assert.match(profile, /id="profileEmail"[^>]*readOnly/);
  assert.match(profileRoute, /email !== user\.email/);
  assert.match(profileRoute, /Email changes require a separate verification flow/);
  assert.match(profile, /autoComplete="current-password"/);
  assert.match(profile, /autoComplete="new-password"/);
  assert.match(passwordRoute, /sessionVersion: 1/);
  assert.match(passwordRoute, /await destroySession\(\)/);
  assert.match(profile, /deleteText !== "DELETE"/);
  assert.match(profile, /confirmation: "DELETE"/);
  assert.match(accountRoute, /body\.confirmation !== "DELETE"/);
  assert.match(accountRoute, /withRequiredTransaction/);
});

test("Failed photo saves leave the existing photo state untouched", async () => {
  const profile = await read("../components/profile/profile-client.tsx");
  const savePhoto = profile.slice(profile.indexOf("async function savePhoto"), profile.indexOf("async function removePhoto"));
  assert.ok(savePhoto.indexOf("setProfileImage(data.profileImage)") > savePhoto.indexOf("await request("));
  assert.match(savePhoto, /catch \(error\)[\s\S]*toast\(\{ kind: "error"[\s\S]*throw new Error\("Your saved photo has not changed/);
});

test("Settings retains study and data controls without duplicate account forms", async () => {
  const settings = await read("../components/settings/settings-client.tsx");
  for (const expected of ["/api/settings", "studyTimezone", "/api/data/export", "/api/data/history", "/api/data/materials"]) {
    assert.ok(settings.includes(expected), `Settings should retain ${expected}`);
  }
  for (const removed of ["Account & Security", "/api/account/profile", "/api/account/profile-picture", "/api/account/password", "/api/account\""]) {
    assert.ok(!settings.includes(removed), `Settings should not contain ${removed}`);
  }
});
