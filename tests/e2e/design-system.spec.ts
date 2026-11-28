import { mkdir } from "node:fs/promises";
import { test, expect, waitForLearnerRoute } from "./fixtures/app";

test("@phase1 learner surfaces use the approved computed palette and type tokens", async ({ learnerPage }) => {
  await learnerPage.setViewportSize({ width: 1440, height: 900 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  await expect(learnerPage.locator(".abii-page-hero .abii-hero-heading")).toBeVisible();
  const styles = await learnerPage.evaluate(() => {
    const style = (selector: string, property: string) => {
      const element = document.querySelector(selector);
      return element ? (getComputedStyle(element) as unknown as Record<string, string>)[property] ?? null : null;
    };
    return {
      frame: style(".learner-theme", "backgroundColor"),
      workspace: style(".learner-theme > div", "backgroundColor"),
      header: style(".learner-theme header", "backgroundColor"),
      wordmark: style(".learner-theme .font-brand", "color"),
      activeNav: style(".learner-theme aside nav a[aria-current='page']", "color"),
      activeNavIcon: style(".learner-theme aside nav a[aria-current='page'] svg", "color"),
      activeNavBackground: style(".learner-theme aside nav a[aria-current='page']", "backgroundColor"),
      inactiveNav: style(".learner-theme aside nav a:not([aria-current='page'])", "color"),
      hero: style(".abii-page-hero", "backgroundColor"),
      heroBorder: style(".abii-page-hero", "borderTopColor"),
      heroText: style(".abii-hero-heading", "color"),
      heroFont: style(".abii-hero-heading", "fontFamily"),
      secondaryText: style(".abii-page-hero__eyebrow > *", "color"),
      card: style("main section.bg-white", "backgroundColor"),
    };
  });
  expect(styles).toMatchObject({
    frame: "rgb(255, 244, 248)", workspace: "rgb(255, 249, 252)", header: "rgb(255, 249, 252)",
    wordmark: "rgb(248, 118, 156)", activeNav: "rgb(248, 118, 156)", activeNavIcon: "rgb(248, 118, 156)",
    activeNavBackground: "rgb(255, 232, 239)", inactiveNav: "rgb(111, 89, 100)",
    hero: "rgb(255, 232, 239)", heroBorder: "rgb(232, 221, 225)", heroText: "rgb(48, 38, 43)",
    secondaryText: "rgb(111, 89, 100)", card: "rgb(255, 255, 255)",
  });
  expect(styles.heroFont).toContain("Onest");
  await expect(learnerPage.locator("main a[href^='/review/setup']").first()).toBeVisible();
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/refined-dashboard-1440.png", fullPage: true });
});

test("@phase1 learner primary action uses brand hover and pressed states", async ({ learnerPage }) => {
  await learnerPage.goto("/design-system", { waitUntil: "domcontentloaded" });
  const primary = learnerPage.getByRole("link", { name: "Explore the system" });
  await expect(primary).toBeVisible();
  await primary.hover();
  await expect.poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(236, 101, 141)");
  await learnerPage.mouse.down();
  await expect.poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(217, 84, 125)");
  await learnerPage.mouse.up();
});

test("@phase1 destructive confirmation retains warning intent with a pink primary action", async ({ learnerPage }) => {
  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await waitForLearnerRoute(learnerPage, "/settings");
  const trigger = learnerPage.getByRole("button", { name: "Clear", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = learnerPage.getByRole("alertdialog", { name: "Clear Study History?" });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Clear Study History" });
  await expect.poll(() => confirm.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(248, 118, 156)");
  await expect(dialog).toHaveAttribute("aria-describedby", /.+/);
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/destructive-confirmation-390.png", fullPage: true });
  await learnerPage.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
