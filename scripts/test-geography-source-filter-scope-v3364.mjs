#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/geography/assets/app.js");
const appSource = fs.readFileSync(appFile, "utf8");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const geographyData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__geographyTest = { filteredItems, renderSourceDirectory, state };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const testApi = context.__geographyTest;
testApi.state.data = geographyData;
testApi.state.query = "";
testApi.state.course = "";
testApi.state.sourceFilter = "local";
assert.equal(testApi.filteredItems().length, geographyData.items.length, "source filter must not alter knowledge-card filtering");
const localDirectory = testApi.renderSourceDirectory();
assert.doesNotMatch(localDirectory, /class="geography-directory-link"/);
assert.match(localDirectory, /class="geography-directory-local"/);

testApi.state.sourceFilter = "public";
const publicDirectory = testApi.renderSourceDirectory();
assert.match(publicDirectory, /class="geography-directory-link"/);
assert.doesNotMatch(publicDirectory, /class="geography-directory-local"/);

console.log(JSON.stringify({
  ok: true,
  filterScope: "source-directory-only",
  knowledgeCardsRemainCourseAndQueryScoped: true,
}, null, 2));
