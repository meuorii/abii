import { mkdir } from "node:fs/promises";
import { expect, readFixture, test, waitForLearnerRoute } from "./fixtures/app";

const heroCases = [
  ["/dashboard", "main", 40, 24],
  ["/subjects", "main", 40, 24],
  ["/review", "main", 40, 24],
  ["/progress", "main", 40, 24],
  ["/badges", "main", 40, 24],
  ["/settings", "main", 40, 24],
  ["/profile", "main", 40, 24],
  ["/review/setup", "main", 40, 24],
] as const;

test("@phase1 learner hero categories use consistent desktop and mobile typography", async ({ learnerPage }) => {
  test.setTimeout(180_000);
  const fixture = await readFixture();
  const routes = [...heroCases, ["/subjects/" + fixture.subjectId, "main", 40, 24] as const];
  for (const width of [1440, 390]) {
    await learnerPage.setViewportSize({ width, height: 900 });
    for (const [route, role, desktopSize, mobileSize] of routes) {
      await waitForLearnerRoute(learnerPage, route);
      const hero = learnerPage.locator(".abii-page-hero");
      const heading = hero.locator(".abii-hero-heading").first();
      await expect(heading).toBeVisible();
      await expect(hero).toHaveAttribute("data-heading-size", role);
      const measurement = await heading.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { fontSize: Number.parseFloat(getComputedStyle(element).fontSize), fontFamily: getComputedStyle(element).fontFamily, width: element.clientWidth, scrollWidth: element.scrollWidth, left: bounds.left, right: bounds.right };
      });
      expect(measurement.fontSize, `${route} ${role} hero at ${width}px`).toBe(width < 640 ? mobileSize : desktopSize);
      expect(measurement.fontFamily).toContain("Onest");
      expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.width + 1);
      await expect(hero.locator("img")).toBeVisible();
    }
  }
  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  await learnerPage.evaluate(async () => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-dashboard-390.png" });
  await waitForLearnerRoute(learnerPage, "/subjects");
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-subjects-390.png" });
  await learnerPage.setViewportSize({ width: 1440, height: 900 });
  await waitForLearnerRoute(learnerPage, "/dashboard");
  await learnerPage.evaluate(async () => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-dashboard-1440.png" });
  await waitForLearnerRoute(learnerPage, "/subjects");
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-subjects-1440.png" });
  await waitForLearnerRoute(learnerPage, "/review");
  await learnerPage.evaluate(async () => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-review-1440.png" });
  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}`);
  await learnerPage.evaluate(async () => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-subject-detail-390.png" });
  await waitForLearnerRoute(learnerPage, "/settings");
  await learnerPage.evaluate(async () => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  await learnerPage.locator(".abii-page-hero").screenshot({ path: "docs/ABII_V2/evidence/hero-final-settings-390.png" });
});

test("@phase1 learner heroes share the global responsive surface and dimensions", async ({ learnerPage }) => {
  test.setTimeout(300_000);
  const fixture = await readFixture();
  const routes = ["/dashboard", "/subjects", "/review", "/progress", "/badges", "/settings", "/profile", "/review/setup", `/subjects/folders/${fixture.subjectFolderId}`, `/subjects/${fixture.subjectId}`, `/subjects/${fixture.subjectId}/folders/${fixture.folderId}`, `/subjects/${fixture.subjectId}/topics/${fixture.topicId}`];
  const coreRoutes = ["/dashboard", "/subjects", "/review", "/review/setup", `/subjects/${fixture.subjectId}`];
  for (const width of [390, 1440, 320, 768, 1024]) {
    await learnerPage.setViewportSize({ width, height: 900 });
    const heights: Array<{ route: string; height: number }> = [];
    for (const route of width === 390 || width === 1440 ? routes : coreRoutes) {
      await waitForLearnerRoute(learnerPage, route);
      const hero = learnerPage.locator(".abii-page-hero");
      await expect(hero.locator("img")).toBeVisible();
      expect(await hero.evaluate((element) => getComputedStyle(element).backgroundColor), `${route} background at ${width}px`).toBe("rgb(255, 232, 239)");
      await expect(hero.locator("button, a, input, [role='progressbar'], svg")).toHaveCount(0);
      const metrics = await hero.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const image = element.querySelector(".abii-page-hero__mascot")!.getBoundingClientRect();
        const cropFrame = element.querySelector(".abii-page-hero__mascot-motion")!;
        const cropRect = cropFrame.getBoundingClientRect();
        const imageElement = element.querySelector(".abii-page-hero__mascot-motion img") as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable for checking mascot alpha bounds");
        context.drawImage(imageElement, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let alphaLeft = canvas.width;
        let alphaTop = canvas.height;
        let alphaRight = 0;
        let alphaBottom = 0;
        for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 128) { alphaLeft = Math.min(alphaLeft, x); alphaTop = Math.min(alphaTop, y); alphaRight = Math.max(alphaRight, x + 1); alphaBottom = Math.max(alphaBottom, y + 1); }
        }
        const renderedImage = imageElement.getBoundingClientRect();
        const visibleAlpha = {
          left: renderedImage.left + alphaLeft * renderedImage.width / canvas.width,
          top: renderedImage.top + alphaTop * renderedImage.height / canvas.height,
          right: renderedImage.left + alphaRight * renderedImage.width / canvas.width,
          bottom: renderedImage.top + alphaBottom * renderedImage.height / canvas.height,
        };
        const text = element.querySelector(".abii-page-hero__content")!.getBoundingClientRect();
        return { height: Math.round(rect.height), width: rect.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, imageBottom: image.bottom, imageHeight: cropRect.height, heroHeight: rect.height, textRight: text.right, imageLeft: image.left, bottom: rect.bottom, alphaOffset: { left: visibleAlpha.left - cropRect.left, top: visibleAlpha.top - cropRect.top, right: cropRect.right - visibleAlpha.right, bottom: cropRect.bottom - visibleAlpha.bottom } };
      });
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.imageBottom).toBeLessThanOrEqual(metrics.bottom + 1);
      expect(metrics.imageHeight).toBeGreaterThanOrEqual(metrics.heroHeight * (width < 640 ? 0.84 : 0.87));
      expect(metrics.textRight).toBeLessThanOrEqual(metrics.imageLeft + 1);
      expect(metrics.alphaOffset.left).toBeGreaterThanOrEqual(-2);
      expect(metrics.alphaOffset.left).toBeLessThanOrEqual(2);
      expect(metrics.alphaOffset.top).toBeGreaterThanOrEqual(-2);
      expect(metrics.alphaOffset.top).toBeLessThanOrEqual(2);
      expect(metrics.alphaOffset.right).toBeGreaterThanOrEqual(-2);
      expect(metrics.alphaOffset.right).toBeLessThanOrEqual(2);
      expect(metrics.alphaOffset.bottom).toBeGreaterThanOrEqual(-2);
      expect(metrics.alphaOffset.bottom).toBeLessThanOrEqual(2);
      if (route === "/dashboard") await expect(learnerPage.locator("main a[href^='/review/setup']").first()).toBeVisible();
      if (route === "/review") await expect(learnerPage.getByRole("link", { name: "Start a new review" })).toBeVisible();
      if (route.startsWith(`/subjects/folders/`)) await expect(learnerPage.getByRole("button", { name: /Add subject/i }).first()).toBeVisible();
      if (route === `/subjects/${fixture.subjectId}`) await expect(learnerPage.getByRole("link", { name: /Study Subject/ })).toBeVisible();
      if (route.includes("/folders/") && route.startsWith(`/subjects/${fixture.subjectId}/`)) await expect(learnerPage.getByRole("button", { name: "Add Topic" }).first()).toBeVisible();
      if (route === "/dashboard" || route === "/subjects" || route === "/review") heights.push({ route, height: metrics.height });
    }
    const expected = width < 640 ? 180 : width < 1024 ? 240 : 280;
    expect(heights.every((item) => item.height >= expected), `core hero minimum sizes at ${width}px: ${JSON.stringify(heights)}`).toBe(true);
  }
});

test("@phase1 Progress scroll reveal resolves at 768px with natural motion", async ({ learnerPage }) => {
  await learnerPage.setViewportSize({ width: 768, height: 820 });
  await learnerPage.emulateMedia({ reducedMotion: "no-preference" });
  await waitForLearnerRoute(learnerPage, "/progress");
  const target = learnerPage.getByRole("heading", { name: "Achievement Showcase" });
  await expect(target).toBeVisible();
  await target.evaluate((element) => {
    const root = element.closest("main[data-authenticated-motion]");
    if (!root) throw new Error("Progress scroll root was not found");
    const rootBounds = root.getBoundingClientRect();
    const targetBounds = element.getBoundingClientRect();
    const top = root.scrollTop + targetBounds.top - rootBounds.top - root.clientHeight * 0.45;
    root.scrollTo({ top, behavior: "instant" });
  });
  const reveal = target.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' abii-motion-reveal ')]").first();
  await expect.poll(() => reveal.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))).toBe(1);
  const scrollRoot = await learnerPage.locator("main[data-authenticated-motion]").evaluate((element) => ({ top: element.scrollTop, height: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(scrollRoot.scrollHeight).toBeGreaterThan(scrollRoot.height);
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/progress-showcase-768.png" });
  await learnerPage.setViewportSize({ width: 768, height: 820 });
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/progress-768.png", fullPage: true });
});

test("@phase1 reduced motion keeps learner reveal content visible", async ({ learnerPage }) => {
  await learnerPage.emulateMedia({ reducedMotion: "reduce" });
  await waitForLearnerRoute(learnerPage, "/progress");
  const hidden = await learnerPage.locator("main .abii-motion-reveal").evaluateAll((elements) => elements.filter((element) => Number.parseFloat(getComputedStyle(element).opacity) < 1).map((element) => element.textContent?.trim().slice(0, 60)));
  expect(hidden).toEqual([]);
});

