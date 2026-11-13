import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const cssDirectory = join(process.cwd(), ".next", "static", "css");
const cssFiles = (await readdir(cssDirectory)).filter((file) => file.endsWith(".css"));
assert.ok(cssFiles.length > 0, "Run next build before the skeleton browser check");
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<main class="preview"><div class="card"><div class="abii-skeleton" style="height:48px;width:100%"></div><div class="abii-skeleton" style="height:14px;width:72%"></div></div><div class="card"><div class="abii-skeleton" style="height:48px;width:100%"></div><div class="abii-skeleton" style="height:14px;width:72%"></div></div><div class="card"><div class="abii-skeleton" style="height:48px;width:100%"></div><div class="abii-skeleton" style="height:14px;width:72%"></div></div><div class="card"><div class="abii-skeleton" style="height:48px;width:100%"></div><div class="abii-skeleton" style="height:14px;width:72%"></div></div></main>`);
  for (const file of cssFiles) await page.addStyleTag({ content: await readFile(join(cssDirectory, file), "utf8") });
  await page.addStyleTag({ content: ".preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;max-width:1280px;margin:auto;padding:16px}.card{min-width:0;display:grid;gap:10px}@media(min-width:1024px){.preview{grid-template-columns:repeat(4,minmax(0,1fr))}}" });

  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
      skeletonWidth: document.querySelector(".abii-skeleton").getBoundingClientRect().width,
    }));
    assert.equal(geometry.page, geometry.viewport, `horizontal overflow at ${width}px`);
    assert.ok(geometry.skeletonWidth > 0, `skeleton is hidden at ${width}px`);
  }

  const shimmer = await page.locator(".abii-skeleton").first().evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return { name: style.animationName, duration: style.animationDuration, playState: style.animationPlayState };
  });
  assert.deepEqual(shimmer, { name: "skeleton-shimmer", duration: "2s", playState: "running" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.locator(".abii-skeleton").first().evaluate((element) => ({
    animation: getComputedStyle(element, "::after").animationName,
    fill: getComputedStyle(element).backgroundColor,
  }));
  assert.equal(reduced.animation, "none");
  assert.notEqual(reduced.fill, "rgba(0, 0, 0, 0)");
  console.log("Skeleton browser checks passed at 320, 375, 390, 430, 768, 1024, 1280, and 1440px; shimmer and reduced-motion paths passed.");
} finally {
  await browser.close();
}
