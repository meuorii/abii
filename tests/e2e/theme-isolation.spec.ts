import { mkdir } from "node:fs/promises";
import { expect, test, waitForLearnerRoute } from "./fixtures/app";

test("@phase1 learner font and hero styling stay inside learner surfaces", async ({ browser, learnerPage }) => {
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto("/");
  await expect(publicPage.locator(".learner-theme")).toHaveCount(0);
  await expect(publicPage.locator("main h1").first()).toBeVisible();
  const publicHeroFont = await publicPage.locator("main h1").first().evaluate((element) => getComputedStyle(element).fontFamily);
  expect(publicHeroFont).toContain("Onest");
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await publicPage.screenshot({ path: "docs/ABII_V2/evidence/public-home.png", fullPage: true });

  await publicPage.goto("/login");
  await expect(publicPage.locator(".learner-theme")).toHaveCount(0);
  await expect(publicPage.getByRole("heading").first()).toBeVisible();

  await waitForLearnerRoute(learnerPage, "/dashboard");
  await expect(learnerPage.locator(".learner-theme .abii-page-hero")).toHaveCount(1);
  await expect(learnerPage.locator(".admin-shell")).toHaveCount(0);
  await publicContext.close();
});

test("@phase1 learner notification dropdown stays usable and follows learner tokens", async ({ learnerPage }) => {
  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  const trigger = learnerPage.getByRole("button", { name: /^Notifications/ });
  await trigger.click();
  const panel = learnerPage.getByRole("region", { name: "Recent notifications" });
  await expect(panel).toBeVisible();
  const background = await panel.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toBe("rgb(255, 255, 255)");
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/notification-dropdown-390.png", fullPage: true });
  await learnerPage.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
