import { mkdir } from "node:fs/promises";
import { test, expect, readFixture, waitForLearnerRoute } from "./fixtures/app";

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
      card: style('main section[aria-labelledby="today-review-heading"]', "backgroundColor"),
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
  await learnerPage.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => undefined))));
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase02-dashboard-branding-1440.png", fullPage: true });
});

test("@phase1 learner primary action uses brand hover and pressed states", async ({ learnerPage }) => {
  await waitForLearnerRoute(learnerPage, "/dashboard");
  const primary = learnerPage.getByRole("link", { name: /Start Due Review/ });
  await expect(primary).toBeVisible();
  await primary.hover();
  await expect.poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(236, 101, 141)");
  await learnerPage.mouse.down();
  await expect.poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(217, 84, 125)");
  await learnerPage.mouse.up();
});

test("@phase02 shared checkbox preserves native states, keyboard use, and Admin tokens", async ({ learnerPage }) => {
  await learnerPage.goto("/design-system", { waitUntil: "domcontentloaded" });
  const checkedLabel = learnerPage.getByText("Checked · pink fill, white check");
  const checked = learnerPage.getByRole("checkbox").nth(0);
  await expect(checkedLabel).toBeVisible();
  await expect(checked).toBeChecked();
  const checkedStyle = await checked.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, border: style.borderTopColor, duration: style.transitionDuration, easing: style.transitionTimingFunction };
  });
  expect(checkedStyle).toEqual({ background: "rgb(248, 118, 156)", border: "rgb(248, 118, 156)", duration: "0.12s", easing: "ease" });
  const checkmarkStyle = await checked.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return { content: style.content, right: style.borderRightColor, bottom: style.borderBottomColor };
  });
  expect(checkmarkStyle).toEqual({ content: '""', right: "rgb(255, 255, 255)", bottom: "rgb(255, 255, 255)" });

  await checked.focus();
  await learnerPage.keyboard.press("Space");
  await expect(checked).not.toBeChecked();
  await expect.poll(() => checked.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await checkedLabel.click();
  await expect(checked).toBeChecked();

  const unchecked = learnerPage.getByRole("checkbox").nth(1);
  await expect(unchecked).not.toBeChecked();
  await checked.focus();
  await learnerPage.keyboard.press("Tab");
  await expect(unchecked).toBeFocused();
  const focusStyle = await unchecked.evaluate((element) => ({ outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
  expect(focusStyle).toEqual({ outline: "solid", width: "2px" });
  await unchecked.evaluate((element: HTMLInputElement) => { element.disabled = true; });
  const disabledStyle = await unchecked.evaluate((element) => ({ cursor: getComputedStyle(element).cursor, opacity: getComputedStyle(element).opacity }));
  expect(disabledStyle).toEqual({ cursor: "not-allowed", opacity: "0.55" });

  const adminThemeStyle = await checked.evaluate((element) => {
    const shell = document.createElement("div");
    shell.className = "admin-shell";
    const adminCheckbox = element.cloneNode() as HTMLInputElement;
    adminCheckbox.checked = true;
    shell.append(adminCheckbox);
    document.body.append(shell);
    const style = getComputedStyle(adminCheckbox);
    const result = { background: style.backgroundColor, border: style.borderTopColor };
    shell.remove();
    return result;
  });
  expect(adminThemeStyle).toMatchObject({ background: "rgb(248, 118, 156)", border: "rgb(248, 118, 156)" });
  expect(adminThemeStyle).toEqual({ background: "rgb(248, 118, 156)", border: "rgb(248, 118, 156)" });
  const adminCheckmark = await checked.evaluate((element) => {
    const shell = document.createElement("div");
    shell.className = "admin-shell";
    const adminCheckbox = element.cloneNode() as HTMLInputElement;
    adminCheckbox.checked = true;
    shell.append(adminCheckbox);
    document.body.append(shell);
    const style = getComputedStyle(adminCheckbox, "::after");
    const result = { content: style.content, right: style.borderRightColor, bottom: style.borderBottomColor };
    shell.remove();
    return result;
  });
  expect(adminCheckmark).toEqual({ content: '""', right: "rgb(255, 255, 255)", bottom: "rgb(255, 255, 255)" });

  await learnerPage.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).map(animation => animation.finished.catch(() => undefined))));
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.locator("#buttons").screenshot({ path: "docs/ABII_V2/evidence/phase02-checkbox-controls-1440.png" });
});

test("@phase02 authenticated route heroes share their typography and palette", async ({ learnerPage }) => {
  const fixture = await readFixture();
  await learnerPage.setViewportSize({ width: 1440, height: 900 });
  const routes = ["/dashboard", "/subjects", `/subjects/${fixture.subjectId}/topics/${fixture.topicId}`, "/review", "/progress", "/settings"];
  for (const route of routes) {
    await waitForLearnerRoute(learnerPage, route);
    const colors = await learnerPage.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).color : null;
      };
      const hero = document.querySelector(".abii-page-hero");
      return {
        heading: read(".abii-page-hero .abii-hero-heading"),
        supporting: read(".abii-page-hero__description"),
        hero: hero ? getComputedStyle(hero).backgroundColor : null,
        brand: read(".learner-theme .font-brand"),
      };
    });
    expect(colors.heading).toBe("rgb(48, 38, 43)");
    expect(colors.hero).toBe("rgb(255, 232, 239)");
    expect(colors.brand).toBe("rgb(248, 118, 156)");
    if (colors.supporting !== null) expect(colors.supporting).toBe("rgb(111, 89, 100)");
  }

  await learnerPage.goto(`/subjects/${fixture.subjectId}/topics/${fixture.topicId}`, { waitUntil: "domcontentloaded" });
  await learnerPage.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).map(animation => animation.finished.catch(() => undefined))));
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase02-nested-topic-1440.png", fullPage: true });

  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  await expect(learnerPage.getByRole("navigation", { name: "Mobile bottom navigation" }).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const mobileHero = await learnerPage.locator(".abii-page-hero").evaluate((element) => ({ height: getComputedStyle(element).minHeight, heading: getComputedStyle(element.querySelector(".abii-hero-heading")!).fontSize, overflow: document.documentElement.scrollWidth <= innerWidth }));
  expect(mobileHero).toEqual({ height: "180px", heading: "24px", overflow: true });
  await learnerPage.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).map(animation => animation.finished.catch(() => undefined))));
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase02-mobile-navigation-390.png", fullPage: true });
});

test("@phase1 destructive confirmation retains warning intent with a pink primary action", async ({ learnerPage }) => {
  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await waitForLearnerRoute(learnerPage, "/settings");
  const trigger = learnerPage.getByRole("button", { name: "Clear", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await learnerPage.waitForLoadState("networkidle");
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
