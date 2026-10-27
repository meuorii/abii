import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { BADGE_BY_ID, BADGE_CATALOG, BADGE_CATEGORIES_METADATA, BADGE_RARITIES } from "../lib/badges/catalog";
import { BADGE_IMAGES, getBadgeImagePath } from "../lib/badges/images";
import { BADGE_CATEGORIES, BADGE_IDS, BADGE_RARITIES as RARITY_IDS } from "../lib/badges/types";
import { defaultFeaturedBadgeIds } from "../lib/badges/featured-selection";

const root = resolve(process.cwd());

test("badge catalog is complete, unique, ordered, and uses only supported categories and rarities", () => {
  assert.equal(BADGE_CATALOG.length, 18);
  assert.equal(new Set(BADGE_CATALOG.map((badge) => badge.id)).size, 18);
  assert.deepEqual(BADGE_CATALOG.map((badge) => badge.id), BADGE_IDS);
  assert.deepEqual(Object.keys(BADGE_CATEGORIES_METADATA).sort(), [...BADGE_CATEGORIES].sort());
  assert.deepEqual(Object.keys(BADGE_RARITIES).sort(), [...RARITY_IDS].sort());
  BADGE_CATALOG.forEach((badge, index) => {
    assert.equal(badge.order, index + 1);
    assert.ok(BADGE_CATEGORIES.includes(badge.category));
    assert.ok(RARITY_IDS.includes(badge.rarity));
    assert.ok(badge.name.trim().length > 0);
    assert.ok(badge.description.trim().length > 10);
    assert.ok(badge.instructions.trim().length > 5);
    assert.ok(Number.isFinite(badge.requirement.target) && badge.requirement.target > 0);
    if (badge.requirement.minimumScorePercent !== undefined) assert.ok(badge.requirement.minimumScorePercent >= 0 && badge.requirement.minimumScorePercent <= 100);
    if (badge.requirement.minimumOriginalQuestions !== undefined) assert.ok(Number.isInteger(badge.requirement.minimumOriginalQuestions) && badge.requirement.minimumOriginalQuestions > 0);
    assert.ok(BADGE_RARITIES[badge.rarity].medalImage);
    assert.equal(badge.images.unlocked, BADGE_IMAGES[badge.id].unlocked);
    assert.equal(badge.images.locked, BADGE_IMAGES[badge.id].locked);
    assert.equal(getBadgeImagePath(badge.id, true), badge.images.unlocked);
    assert.equal(getBadgeImagePath(badge.id, false), badge.images.locked);
    assert.ok(existsSync(resolve(root, `public${badge.images.unlocked}`)), `Missing ${badge.images.unlocked}`);
    assert.ok(existsSync(resolve(root, `public${badge.images.locked}`)), `Missing ${badge.images.locked}`);
  });
  for (const rarity of RARITY_IDS) assert.ok(existsSync(resolve(root, `public${BADGE_RARITIES[rarity].medalImage}`)), `Missing medal for ${rarity}`);
  assert.equal(BADGE_BY_ID["hello-abii"].images.unlocked, "/badges/unlocked/hello-abi-unlocked.png");
  assert.equal(BADGE_BY_ID["hello-abii"].images.locked, "/badges/locked/hello-abi-locked.png");
});

test("default showcase picks the three most recently earned badges with catalog-order tie breaking", () => {
  const sameDay = new Date("2025-01-02T12:00:00.000Z");
  assert.deepEqual(defaultFeaturedBadgeIds([
    { badgeId: "card-creator", unlockedAt: sameDay },
    { badgeId: "hello-abii", unlockedAt: sameDay },
    { badgeId: "quiz-rookie", unlockedAt: new Date("2025-01-03T12:00:00.000Z") },
    { badgeId: "little-explorer", unlockedAt: new Date("2025-01-01T12:00:00.000Z") },
    { badgeId: "not-a-badge", unlockedAt: new Date("2025-01-04T12:00:00.000Z") },
  ]), ["quiz-rookie", "hello-abii", "card-creator"]);
});
