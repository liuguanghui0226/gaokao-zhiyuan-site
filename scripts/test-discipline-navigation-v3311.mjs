#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const html = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "site/assets/styles.css"), "utf8");
const catalog = app.match(/const DISCIPLINE_MAJOR_CATALOG = \{([\s\S]*?)\n\};\n\nconst HIGH_TUITION_THRESHOLD/)?.[1] || "";

assert.ok(catalog, "discipline catalog missing");
for (let code = 1; code <= 14; code += 1) {
  const key = String(code).padStart(2, "0");
  assert.match(catalog, new RegExp(`"${key}"\\s*:\\s*\\[`), `discipline ${key} missing`);
}

for (const expected of [
  "计算机科学与技术",
  "数字媒体技术",
  "临床医学",
  "汉语言文学",
  "数学与应用数学",
  "会计学",
]) {
  assert.ok(catalog.includes(expected), `${expected} missing from catalog`);
}

for (const interaction of [
  'data-discipline-code',
  'data-family-key',
  'id="disciplineRecommend"',
  'state.prefillProfile',
  'updateView("recommend")',
]) {
  assert.ok(app.includes(interaction), `${interaction} interaction missing`);
}

assert.ok(app.includes('renderAdmissionScoreSummary()'), "compact admission summary not rendered");
assert.ok(app.includes('sectionHead("院校专业推荐")'), "recommendation title not updated");
assert.ok(app.includes("<span>考生类型</span>"), "formal candidate label missing");
assert.ok(css.includes(".recommend-form [hidden]"), "province-specific hidden fields can leak into the form");
assert.ok(html.includes("全国高考志愿填报"), "site title not updated");
assert.ok(html.includes("app.js?v=3.311.0"), "v3.311 asset version missing");
assert.ok(!html.includes("全国高考志愿智能推荐"), "old AI-style brand remains");
assert.ok(!app.includes('sectionHead("智能推荐"'), "old recommendation heading remains");
assert.ok(!app.includes("告诉我孩子是什么类型"), "dialogue-style prompt remains");
assert.ok(!css.includes("font-size: 11px"), "11px text remains");
assert.ok(!css.includes("font-size: 12px"), "12px text remains");

console.log(JSON.stringify({
  status: "ok",
  disciplines: 14,
  interaction: "discipline -> family -> major -> recommendation",
  assetVersion: "3.311.0",
}, null, 2));
