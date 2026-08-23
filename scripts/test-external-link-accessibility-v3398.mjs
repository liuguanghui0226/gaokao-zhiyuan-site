#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const targetBlankLines = source.split("\n").filter((line) => line.includes('target="_blank"'));

assert.ok(targetBlankLines.length >= 8, "the site should expose the audited external-link paths");
for (const line of targetBlankLines) {
  assert.match(line, /aria-label=/, `new-window link must announce its behavior: ${line.trim()}`);
}

const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { newWindowAriaLabel };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

assert.equal(
  context.__gaokaoTest.newWindowAriaLabel("开放 & 地图"),
  "开放 &amp; 地图（在新窗口打开）",
  "new-window labels must remain HTML-safe while preserving the visible title",
);

console.log(JSON.stringify({
  ok: true,
  auditedExternalLinks: targetBlankLines.length,
  allAnnounceNewWindow: true,
  labelsEscaped: true,
}, null, 2));
