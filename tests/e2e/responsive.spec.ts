import { expect, readFixture, test, waitForLearnerRoute } from "./fixtures/app";

const cases: Array<{ width: number; route: string }> = [
  ...[320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560].flatMap((width) => ["/dashboard", "/subjects", "/review", "/progress"].map((route) => ({ width, route }))),
  ...[320, 390, 768, 1440].map((width) => ({ width, route: "/settings" })),
  ...[390, 1440].map((width) => ({ width, route: "/badges" })),
];

for (const { width, route } of cases) {
  test(`@phase1 ${route} fits ${width}px without overflow or clipped hero text`, async ({ learnerPage }) => {
    await learnerPage.setViewportSize({ width, height: width < 400 ? 740 : 900 });
    await waitForLearnerRoute(learnerPage, route);
    if (route === "/settings") {
      await expect(learnerPage.getByRole("status", { name: "Loading notification preferences" })).toBeHidden();
    }
    const result = await learnerPage.evaluate(() => {
      const root = document.querySelector("main[data-authenticated-motion]");
      const hero = document.querySelector(".abii-page-hero");
      const heading = hero?.querySelector(".abii-hero-heading");
      const heroRect = hero?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflow: root ? root.scrollWidth - root.clientWidth : Infinity,
        headingClipped: Boolean(heading && heading.scrollWidth > heading.clientWidth + 1),
        headingOutsideHero: Boolean(heroRect && headingRect && (headingRect.left < heroRect.left - 1 || headingRect.right > heroRect.right + 1)),
        overflowElements: root ? Array.from(root.querySelectorAll("*")).map((element) => {
          const rect = element.getBoundingClientRect();
          return { tag: element.tagName, className: typeof element.className === "string" ? element.className : "", text: element.textContent?.trim().slice(0, 45), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
        }).filter((item) => item.width > item.clientWidth + 1 || item.left < root.getBoundingClientRect().left - 1 || item.right > root.getBoundingClientRect().right + 1).sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth)).slice(0, 8) : [],
      };
    });
    expect(result.documentOverflow, `${route} document overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(result.mainOverflow, `${route} main overflow at ${width}px: ${JSON.stringify(result.overflowElements)}`).toBeLessThanOrEqual(1);
    expect(result.headingClipped, `${route} hero heading clips at ${width}px`).toBe(false);
    expect(result.headingOutsideHero, `${route} hero heading escapes at ${width}px`).toBe(false);
    if (width < 1024) await expect(learnerPage.getByRole("navigation", { name: "Mobile bottom navigation" })).toBeVisible();
    else await expect(learnerPage.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  });
}

test("@phase1 long synthetic subject and topic names wrap without clipping", async ({ learnerPage }) => {
  const fixture = await readFixture();
  for (const width of [320, 390, 768, 1440]) {
    await learnerPage.setViewportSize({ width, height: width < 400 ? 740 : 900 });
    for (const route of ["/subjects/" + fixture.subjectId, "/subjects/" + fixture.subjectId + "/topics/" + fixture.topicId]) {
      await waitForLearnerRoute(learnerPage, route);
      const heading = learnerPage.locator(".abii-page-hero .abii-hero-heading").first();
      await expect(heading).toBeVisible();
      expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  }
});
