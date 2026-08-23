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
if (bootIndex < 0) throw new Error("Could not isolate standalone geography boot call");

assert.match(source, /geography-source-directory/);
assert.match(source, /geography-directory-link/);
assert.match(source, /访问/);
assert.match(source, /target="_blank" rel="noreferrer"/);

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__geographyTest = { renderSourceDirectory, state };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__geographyTest;
api.state.data = geographyData;
api.state.query = "";
api.state.sourceFilter = "all";
const directory = api.renderSourceDirectory();
assert.match(directory, /geography-source-directory/);
assert.match(directory, /249 个公开链接/);
assert.match(directory, /22 个本地\/教材/);
assert.match(directory, /class="geography-directory-link" href="https:\/\/oceanservice\.noaa\.gov\/education\/tutorial_tides\/tides01_intro\.html"/);
assert.match(directory, /访问 2026-08-23/);
assert.match(directory, /class="geography-directory-local"/);
assert.doesNotMatch(directory, /class="geography-directory-link"[^>]*>普通高中教科书/);

api.state.query = "NOAA";
const queryDirectory = api.renderSourceDirectory();
assert.match(queryDirectory, /NOAA Tides and Water Levels Education/);
assert.doesNotMatch(queryDirectory, /普通高中教科书 地理 必修 第一册/);

api.state.query = "没有此来源";
const emptyDirectory = api.renderSourceDirectory();
assert.match(emptyDirectory, /当前检索“没有此来源”没有匹配的地理来源/);
assert.match(emptyDirectory, /0 条来源 · 0 个公开链接 · 0 个本地\/教材/);

console.log(JSON.stringify({
  ok: true,
  geographySourcesVisible: geographyData.sources.length,
  publicSourcesLinked: true,
  localSourcesRemainUnlinked: true,
  queryEmptyStateRetained: true,
}, null, 2));
