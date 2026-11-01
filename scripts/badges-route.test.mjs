import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const routePath = new URL("../app/(authenticated)/badges/page.tsx", import.meta.url);
const catalogPath = new URL("../lib/badges/catalog.ts", import.meta.url);

function visit(node, predicate, matches = []) {
  if (predicate(node)) matches.push(node);
  ts.forEachChild(node, (child) => {
    visit(child, predicate, matches);
  });
  return matches;
}

test("authenticated Badges route returns its hero and full badge collection", async () => {
  const [routeText, catalogText] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(catalogPath, "utf8"),
  ]);
  const source = ts.createSourceFile(routePath.pathname, routeText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const route = visit(source, (node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "BadgesRoute",
  )[0];
  assert.ok(route, "BadgesRoute should exist");

  const returns = visit(route, ts.isReturnStatement);
  const contentReturn = returns.find((statement) =>
    statement.expression && visit(statement.expression, ts.isJsxElement).length > 0,
  );
  assert.ok(contentReturn?.expression, "BadgesRoute should return rendered content");
  const returnedJsx = visit(contentReturn.expression, ts.isJsxElement)[0];
  assert.ok(returnedJsx, "the return expression should contain JSX");

  const returnedComponents = visit(returnedJsx, (node) =>
    ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node),
  ).map((element) => element.tagName.getText(source));
  assert.ok(returnedComponents.includes("BadgeHero"), "the route should render BadgeHero");
  assert.ok(returnedComponents.includes("BadgesPage"), "the route should render BadgesPage");
  assert.match(returnedJsx.getText(source), /<BadgesPage\s+initialData=\{initialData\}\s+initialError=\{initialError\}\s*\/>/);
  assert.doesNotMatch(routeText, /<AppShell\b/, "the authenticated layout owns the persistent shell");

  assert.equal((catalogText.match(/define\(\{ id:/g) ?? []).length, 18);
  assert.match(routeText, /BADGE_CATALOG\.map\(\(definition\)/, "all catalog definitions should be passed into page data");
  assert.match(routeText, /const unlocked = Boolean\(award\)/, "earned badges should retain their unlocked state");
  assert.match(routeText, /alreadyEarned: unlocked/, "locked and unlocked states should be forwarded to the page");
  assert.match(routeText, /getBadgeImagePath\(definition\.id, unlocked\)/, "each state should receive its matching badge image");
});
