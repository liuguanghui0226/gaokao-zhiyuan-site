#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.GAOKAO_QA_URL || "http://127.0.0.1:4316/";
const outputDir = path.resolve(process.env.GAOKAO_QA_OUTPUT || "docs/evidence/v3320");
const browserExecutable = process.env.GAOKAO_QA_BROWSER || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].find((candidate) => fs.existsSync(candidate));

const scenarios = [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
];

async function runScenario(browser, scenario) {
  const context = await browser.newContext({ viewport: scenario.viewport, deviceScaleFactor: 1, locale: "zh-CN" });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || "failed"}`));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector("#generatedAt")?.textContent !== "正在载入资料", null, { timeout: 120_000 });
  await page.locator('[data-view="recommend"]').click();
  await page.locator("#recommendForm").waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.locator("#guangxiLocalScoreField").isVisible(), false);
  assert.equal(await page.locator("#guangxiLocalRankField").isVisible(), false);

  await page.locator("#provinceInput").fill("广西");
  await page.locator("#guangxiLocalScoreField").waitFor({ state: "visible" });
  await page.locator("#guangxiLocalRankField").waitFor({ state: "visible" });
  assert.equal(await page.locator("#scoreFieldLabel").textContent(), "区外院校投档分");
  assert.equal(await page.locator("#rankFieldLabel").textContent(), "区外院校位次");
  await page.locator("#scoreInput").fill("600");
  await page.locator("#guangxiLocalScoreInput").fill("600");
  await page.locator("#subjectInput").selectOption({ label: "物理类" });
  await page.locator("#disciplineFocus").selectOption({ value: "08" });
  await page.locator("#interestInput").fill("计算机科学与技术 数字媒体技术");
  await page.locator('#recommendForm button[type="submit"]').click();

  await page.waitForFunction(() => {
    const text = document.querySelector("#view-recommend")?.innerText || "";
    return text.includes("区外院校按全国性加分表约6,442名") && text.includes("区内院校按最高加分表约6,473名");
  }, null, { timeout: 120_000 });
  const result = await page.locator("#view-recommend").innerText();
  assert.match(result, /区外院校按全国性加分表约6,442名/);
  assert.match(result, /区内院校按最高加分表约6,473名/);
  assert.doesNotMatch(result, /录取概率\s*[:：]?\s*\d/);

  const layout = await page.evaluate(() => ({
    documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    bodyOverflow: Math.max(0, document.body.scrollWidth - document.documentElement.clientWidth),
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(layout.documentOverflow, 0);
  assert.equal(layout.bodyOverflow, 0);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);

  await page.locator("#scoreFieldLabel").evaluate((element) => {
    window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 80), behavior: "instant" });
  });
  const screenshotPath = path.join(outputDir, `${scenario.name}-guangxi-rank.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await context.close();
  return {
    name: scenario.name,
    viewport: scenario.viewport,
    screenshotPath: path.relative(process.cwd(), screenshotPath),
    screenshotBytes: fs.statSync(screenshotPath).size,
    layout,
    estimates: { outsideGuangxi: 6442, insideGuangxi: 6473 },
  };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
  try {
    const results = [];
    for (const scenario of scenarios) results.push(await runScenario(browser, scenario));
    const report = {
      status: "ok",
      generatedAt: new Date().toISOString(),
      baseUrl,
      profile: { province: "广西", subject: "物理类", outsideScore: 600, insideScore: 600, disciplineFocus: "08 工学" },
      results,
    };
    fs.writeFileSync(path.join(outputDir, "browser-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
