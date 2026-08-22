#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const source = fs.readFileSync(appFile, "utf8");
const payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const view = { innerHTML: "" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderGeography, state, geographySummaryMetrics };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#view-geography") return view;
      throw new Error(`Unexpected selector in geography render test: ${selector}`);
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.state.geographyData = payload;
context.__gaokaoTest.state.query = "";
context.__gaokaoTest.state.geographyCourse = "";
const metrics = context.__gaokaoTest.geographySummaryMetrics(payload);
assert.equal(metrics.courses, 5);
assert.equal(metrics.items, 97);
assert.equal(metrics.sources, 28);
assert.equal(metrics.authoredSummaries, 38);
assert.equal(metrics.citationOnlyItems, 59);

context.__gaokaoTest.renderGeography();
assert.match(view.innerHTML, /data-geography-version="geo-2026\.08\.22\.5"/);
assert.match(view.innerHTML, /资料边界与更新/);
assert.match(view.innerHTML, /资料版本 geo-2026\.08\.22\.5/);
assert.match(view.innerHTML, /引文型方法卡/);
assert.match(view.innerHTML, /全部课程 · 97/);
assert.match(view.innerHTML, /地理必修第一册 · 14/);
assert.match(view.innerHTML, /地理必修第二册 · 20/);
assert.match(view.innerHTML, /选择性必修1 自然地理基础 · 25/);
assert.match(view.innerHTML, /选择性必修2 区域发展 · 18/);
assert.match(view.innerHTML, /选择性必修3 资源、环境与国家安全 · 20/);
assert.match(view.innerHTML, /97 条摘要/);

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  sources: metrics.sources,
  authoredSummaries: metrics.authoredSummaries,
  citationOnlyItems: metrics.citationOnlyItems,
}, null, 2));
