import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const sourceRoots = [
  "app/(authenticated)",
  "components/app-shell.tsx",
  "components/dashboard",
  "components/subjects",
  "components/review",
  "components/progress",
  "components/badges",
  "components/settings",
  "components/profile",
  "components/notifications",
  "components/ui/abii-page-hero.tsx",
  "components/ui/button.tsx",
  "components/ui/checkbox.ts",
  "components/ui/input.tsx",
  "components/ui/modal.tsx",
  "components/ui/navigation.tsx",
  "components/ui/progress-bar.tsx",
  "components/ui/range-input.ts",
  "components/ui/toast-config.ts",
  "components/ui/toast.tsx",
  "components/ui/workspace-chrome.tsx",
];

function walk(root: string): string[] {
  const absolute = path.resolve(root);
  if (!statSync(absolute).isDirectory()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return walk(child);
    return /\.(?:tsx|ts)$/.test(entry.name) ? [child] : [];
  });
}

function walkModuleCss(root: string): string[] {
  const absolute = path.resolve(root);
  if (!statSync(absolute).isDirectory()) return absolute.endsWith(".module.css") ? [absolute] : [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return walkModuleCss(child);
    return entry.name.endsWith(".module.css") ? [child] : [];
  });
}

function findViolations(file: string, source: string) {
  const violations: string[] = [];
  const locationAt = (index: number) => `${file}:${source.slice(0, index).split(/\r?\n/).length}`;
  for (const match of source.matchAll(/(?:text|bg|border|ring|outline|accent|divide|fill|stroke|decoration)-\[[^\]\r\n]*#[\da-f]{3,8}[^\]]*\]/gi)) {
    const adminHeroBorder = file.replaceAll("\\", "/") === "components/ui/abii-page-hero.tsx" && match[0] === "border-[#F6DCE5]";
    if (!adminHeroBorder) violations.push(`${locationAt(match.index ?? 0)}: hardcoded color in a Tailwind utility; use an approved semantic utility`);
  }
  for (const match of source.matchAll(/\b(?:text|bg|border|ring|outline)-pink-(?:active|accent|primary|card|soft)\b/g)) {
    violations.push(`${locationAt(match.index ?? 0)}: legacy pink alias in a learner class definition`);
  }
  for (const match of source.matchAll(/style=\{\{[^}]*\b(?:color|background|backgroundColor|borderColor|outlineColor|margin|padding|gap|display|position|top|left|right|bottom|width|height)\s*:\s*(?:#[\da-f]{3,8}|["'][^"']*["']|\d+(?:px|rem|em|%)?)(?:\s*[,}])/gi)) {
    violations.push(`${locationAt(match.index ?? 0)}: static inline presentation; use a Tailwind utility`);
  }
  return violations;
}

test("learner source uses semantic presentation styles", () => {
  const files = sourceRoots.flatMap(walk);
  const violations = files.flatMap((file) => findViolations(path.relative(process.cwd(), file), readFileSync(file, "utf8")));
  const modules = sourceRoots.flatMap(walkModuleCss);
  violations.push(...modules.map((file) => `${path.relative(process.cwd(), file)}: learner CSS Modules are not allowed`));
  assert.deepEqual(violations, [], violations.join("\n"));

  const globals = readFileSync("app/globals.css", "utf8");
  assert.doesNotMatch(globals, /\.learner-theme\s+\.abii-|\.learner-modal-theme\s+\.learner-|\.abii-checkbox/,
    "ordinary learner component selectors should live in Tailwind class strings");
});

test("style compliance check catches a synthetic learner violation", () => {
  const invalid = '<div className="text-[#153B56] text-pink-active" style={{ color: "#153B56", marginTop: "8px" }} />';
  const violations = findViolations("synthetic/invalid.tsx", invalid);
  assert.equal(violations.length, 3);
  assert.match(violations[0], /synthetic\/invalid\.tsx:1/);
  assert.match(violations[0], /hardcoded color/);
  assert.match(violations[1], /legacy pink alias/);
  assert.match(violations[2], /static inline presentation/);
});
