import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BADGE_CATALOG } from "../lib/badges/catalog";

const root = process.cwd();

test("shared skeleton exports decorative block, circle, card, and loading region primitives", async () => {
  const source = await readFile(`${root}/components/ui/skeleton.tsx`, "utf8");
  assert.match(source, /export function SkeletonBlock/);
  assert.match(source, /export function SkeletonCircle/);
  assert.match(source, /export function SkeletonCard/);
  assert.match(source, /export function SkeletonRegion/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /role="status"/);
});

test("shared shimmer uses one tokenized 2 second sweep and becomes static for reduced motion", async () => {
  const css = await readFile(`${root}/app/globals.css`, "utf8");
  assert.match(css, /--skeleton-base:\s*#F2E7EB/i);
  assert.match(css, /--skeleton-highlight:/i);
  assert.match(css, /@keyframes skeleton-shimmer/);
  assert.match(css, /2s\s+linear\s+infinite/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.abii-skeleton::after\s*\{\s*animation:\s*none/);
});

test("page and badge loaders share primitives without client-side motion or independent pulse styling", async () => {
  const [page, badges] = await Promise.all([
    readFile(`${root}/components/ui/page-loading-skeleton.tsx`, "utf8"),
    readFile(`${root}/components/badges/badges-page-skeleton.tsx`, "utf8"),
  ]);
  assert.doesNotMatch(page, /"use client"/);
  assert.match(page, /SkeletonBlock/);
  assert.match(badges, /SkeletonBlock/);
  assert.doesNotMatch(page + badges, /animate-pulse|motion-safe:animate-pulse/);
});

function assertSectionOrder(source: string, component: string, sections: string[]) {
  const start = source.indexOf(`export function ${component}`);
  assert.notEqual(start, -1, `${component} exists`);
  const next = source.indexOf("\nexport function ", start + 1);
  const body = source.slice(start, next === -1 ? undefined : next);
  let previous = -1;
  for (const section of sections) {
    const index = section === "hero" ? body.indexOf("<MainPageHeroSkeleton") : body.indexOf(`data-skeleton-section="${section}"`);
    assert.ok(index > previous, `${component} contains ${section} in order`);
    previous = index;
  }
}

test("main page skeletons follow each real page's primary section order", async () => {
  const source = await readFile(`${root}/components/ui/main-page-skeletons.tsx`, "utf8");
  assertSectionOrder(source, "DashboardSkeleton", ["hero", "overall-mastery", "due-review", "study-streak", "subjects", "featured-badges", "quick-actions"]);
  assertSectionOrder(source, "SubjectsSkeleton", ["hero", "subject-controls", "subject-grid"]);
  assertSectionOrder(source, "ReviewSkeleton", ["hero", "review-overview", "recent-subjects", "review-by-topic", "review-progress"]);
  assertSectionOrder(source, "ProgressSkeleton", ["hero", "summary", "featured-badges", "study-activity", "subject-performance", "topic-mastery", "needs-more-practice", "recent-sessions"]);
  assertSectionOrder(source, "SettingsSkeleton", ["hero", "study-preferences", "data-privacy"]);
  assertSectionOrder(source, "ProfileSkeleton", ["hero", "account-overview", "personal-information", "password-security", "danger-zone"]);
  assert.doesNotMatch(source, /<(?:button|input|select|textarea|a)(?:\s|>)/i);
});

test("Badges skeleton follows fixed statistics and collection hierarchy with loaded breakpoints", async () => {
  const source = await readFile(`${root}/components/badges/badges-page-skeleton.tsx`, "utf8");
  assertSectionOrder(source, "BadgesPageSkeleton", ["hero", "statistics", "collection-progress", "rarity", "filters", "badge-grid"]);
  assert.match(source, /min-\[380px\]:grid-cols-2/);
  assert.match(source, /xl:grid-cols-4/);
  assert.match(source, /min-\[360px\]:grid-cols-2/);
  assert.match(source, /data-skeleton-stat=/);
  assert.equal((source.match(/data-skeleton-stat=/g) ?? []).length, 4);
  assert.doesNotMatch(source, /<(?:button|input|select|textarea|a)(?:\s|>)/i);
});

test("Profile route uses the shared Profile skeleton variant and accessible loading region", async () => {
  const [route, page] = await Promise.all([
    readFile(`${root}/app/(authenticated)/profile/loading.tsx`, "utf8"),
    readFile(`${root}/components/ui/page-loading-skeleton.tsx`, "utf8"),
  ]);
  assert.match(route, /variant="profile"/);
  assert.match(page, /case "profile"/);
  assert.match(page, /ProfileSkeleton/);
  assert.match(page, /Loading profile page/);
});

test("Featured Badges keeps one streamed fallback implementation for route and local boundaries", async () => {
  const [stream, content] = await Promise.all([
    readFile(`${root}/components/badges/featured-badges-stream.tsx`, "utf8"),
    readFile(`${root}/components/badges/featured-badges-skeleton-content.tsx`, "utf8"),
  ]);
  assert.match(stream, /<SkeletonRegion label=\{`Loading \$\{title\}`\}/);
  assert.match(stream, /<FeaturedBadgesSkeletonContent\s*\/>/);
  assert.match(content, /export function FeaturedBadgesSkeletonContent/);
  assert.match(content, /UnknownCollectionPlaceholder/);
});

async function collectionState(items: readonly unknown[] | null, visibleLimit?: number) {
  const collectionStateModule = await import("../components/ui/collection-loading-state").catch(() => null);
  assert.ok(collectionStateModule, "the collection loading state resolver should exist");
  return collectionStateModule.resolveCollectionSkeletonState(items, visibleLimit);
}

test("unknown and empty collections never produce fabricated item placeholders", async () => {
  assert.deepEqual(await collectionState(null), { kind: "unknown" });
  assert.deepEqual(await collectionState([]), { kind: "empty" });
});

test("local collection refresh keeps successfully loaded content visible", async () => {
  const collectionStateModule = await import("../components/ui/collection-loading-state").catch(() => null);
  assert.ok(collectionStateModule, "the collection loading state resolver should exist");
  assert.equal(typeof collectionStateModule.getCollectionLoadingPresentation, "function", "the collection refresh presentation rule should exist");
  assert.equal(collectionStateModule.getCollectionLoadingPresentation(false, false), "initial-skeleton");
  assert.equal(collectionStateModule.getCollectionLoadingPresentation(true, false), "content");
  assert.equal(collectionStateModule.getCollectionLoadingPresentation(true, true), "content");
  assert.equal(collectionStateModule.getCollectionLoadingPresentation(false, true), "content");
});

test("loaded collection metadata never crosses subject or folder scopes", async () => {
  const collectionStateModule = await import("../components/ui/collection-loading-state").catch(() => null);
  assert.ok(collectionStateModule, "the collection loading state resolver should exist");
  assert.equal(typeof collectionStateModule.isCollectionScopeLoaded, "function", "collection loaded state should be scoped");
  assert.equal(collectionStateModule.isCollectionScopeLoaded("subject-a:all", "subject-a:all"), true);
  assert.equal(collectionStateModule.isCollectionScopeLoaded("subject-a:all", "subject-b:all"), false);
  assert.equal(collectionStateModule.isCollectionScopeLoaded("subject-a:folder-1", "subject-a:folder-2"), false);
});

test("known collections preserve exact visible identity and respect the rendered window", async () => {
  const subjects = ["one", "two", "three", "four", "five"];
  assert.deepEqual(await collectionState(subjects.slice(0, 1)), { kind: "known", items: ["one"] });
  assert.deepEqual(await collectionState(subjects.slice(0, 2)), { kind: "known", items: ["one", "two"] });
  assert.deepEqual(await collectionState(subjects, 5), { kind: "known", items: subjects });
  assert.deepEqual(await collectionState(subjects, 2), { kind: "known", items: ["one", "two"] });
  const many = Array.from({ length: 100 }, (_, index) => index);
  assert.deepEqual(await collectionState(many, 10), { kind: "known", items: many.slice(0, 10) });
});

test("Badge catalog loading quantity follows the fixed product catalog, not unlocked account data", async () => {
  const state = await collectionState(BADGE_CATALOG);
  assert.equal(state.kind, "known");
  if (state.kind === "known") assert.equal(state.items.length, BADGE_CATALOG.length);
});
