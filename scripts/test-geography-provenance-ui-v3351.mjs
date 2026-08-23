#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/geography/assets/app.js");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const source = fs.readFileSync(appFile, "utf8");
const payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const view = { innerHTML: "" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__geographyTest = { renderGeography, state, geographySummaryMetrics };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#geographyApp") return view;
      throw new Error(`Unexpected selector in geography render test: ${selector}`);
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__geographyTest.state.data = payload;
context.__geographyTest.state.query = "";
context.__geographyTest.state.course = "";
context.__geographyTest.state.sourceFilter = "all";
const metrics = context.__geographyTest.geographySummaryMetrics(payload);
assert.equal(metrics.courses, 5);
assert.equal(metrics.items, 530);
assert.equal(metrics.sources, 232);
assert.equal(metrics.authoredSummaries, 38);
assert.equal(metrics.citationOnlyItems, 492);

context.__geographyTest.renderGeography();
assert.match(view.innerHTML, /data-geography-version="geo-2026\.08\.23\.34"/);
assert.match(view.innerHTML, /资料边界与更新/);
assert.match(view.innerHTML, /资料版本 geo-2026\.08\.23\.34/);
assert.match(view.innerHTML, /引文型方法卡/);
assert.match(view.innerHTML, /全部课程 · 530/);
assert.match(view.innerHTML, /地理必修第一册 · 97/);
assert.match(view.innerHTML, /地理必修第二册 · 107/);
assert.match(view.innerHTML, /选择性必修1 自然地理基础 · 112/);
assert.match(view.innerHTML, /选择性必修2 区域发展 · 105/);
assert.match(view.innerHTML, /选择性必修3 资源、环境与国家安全 · 109/);
assert.match(view.innerHTML, /来源目录/);

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  sources: metrics.sources,
  authoredSummaries: metrics.authoredSummaries,
  citationOnlyItems: metrics.citationOnlyItems,
}, null, 2));
