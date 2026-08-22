#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const appSource = fs.readFileSync(appFile, "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const updateViewStart = appSource.indexOf("function updateView(nextView)");
const updateViewEnd = appSource.indexOf("\nfunction bindEvents", updateViewStart);
const updateViewSource = appSource.slice(updateViewStart, updateViewEnd);
assert.ok(updateViewStart >= 0 && updateViewEnd > updateViewStart, "updateView implementation must remain discoverable");
assert.match(updateViewSource, /state\.view = nextView[\s\S]*syncClearFiltersControl\(\)/, "navigation must refresh filter controls after changing view");

const elements = new Map([
  ["#clearFilters", { hidden: false }],
  ["#filterStatus", { textContent: "旧状态" }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, syncClearFiltersControl, filterStatusText };`;
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
api.state.data = { disciplines: [], domains: [] };
api.state.query = "";
api.state.discipline = "";
api.state.domain = "";
api.state.geographySourceFilter = "local";
api.state.view = "recommend";
api.syncClearFiltersControl();

assert.equal(elements.get("#clearFilters").hidden, true, "source-only filter must hide the clear action outside sources view");
assert.equal(elements.get("#filterStatus").textContent, "检索和筛选作用于资料库、专业门类和高中地理。");

console.log(JSON.stringify({
  ok: true,
  clearActionScopedToSourcesView: true,
  unrelatedViewStatusIsNeutral: true,
}, null, 2));
