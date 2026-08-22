#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appSource = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "site/assets/styles.css"), "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(indexSource, /id="clearFilters"/);
assert.match(indexSource, /aria-label="清空当前检索和筛选"/);
assert.match(stylesSource, /grid-template-columns: minmax\(220px, 1fr\) minmax\(160px, 230px\) minmax\(160px, 230px\) auto/);
assert.match(appSource, /clearSearchFilters/);
assert.match(appSource, /syncClearFiltersControl/);

const elements = new Map([
  ["#searchInput", { value: "计算机" }],
  ["#disciplineFilter", { value: "08" }],
  ["#domainFilter", { value: "admission" }],
  ["#clearFilters", { hidden: true, setAttribute() {} }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  state,
  hasActiveFilters,
  syncClearFiltersControl,
  clearSearchFilters,
};`;
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
vm.runInContext(instrumented, context, { filename: path.join(projectRoot, "site/assets/app.js") });

const api = context.__gaokaoTest;
api.state.query = "计算机";
api.state.discipline = "08";
api.state.domain = "admission";
api.state.renderedViews = new Set(["overview", "sources", "disciplines", "geography"]);

assert.equal(api.hasActiveFilters(), true, "active query or select values must expose the clear action");
api.syncClearFiltersControl();
assert.equal(elements.get("#clearFilters").hidden, false, "clear action must be visible while filters are active");

api.clearSearchFilters();

assert.equal(api.state.query, "");
assert.equal(api.state.discipline, "");
assert.equal(api.state.domain, "");
assert.equal(elements.get("#searchInput").value, "");
assert.equal(elements.get("#disciplineFilter").value, "");
assert.equal(elements.get("#domainFilter").value, "");
assert.equal(elements.get("#clearFilters").hidden, true, "clear action must hide after reset");
assert.equal(api.state.renderedViews.has("overview"), true, "unrelated views must remain cached");
assert.equal(api.state.renderedViews.has("sources"), false, "sources must rerender after reset");
assert.equal(api.state.renderedViews.has("disciplines"), false, "discipline view must rerender after reset");
assert.equal(api.state.renderedViews.has("geography"), false, "geography view must rerender after reset");

console.log(JSON.stringify({
  ok: true,
  visibleOnlyWhenActive: true,
  resetsAllThreeControls: true,
  invalidatesFilteredViews: true,
}, null, 2));
