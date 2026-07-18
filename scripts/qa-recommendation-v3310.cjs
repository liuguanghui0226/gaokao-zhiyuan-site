#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.GAOKAO_QA_URL || "http://127.0.0.1:4188/";
const outputDir = path.resolve(process.env.GAOKAO_QA_OUTPUT || "docs/evidence/v3310");
const browserExecutable = process.env.GAOKAO_QA_BROWSER || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].find((candidate) => fs.existsSync(candidate));

const scenarios = [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
];

async function runScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: 1,
    locale: "zh-CN",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || "failed"}`);
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector("#generatedAt")?.textContent !== "正在载入资料", null, { timeout: 120_000 });
  await page.locator('[data-view="recommend"]').click();
  await page.locator("#recommendForm").waitFor({ state: "visible", timeout: 30_000 });

  await page.locator("#scoreInput").fill("605");
  await page.locator("#rankInput").fill("17798");
  await page.locator("#provinceInput").fill("江西");
  await page.locator("#subjectInput").selectOption({ label: "物理类" });
  await page.locator("#disciplineFocus").selectOption({ value: "08" });
  await page.locator("#interestInput").fill("计算机科学与技术");
  await page.locator("#cityInput").fill("杭州");
  await page.locator('#recommendForm button[type="submit"]').click();

  await page.waitForFunction(() => {
    const text = document.querySelector("#view-recommend")?.innerText || "";
    return text.includes("杭州电子科技大学") && text.includes("招生数3");
  }, null, { timeout: 120_000 });

  const result = await page.locator("#view-recommend").innerText();
  assert.match(result, /杭州电子科技大学/);
  assert.match(result, /计算机科学与技术/);
  assert.match(result, /最低分605/);
  assert.match(result, /招生数3/);
  assert.match(result, /学校官网单校最低分：位次待补，仅作候选复核/);
  assert.match(result, /不能单独推断录取概率|不能独立判断录取概率|不能独立推断录取概率|不能判断录取概率/);
  assert.doesNotMatch(result, /录取概率\s*[:：]?\s*\d/);
  assert.doesNotMatch(result, /概率[^\n]{0,12}\d+(?:\.\d+)?%/);

  const renderedSchoolChips = await page.locator(".school-sample-list span").count();
  assert.equal(renderedSchoolChips, 25);
  assert.match(result, /另有 10,514 所院校已入库，推荐时按省份加载/);

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

  const hduOptions = page.locator(".school-option").filter({ hasText: "杭州电子科技大学" });
  const hduOptionCount = await hduOptions.count();
  assert.ok(hduOptionCount > 0);
  await hduOptions.first().scrollIntoViewIfNeeded();
  const screenshotPath = path.join(outputDir, `${scenario.name}-recommendation.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const finalUrl = page.url();
  await context.close();

  return {
    name: scenario.name,
    viewport: scenario.viewport,
    finalUrl,
    screenshotPath: path.relative(process.cwd(), screenshotPath),
    screenshotBytes: fs.statSync(screenshotPath).size,
      layout,
      renderedSchoolChips,
      hduOptionCount,
    assertions: {
      school: "杭州电子科技大学",
      major: "计算机科学与技术",
      minScore: 605,
      admittedCount: 3,
      rankClaim: "unavailable",
      numericProbabilityClaim: false,
    },
  };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  });
  try {
    const results = [];
    for (const scenario of scenarios) results.push(await runScenario(browser, scenario));
    const report = {
      status: "ok",
      generatedAt: new Date().toISOString(),
      baseUrl,
      profile: {
        province: "江西",
        subject: "物理类",
        score: 605,
        rank: 17798,
        disciplineFocus: "08 工学",
        interest: "计算机科学与技术",
        city: "杭州",
      },
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
