#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/geography/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");

assert.match(source, /class="course-filters" role="group" aria-label="地理课程筛选"/);
assert.match(source, /data-geography-course="" aria-pressed="\$\{!state\.course\}"/);
assert.match(source, /data-geography-course="\$\{esc\(course\.id\)\}" aria-pressed="\$\{state\.course === course\.id\}"/);

console.log(JSON.stringify({
  ok: true,
  geographyCourseGroupLabeled: true,
  selectedStateExposed: true,
}, null, 2));
