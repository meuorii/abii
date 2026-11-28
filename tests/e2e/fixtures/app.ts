import { readFile } from "node:fs/promises";
import { test as base, expect, type Page } from "@playwright/test";

export type FixtureData = { baseURL: string; token: string; subjectId: string; topicId: string; folderId: string; subjectFolderId: string };
type AppFixture = { learnerPage: Page };

export async function readFixture(): Promise<FixtureData> {
  return JSON.parse(await readFile(".playwright/fixture.json", "utf8")) as FixtureData;
}

export const test = base.extend<AppFixture>({
  learnerPage: async ({ page }, use) => {
    const fixture = await readFixture();
    await page.context().addCookies([{ name: "abii_session", value: fixture.token, url: fixture.baseURL, httpOnly: true, sameSite: "Strict" }]);
    // Playwright's `use` continues the test and then returns control here for fixture teardown.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };

export async function waitForLearnerRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main", { name: "Application content" })).toBeVisible();
  await expect(page.locator("main .abii-page-hero")).toBeVisible();
  await expect(page.locator("main .abii-page-hero h1").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
