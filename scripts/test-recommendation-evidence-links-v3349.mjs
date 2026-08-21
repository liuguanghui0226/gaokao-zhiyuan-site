#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.ok(source.includes("evidence-link-row"), "recommendation evidence links missing");
assert.ok(source.includes('target="_blank" rel="noreferrer"'), "evidence links must open safely");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderEvidenceLinks };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const html = context.__gaokaoTest.renderEvidenceLinks([
  { source: { title: "江西省教育考试院", url: "https://example.com/jiangxi" } },
  { source: { title: "江西省教育考试院", url: "https://example.com/jiangxi" } },
  { source: { title: "招生网", url: "https://example.com/admission" } },
]);
const localHtml = context.__gaokaoTest.renderEvidenceLinks([
  { source: { title: "本地讲义" } },
]);

assert.match(html, /evidence-link-row/);
assert.match(html, /江西省教育考试院/);
assert.match(html, /href="https:\/\/example\.com\/jiangxi"/);
assert.match(html, /target="_blank" rel="noreferrer"/);
assert.equal((html.match(/example\.com\/jiangxi/g) || []).length, 1, "duplicate source links should collapse");
assert.match(localHtml, /local-source-tag/);
assert.match(localHtml, /本地资料：本地讲义/);
assert.doesNotMatch(localHtml, /href=/, "local-only evidence must not invent a public URL");

console.log(JSON.stringify({ ok: true, linkedSources: 2, localSourcesLabeled: true, duplicatesCollapsed: true, safeTarget: true }, null, 2));
