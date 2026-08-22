#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");

assert.match(source, /class="major-family-grid" role="group" aria-label="专业方向"/);
assert.match(source, /data-family-key="\$\{esc\(family\.key\)\}" aria-pressed="\$\{family\.key === selectedFamily\?\.key\}"/);
assert.match(source, /class="geography-course-grid" role="group" aria-label="地理课程筛选"/);
assert.match(source, /data-geography-course="" aria-pressed="\$\{!state\.geographyCourse\}"/);
assert.match(source, /data-geography-course="\$\{esc\(course\.id\)\}" aria-pressed="\$\{state\.geographyCourse === course\.id\}"/);

console.log(JSON.stringify({
  ok: true,
  disciplineFamilyGroupLabeled: true,
  geographyCourseGroupLabeled: true,
  selectedStateExposed: true,
}, null, 2));
