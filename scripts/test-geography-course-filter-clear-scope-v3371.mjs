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
assert.match(
  appSource,
  /state\.course = button\.dataset\.geographyCourse \|\| "";[\s\S]*syncControls\(\)/,
  "selecting a geography course must refresh the standalone filter status",
);

const elements = new Map([
  ["#geographyApp", { innerHTML: "" }],
  ["#clearFilters", { hidden: true }],
  ["#filterStatus", { textContent: "" }],
  ["#searchInput", { value: "" }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__geographyTest = { state, filteredItems, syncControls, clearFilters };`;
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
  courses: [{ id: "compulsory-1", name: "地理必修第一册" }],
  items: [{ courseId: "compulsory-1", title: "地形", summary: "地形特征", keywords: [] }],
};
api.state.course = "compulsory-1";
api.state.sourceFilter = "all";
assert.equal(api.filteredItems().length, 1, "a geography course selection must filter standalone items");
api.syncControls();
assert.equal(
  elements.get("#filterStatus").textContent,
  "当前课程“地理必修第一册”；显示 1 条地理摘要。",
);
assert.equal(elements.get("#clearFilters").hidden, false);

api.clearFilters();
assert.equal(api.state.course, "");
assert.equal(api.state.sourceFilter, "all");
assert.equal(api.filteredItems().length, 1);
assert.equal(elements.get("#clearFilters").hidden, true);

console.log(JSON.stringify({
  ok: true,
  courseFilterStatus: true,
  viewScoped: true,
  clearResetsCourse: true,
}, null, 2));
