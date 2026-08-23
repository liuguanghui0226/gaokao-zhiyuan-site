#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appSource = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const startMarker = "// filter-result-count-contract:start";
const endMarker = "// filter-result-count-contract:end";
const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker);
assert.ok(start >= 0 && end > start, "filter result count contract markers are present");
const context = {};
vm.runInNewContext(`${appSource.slice(start + startMarker.length, end)}; globalThis.formatFilterResultCount = formatFilterResultCount;`, context);
const { formatFilterResultCount } = context;

const cases = [
  ["sources", 0, "当前显示 0 条资料来源。"],
  ["sources", 12.9, "当前显示 12 条资料来源。"],
  ["disciplines", 7, "当前显示 7 条相关资料。"],
];

for (const [view, count, expected] of cases) {
  assert.equal(formatFilterResultCount(view, count), expected);
}

assert.equal(formatFilterResultCount("overview", 12), "");
assert.equal(formatFilterResultCount("sources", "not-a-count"), "");

console.log(JSON.stringify({ ok: true, cases: cases.length + 3 }, null, 2));
