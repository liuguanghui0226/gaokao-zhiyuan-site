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
assert.ok(
  updateViewSource.indexOf("state.view = nextView") < updateViewSource.indexOf("renderView(nextView)"),
  "navigation must update view state before rendering the next view",
);

const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { filterStatusText, hasActiveFilters, state };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const testApi = context.__gaokaoTest;
testApi.state.data = { disciplines: [], domains: [] };
testApi.state.query = "";
testApi.state.discipline = "";
testApi.state.domain = "";
testApi.state.geographySourceFilter = "local";
testApi.state.view = "recommend";

assert.equal(testApi.hasActiveFilters(), false, "source-directory filter must not activate global filters on recommendation view");
assert.equal(
  testApi.filterStatusText(),
  "检索和筛选作用于资料库、专业门类和高中地理。",
  "recommendation view must not report a source-directory-only filter",
);

testApi.state.view = "sources";
assert.equal(testApi.hasActiveFilters(), true, "source-directory filter must remain active on sources view");
assert.match(testApi.filterStatusText(), /地理来源“本地\/教材”/);

console.log(JSON.stringify({
  ok: true,
  filterScope: "sources-only",
  unrelatedViewStatusIsNeutral: true,
  navigationUpdatesStateBeforeRender: true,
}, null, 2));
