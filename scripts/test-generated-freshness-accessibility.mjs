#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const appSource = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");

assert.match(
  indexSource,
  /<p id="generatedAt" role="status" aria-live="polite">正在载入资料<\/p>/,
  "the initial data-freshness message must be announced as a polite status",
);
assert.match(
  appSource,
  /\$\("#generatedAt"\)\.textContent = renderFreshnessLabel\(/,
  "the live status must receive the post-load freshness label",
);

console.log(JSON.stringify({
  ok: true,
  generatedAtIsLiveStatus: true,
  postLoadFreshnessUpdatePreserved: true,
}, null, 2));
