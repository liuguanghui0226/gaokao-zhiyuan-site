#!/usr/bin/env node

import assert from "node:assert/strict";
import { formatFilterResultCount } from "../site/assets/filter-state.mjs";

const cases = [
  ["sources", 0, "当前显示 0 条资料来源。"],
  ["sources", 12.9, "当前显示 12 条资料来源。"],
  ["disciplines", 7, "当前显示 7 条相关资料。"],
  ["geography", 335, "当前显示 335 条地理摘要。"],
];

for (const [view, count, expected] of cases) {
  assert.equal(formatFilterResultCount(view, count), expected);
}

assert.equal(formatFilterResultCount("overview", 12), "");
assert.equal(formatFilterResultCount("sources", "not-a-count"), "");
assert.equal(formatFilterResultCount("geography", -3), "当前显示 0 条地理摘要。");

console.log(JSON.stringify({ ok: true, cases: cases.length + 3 }, null, 2));
