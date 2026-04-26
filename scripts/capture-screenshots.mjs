// Capture README screenshots from the live site.
// Run: `node scripts/capture-screenshots.mjs`
// Outputs to `docs/screenshots/`.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "docs", "screenshots");
const URL = process.env.PAPERWORK_URL ?? "https://passage.gudman.xyz/";

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3 };

await mkdir(OUT, { recursive: true });

async function shot(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false, type: "png" });
  console.log("  saved", name);
}

async function shotFull(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: true, type: "png" });
  console.log("  saved", name, "(full page)");
}

async function clickByText(page, text) {
  // Find an element whose visible text contains `text` and click it.
  const el = page.getByText(text, { exact: false }).first();
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
      } catch {}
    }
  }, theme);
}

async function captureSet(browser, viewport, prefix) {
  console.log(`\n[${prefix}] viewport=${viewport.width}x${viewport.height}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.deviceScaleFactor });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);

  // 1) Homepage hero — light mode
  await page.goto(URL, { waitUntil: "networkidle" });
  await setTheme(page, "light");
  await page.waitForTimeout(2200); // let the verifier-preview animation finish
  await shot(page, `${prefix}-01-hero-light.png`);

  // 2) Same hero — dark mode
  await setTheme(page, "dark");
  await page.waitForTimeout(800);
  await shot(page, `${prefix}-02-hero-dark.png`);

  // 3) Full landing page (light)
  await setTheme(page, "light");
  await page.waitForTimeout(800);
  await shotFull(page, `${prefix}-03-landing-full-light.png`);

  // 4) Load UK demo → response stage with citation panel
  await setTheme(page, "light");
  await page.evaluate(() => window.scrollTo(0, 0));
  const ukBtn = page
    .locator("button", { hasText: /Universal Credit overpayment/i })
    .first();
  await ukBtn.scrollIntoViewIfNeeded();
  await ukBtn.click();
  await page.waitForSelector("text=Citation verification", { timeout: 10_000 });
  await page.waitForTimeout(800);
  // Scroll citation panel into view
  await page.locator("text=Citation verification").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, `${prefix}-04-uk-verifier-light.png`);

  // 5) Same in dark mode
  await setTheme(page, "dark");
  await page.waitForTimeout(400);
  await shot(page, `${prefix}-05-uk-verifier-dark.png`);

  // 6) Corrupted demo — mismatch row + auto-fix button
  await setTheme(page, "light");
  // Click "Start over" to go home, then load corrupted
  const startOver = page.getByRole("button", { name: /start over/i }).first();
  if (await startOver.count()) await startOver.click();
  await page.waitForSelector("text=Try first", { timeout: 10_000 });
  const corruptedBtn = page
    .locator("button", { hasText: /Verifier catches the fake/i })
    .first();
  await corruptedBtn.waitFor({ state: "visible", timeout: 10_000 });
  await corruptedBtn.scrollIntoViewIfNeeded();
  await corruptedBtn.click();
  await page.waitForSelector("text=Citation verification", { timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.locator("text=Citation verification").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, `${prefix}-06-corrupted-mismatch-light.png`);

  // 7) German demo
  if (await page.getByRole("button", { name: /start over/i }).count()) {
    await page.getByRole("button", { name: /start over/i }).first().click();
  }
  await page.waitForSelector("text=Try first", { timeout: 10_000 });
  const deBtn = page
    .locator("button", { hasText: /Bürgergeld|Aufhebungs/i })
    .first();
  await deBtn.waitFor({ state: "visible", timeout: 10_000 });
  await deBtn.scrollIntoViewIfNeeded();
  await deBtn.click();
  await page.waitForSelector("text=Citation verification", { timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.locator("text=Citation verification").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, `${prefix}-07-german-verifier-light.png`);

  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await captureSet(browser, DESKTOP, "desktop");
  await captureSet(browser, MOBILE, "mobile");
} finally {
  await browser.close();
}
console.log("\n done. all screenshots in", OUT);
