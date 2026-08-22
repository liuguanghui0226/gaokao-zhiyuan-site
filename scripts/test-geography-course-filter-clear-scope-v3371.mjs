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
assert.match(
  appSource,
  /state\.geographyCourse = button\.dataset\.geographyCourse \|\| "";[\s\S]*syncClearFiltersControl\(\)/,
  "selecting a geography course must refresh the shared filter status",
);

const elements = new Map([
  ["#clearFilters", { hidden: true }],
  ["#filterStatus", { textContent: "" }],
  ["#searchInput", { value: "" }],
  ["#disciplineFilter", { value: "" }],
  ["#domainFilter", { value: "" }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, hasActiveFilters, filterStatusText, syncClearFiltersControl, clearSearchFilters };`;
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
api.state.geographyData = {
  courses: [{ id: "compulsory-1", name: "地理必修第一册" }],
};
api.state.view = "geography";
api.state.geographyCourse = "compulsory-1";
api.state.geographySourceFilter = "all";
assert.equal(api.hasActiveFilters(), true, "a geography course selection must count as an active geography-view filter");
assert.equal(
  api.filterStatusText(),
  "当前高中地理课程“地理必修第一册”；结果作用于资料库、专业门类和高中地理。",
);
api.syncClearFiltersControl();
assert.equal(elements.get("#clearFilters").hidden, false);

api.state.view = "sources";
api.syncClearFiltersControl();
assert.equal(api.hasActiveFilters(), false, "a geography course filter must be scoped to the geography view");
assert.equal(elements.get("#clearFilters").hidden, true);
assert.equal(elements.get("#filterStatus").textContent, "检索和筛选作用于资料库、专业门类和高中地理。");

api.state.view = "geography";
api.clearSearchFilters();
assert.equal(api.state.geographyCourse, "");
assert.equal(api.hasActiveFilters(), false);
assert.equal(elements.get("#clearFilters").hidden, true);

console.log(JSON.stringify({
  ok: true,
  courseFilterStatus: true,
  viewScoped: true,
  clearResetsCourse: true,
}, null, 2));
