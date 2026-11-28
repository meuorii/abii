import { mkdir } from "node:fs/promises";
import { expect, readFixture, test, waitForLearnerRoute } from "./fixtures/app";

test("@phase2 dashboard uses independent stats, the study-first order, and responsive layouts", async ({ learnerPage }) => {
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.setViewportSize({ width: 1440, height: 900 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await learnerPage.setViewportSize({ width, height: 900 });
    await expect(learnerPage.locator('[aria-label="Study statistics"]')).toBeVisible();
    await expect(learnerPage.locator('[aria-label="Study statistics"] article')).toHaveCount(4);
    await expect(learnerPage.getByRole("heading", { name: "Today’s Review" })).toBeVisible();
    await expect(learnerPage.getByRole("heading", { name: "Weekly Activity" })).toBeVisible();
    await expect(learnerPage.locator("#subjects-heading")).toBeVisible();
    await expect(learnerPage.locator('section[aria-labelledby="dashboard-featured-title"] h2')).toBeVisible();
    await expect(learnerPage.getByRole("heading", { name: "Quick Actions" })).toHaveCount(0);
    expect(await learnerPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440) {
      await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/dashboard-v2-1440.png", fullPage: true });
      await learnerPage.locator("#authenticated-main").evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await learnerPage.waitForTimeout(450);
      await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/dashboard-v2-1440-lower.png", fullPage: true });
      await learnerPage.locator("#authenticated-main").evaluate((el) => { el.scrollTop = 0; });
    }
    if (width === 390) await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/dashboard-v2-390.png", fullPage: true });
  }
});

test("@phase2 new learner sees genuine empty dashboard guidance", async ({ learnerPage }) => {
  const fixture = await readFixture();
  await learnerPage.context().addCookies([{ name: "abii_session", value: fixture.emptyToken, url: fixture.baseURL, httpOnly: true, sameSite: "Strict" }]);
  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  await expect(learnerPage.getByRole("link", { name: "Add Study Materials" })).toHaveAttribute("href", "/subjects");
  await expect(learnerPage.getByRole("heading", { name: "Your study library starts here" })).toBeVisible();
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/dashboard-v2-empty-state.png", fullPage: true });
  await learnerPage.locator("#authenticated-main").evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await learnerPage.waitForTimeout(450);
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/dashboard-v2-empty-state-lower.png", fullPage: true });
});

test("@phase2 review actions preserve due-only and custom review routes", async ({ learnerPage }) => {
  await learnerPage.setViewportSize({ width: 1440, height: 900 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  const due = learnerPage.getByRole("link", { name: /Start Due Review/ });
  await expect(due).toHaveAttribute("href", "/review/setup?reviewFilter=due");
  await expect(learnerPage.getByRole("link", { name: "Custom Review" })).toHaveAttribute("href", "/review/setup");
});

test("@phase2 learner destructive modal keeps responsive footer geometry and dismissal", async ({ learnerPage }) => {
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await waitForLearnerRoute(learnerPage, "/settings");
  const trigger = learnerPage.getByRole("button", { name: "Clear", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  let dialog = learnerPage.getByRole("alertdialog", { name: "Clear Study History?" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/shared-modal-v2-desktop.png", fullPage: false });
  const confirm = dialog.getByRole("button", { name: "Clear Study History" });
  await expect.poll(() => confirm.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(248, 118, 156)");
  const actions = dialog.locator("footer > button");
  expect(await actions.nth(0).evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(await actions.nth(1).evaluate((el) => Math.round(el.getBoundingClientRect().width)));
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/shared-modal-v2-destructive.png", fullPage: false });
  await learnerPage.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  dialog = learnerPage.getByRole("alertdialog", { name: "Clear Study History?" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/shared-modal-v2-390.png", fullPage: false });
  await learnerPage.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await waitForLearnerRoute(learnerPage, "/subjects");
  await learnerPage.waitForLoadState("networkidle");
  const addSubject = learnerPage.getByRole("button", { name: "Add Subject", exact: true });
  await addSubject.scrollIntoViewIfNeeded();
  await addSubject.click();
  let formDialog = learnerPage.getByRole("dialog", { name: "Create a Subject" });
  await expect(formDialog).toBeVisible();
  await formDialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/shared-form-modal-v2-desktop.png", fullPage: false });
  await learnerPage.keyboard.press("Escape");
  await expect(formDialog).toBeHidden();

  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await addSubject.click();
  formDialog = learnerPage.getByRole("dialog", { name: "Create a Subject" });
  await expect(formDialog).toBeVisible();
  await formDialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/shared-form-modal-v2-390.png", fullPage: false });
  await learnerPage.keyboard.press("Escape");
  await expect(formDialog).toBeHidden();
});
