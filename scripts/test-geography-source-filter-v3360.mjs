#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/geography/assets/app.js");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const source = fs.readFileSync(appFile, "utf8");
const geographyData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__geographyTest = { renderSourceDirectory, state };`;
const context = vm.createContext({
  console,
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__geographyTest.state.data = geographyData;
context.__geographyTest.state.query = "";
context.__geographyTest.state.sourceFilter = "public";
const publicDirectory = context.__geographyTest.renderSourceDirectory();

const publicSources = geographyData.sources.filter((source) => source?.url).length;
const localSources = geographyData.sources.filter((source) => !source?.url).length;

assert.match(publicDirectory, /data-geography-source-filter="all"/);
assert.match(publicDirectory, /data-geography-source-filter="public"/);
assert.match(publicDirectory, /data-geography-source-filter="local"/);
assert.match(publicDirectory, new RegExp(`${publicSources} 条来源 · ${publicSources} 个公开链接 · 0 个本地\\/教材`));
assert.doesNotMatch(publicDirectory, /class="geography-directory-local"/);
assert.match(publicDirectory, /class="geography-directory-link"/);

context.__geographyTest.state.sourceFilter = "local";
const localDirectory = context.__geographyTest.renderSourceDirectory();
assert.match(localDirectory, new RegExp(`${localSources} 条来源 · 0 个公开链接 · ${localSources} 个本地\\/教材`));
assert.doesNotMatch(localDirectory, /class="geography-directory-link"/);
assert.match(localDirectory, /class="geography-directory-local"/);

console.log(JSON.stringify({
  ok: true,
  publicSources,
  localSources,
  accessibleFilterControls: true,
}, null, 2));
