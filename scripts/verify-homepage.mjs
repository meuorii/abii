import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Uses separately installed Playwright tooling; adds no application dependency.
// PLAYWRIGHT_MODULE may point to its index.mjs. Run against `npm run start`.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = process.env.HOMEPAGE_REVIEW_DIR || join(tmpdir(), 'abii-homepage-review');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
try {
  for (const width of [1440,1280,1024,768,430,390,375,320]) {
    await page.setViewportSize({width,height:900});
    await page.goto(process.env.HOMEPAGE_URL || 'http://localhost:3000', {waitUntil:'networkidle'});
    await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) { image.loading='eager'; await image.decode().catch(() => {}); } });
    assert.equal(await page.locator('main > section').count(),5);
    assert.equal(await page.locator('h1').count(),1);
    const layout = await page.evaluate(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,sections:[...document.querySelectorAll('main > section')].map(el=>{ const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,width:r.width,height:r.height};}),broken:[...document.images].filter(el=>!el.naturalWidth).map(el=>el.src), fakeLinks:document.querySelectorAll('a[href="#"]').length}));
    assert.ok(layout.scrollWidth<=width, `Overflow at ${width}`);
    assert.deepEqual(layout.broken,[]);
    assert.equal(layout.fakeLinks,0);
    await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
    if(width===1440) { assert.equal(layout.sections[1].x,160); assert.equal(layout.sections[1].width,1120); }
    if(width<900) {
      const trigger=page.getByRole('button',{name:'Open navigation menu'});
      await trigger.click();
      if (width===390) {
        await page.locator('#landing-mobile-menu').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
        await page.screenshot({path:`${output}/390-menu.png`});
      }
      assert.equal(await page.locator('#landing-mobile-menu a').first().evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'),'false');
      assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
      await trigger.click();
      await page.locator('#landing-mobile-menu').getByRole('link',{name:'Features',exact:true}).click();
      assert.equal(await trigger.getAttribute('aria-expanded'),'false');
      await page.waitForFunction(()=>document.activeElement?.id==='features');
    }
    results.push(layout);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(process.env.HOMEPAGE_URL || 'http://localhost:3000');
  assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el.parentElement).animationName),'none');
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/results.json`,JSON.stringify({results,errors,menu:'focus, Escape, selection passed',reducedMotion:'passed'},null,2));
  console.log(`Passed all eight widths, asset loading, section count, grid, menu focus/Escape/selection, reduced motion, and runtime errors. Screenshots: ${output}`);
} finally { await browser.close(); }
