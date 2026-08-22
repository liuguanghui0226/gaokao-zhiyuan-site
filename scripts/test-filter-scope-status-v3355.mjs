#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const appSource = fs.readFileSync(appFile, "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(indexSource, /id="filterStatus" class="filter-status" role="status" aria-live="polite"/);
assert.match(appSource, /function filterStatusText\(\)/);
assert.match(appSource, /filterStatus\.textContent = filterStatusText\(\)/);

const elements = new Map([
  ["#clearFilters", { hidden: true }],
  ["#filterStatus", { textContent: "" }],
  ["#searchInput", { value: "" }],
  ["#disciplineFilter", { value: "" }],
  ["#domainFilter", { value: "" }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, filterStatusText, syncClearFiltersControl };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      return elements.get(selector) || null;
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__gaokaoTest;
api.state.data = {
  disciplines: [{ code: "08", name: "工学" }],
  domains: [{ id: "admission", label: "录取规则与志愿策略" }],
};

assert.equal(api.filterStatusText(), "检索和筛选作用于资料库、专业门类和高中地理。");
api.syncClearFiltersControl();
assert.equal(elements.get("#filterStatus").textContent, "检索和筛选作用于资料库、专业门类和高中地理。");
assert.equal(elements.get("#clearFilters").hidden, true);

api.state.query = "计算机";
api.state.discipline = "08";
api.state.domain = "admission";
api.syncClearFiltersControl();
assert.match(elements.get("#filterStatus").textContent, /检索“计算机”/);
assert.match(elements.get("#filterStatus").textContent, /门类“08 工学”/);
assert.match(elements.get("#filterStatus").textContent, /主题“录取规则与志愿策略”/);
assert.match(elements.get("#filterStatus").textContent, /结果作用于资料库、专业门类和高中地理/);
assert.equal(elements.get("#clearFilters").hidden, false);

console.log(JSON.stringify({
  ok: true,
  scopeExplained: true,
  activeFiltersSummarized: true,
  statusIsAccessible: true,
}, null, 2));
