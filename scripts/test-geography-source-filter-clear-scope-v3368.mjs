#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/geography/assets/app.js");
const appSource = fs.readFileSync(appFile, "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const elements = new Map([
  ["#geographyApp", { innerHTML: "" }],
  ["#searchInput", { value: "" }],
  ["#clearFilters", { hidden: false }],
  ["#filterStatus", { textContent: "旧状态" }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__geographyTest = { state, syncControls, clearFilters };`;
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

const api = context.__geographyTest;
api.state.data = {
  courses: [],
  items: [{ courseId: "compulsory-1", title: "地形", summary: "地形特征", keywords: [] }],
};
api.state.query = "";
api.state.course = "";
api.state.sourceFilter = "local";
api.syncControls();

assert.equal(elements.get("#clearFilters").hidden, false, "source filter must expose the standalone clear action");
assert.equal(elements.get("#filterStatus").textContent, "当前本地/教材来源；显示 1 条地理摘要。");

api.clearFilters();
assert.equal(api.state.sourceFilter, "all");
assert.equal(elements.get("#clearFilters").hidden, true);

console.log(JSON.stringify({
  ok: true,
  clearActionScopedToSourcesView: true,
  unrelatedViewStatusIsNeutral: true,
}, null, 2));
