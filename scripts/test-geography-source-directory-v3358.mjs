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
const geographyData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(source, /geography-source-directory/);
assert.match(source, /geography-directory-link/);
assert.match(source, /访问/);

const view = { innerHTML: "" };
const emptyTemplate = { innerHTML: "<div>empty</div>" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderSources, state };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#view-sources") return view;
      if (selector === "#emptyTemplate") return emptyTemplate;
      throw new Error(`Unexpected selector in geography source-directory test: ${selector}`);
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.state.data = {
  sourceFiles: [{
    id: "core-source",
    title: "核心资料",
    relativePath: "docs/core.md",
    excerpt: "核心资料摘要",
    domains: [],
    disciplines: [],
    processingStatus: "text-extracted",
    textLength: 100,
    kind: "markdown",
    bytes: 100,
  }],
};
context.__gaokaoTest.state.geographyData = geographyData;
context.__gaokaoTest.state.query = "";
context.__gaokaoTest.state.discipline = "";
context.__gaokaoTest.state.domain = "";
context.__gaokaoTest.renderSources();

assert.match(view.innerHTML, /class="band geography-source-directory"/);
assert.match(view.innerHTML, /高中地理来源目录/);
assert.match(view.innerHTML, /91 个公开链接/);
assert.match(view.innerHTML, /21 个本地\/教材/);
assert.match(view.innerHTML, /class="geography-directory-link" href="https:\/\/oceanservice\.noaa\.gov\/education\/tutorial_tides\/tides01_intro\.html"/);
assert.match(view.innerHTML, /访问 2026-08-22/);
assert.match(view.innerHTML, /commit 0198f84c3552bf20df90124e1c18dc412f0cf0fd/);
assert.match(view.innerHTML, /github\.com\/giswqs\/geog-510/);
assert.match(view.innerHTML, /class="geography-directory-local"/);
assert.doesNotMatch(view.innerHTML, /class="geography-directory-link"[^>]*>普通高中教科书/);

context.__gaokaoTest.state.query = "NOAA";
context.__gaokaoTest.renderSources();
assert.match(view.innerHTML, /高中地理来源目录/);
assert.match(view.innerHTML, /NOAA Tides and Water Levels Education/);
assert.doesNotMatch(view.innerHTML, /普通高中教科书 地理 必修 第一册/);

context.__gaokaoTest.state.query = "没有此来源";
context.__gaokaoTest.renderSources();
assert.match(view.innerHTML, /高中地理来源目录/);
assert.match(view.innerHTML, /当前检索“没有此来源”没有匹配的地理来源/);
assert.match(view.innerHTML, /0 条来源 · 0 个公开链接 · 0 个本地\/教材/);
assert.doesNotMatch(view.innerHTML, /class="empty-state"><h2>没有匹配结果<\/h2>/);

console.log(JSON.stringify({
  ok: true,
  geographySourcesVisible: geographyData.sources.length,
  publicSourcesLinked: true,
  localSourcesRemainUnlinked: true,
  queryEmptyStateRetained: true,
}, null, 2));
