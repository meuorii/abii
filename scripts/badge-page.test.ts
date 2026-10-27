import assert from "node:assert/strict";
import { test } from "node:test";
import { BADGE_CATALOG } from "../lib/badges/catalog";
import { countBadgeStatuses, filterBadges } from "../components/badges/filtering";
import type { BadgePageItem } from "../components/badges/types";

const fixture = BADGE_CATALOG.map((badge, index) => ({
  ...badge,
  badgeId: badge.id,
  unlocked: index % 2 === 0,
  alreadyEarned: index % 2 === 0,
  progress: index % 2 === 0 ? badge.requirement.target : 0,
  target: badge.requirement.target,
  remaining: index % 2 === 0 ? 0 : badge.requirement.target,
  progressLabel: index % 2 === 0 ? "Requirement completed" : badge.instructions,
  evidenceCompleteness: "current-state" as const,
  image: badge.images.locked,
  unlockedAt: null,
})) as unknown as BadgePageItem[];

test("badge page filters combine status, rarity, and category with accurate counts", () => {
  assert.equal(fixture.length, 18);
  assert.equal(filterBadges(fixture, "all", "all", "all").length, 18);
  assert.equal(filterBadges(fixture, "unlocked", "all", "all").length, 9);
  assert.equal(filterBadges(fixture, "locked", "all", "all").length, 9);

  const masteryRare = filterBadges(fixture, "locked", "rare", "mastery");
  assert.deepEqual(masteryRare.map((badge) => badge.id), ["memory-pro"]);
  assert.deepEqual(countBadgeStatuses(fixture, "rare", "mastery"), { all: 1, unlocked: 0, locked: 1 });
  assert.equal(filterBadges(fixture, "locked", "legendary", "mastery").length, 1);
  assert.equal(filterBadges(fixture, "unlocked", "common", "quiz-performance").length, 0);
});
