#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(projectRoot, "site/assets/styles.css"), "utf8");

assert.match(indexSource, /<a class="skip-link" href="#mainContent">跳到主要内容<\/a>/);
assert.match(indexSource, /<main id="mainContent" class="main" tabindex="-1">/);
assert.match(styleSource, /\.skip-link\s*\{/);
assert.match(styleSource, /\.skip-link:focus-visible\s*\{/);
assert.match(styleSource, /transform:\s*translateY\(-200%\)/);
assert.match(styleSource, /\.skip-link:focus-visible[\s\S]*?transform:\s*translateY\(0\)/);

console.log(JSON.stringify({
  ok: true,
  skipTarget: "mainContent",
  keyboardFocusStyle: true,
}, null, 2));
