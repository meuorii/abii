import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
