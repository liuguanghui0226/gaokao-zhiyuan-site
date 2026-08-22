#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const source = fs.readFileSync(appFile, "utf8");
const payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(source, /geography-source-link/);
assert.match(source, /commitSha/);
assert.match(source, /accessedAt/);

const view = { innerHTML: "" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderGeography, state };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#view-geography") return view;
      throw new Error(`Unexpected selector in geography source-link test: ${selector}`);
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.state.geographyData = payload;
context.__gaokaoTest.state.query = "地转偏向力";
context.__gaokaoTest.state.geographyCourse = "";
context.__gaokaoTest.renderGeography();

assert.match(view.innerHTML, /class="geography-source-list"/);
assert.match(view.innerHTML, /class="geography-source-link" href="https:\/\/github\.com\/uau9\/orange-geography-coach"/);
assert.match(view.innerHTML, /target="_blank" rel="noreferrer"/);
assert.match(view.innerHTML, /commit 0198f84c3552bf20df90124e1c18dc412f0cf0fd/);
assert.match(view.innerHTML, /访问 2026-08-22/);

context.__gaokaoTest.state.query = "大气受热";
context.__gaokaoTest.renderGeography();
assert.match(view.innerHTML, /class="geography-source-local"/);
assert.doesNotMatch(view.innerHTML, /class="geography-source-link"/);

console.log(JSON.stringify({
  ok: true,
  publicSourcesLinked: true,
  revisionMetadataVisible: true,
  localSourcesRemainUnlinked: true,
}, null, 2));
