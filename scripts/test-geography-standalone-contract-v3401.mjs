#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const standaloneIndexPath = path.join(projectRoot, "site", "geography", "index.html");
const standaloneAppPath = path.join(projectRoot, "site", "geography", "assets", "app.js");
const standaloneStylesPath = path.join(projectRoot, "site", "geography", "assets", "styles.css");
const canonicalDataPath = path.join(projectRoot, "data", "geography", "knowledge.json");
const admissionsIndexPath = path.join(projectRoot, "site", "index.html");
const admissionsAppPath = path.join(projectRoot, "site", "assets", "app.js");

assert.equal(fs.existsSync(standaloneIndexPath), true, "the standalone geography entrypoint must exist");
assert.equal(fs.existsSync(standaloneAppPath), true, "the standalone geography app must exist");
assert.equal(fs.existsSync(standaloneStylesPath), true, "the standalone geography stylesheet must exist");

const standaloneIndex = fs.readFileSync(standaloneIndexPath, "utf8");
const standaloneApp = fs.readFileSync(standaloneAppPath, "utf8");
const admissionsIndex = fs.readFileSync(admissionsIndexPath, "utf8");
const admissionsApp = fs.readFileSync(admissionsAppPath, "utf8");
const payload = JSON.parse(fs.readFileSync(canonicalDataPath, "utf8"));

assert.match(standaloneIndex, /<title>高中地理知识库<\/title>/);
assert.match(standaloneIndex, /id="geographyApp"/);
assert.match(standaloneIndex, /assets\/app\.js/);
assert.doesNotMatch(standaloneIndex, /全国高考志愿填报|院校专业推荐/);
assert.match(standaloneApp, /\.\.\/data\/geography\/knowledge\.json/);
assert.match(standaloneApp, /data-geography-course/);
assert.match(standaloneApp, /geography-source-directory/);
assert.match(standaloneApp, /target="_blank" rel="noreferrer"/);

assert.doesNotMatch(admissionsIndex, /data-view="geography"|id="view-geography"|高中地理/);
assert.doesNotMatch(admissionsApp, /fetchGeographyKnowledge\(\)|state\.geographyData|state\.geographyCourse|state\.geographySourceFilter/);
assert.doesNotMatch(admissionsApp, /结果作用于资料库、专业门类和高中地理/);

const bootIndex = standaloneApp.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "standalone geography app must have a boot failure boundary");
const view = { innerHTML: "" };
const elements = new Map([
  ["#geographyApp", view],
  ["#searchInput", { value: "" }],
  ["#clearFilters", { hidden: true }],
]);
const instrumented = `${standaloneApp.slice(0, bootIndex)}
globalThis.__geographyTest = { renderGeography, state, geographySummaryMetrics, filteredItems, renderSourceDirectory };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      return elements.get(selector) || null;
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: standaloneAppPath });

const api = context.__geographyTest;
api.state.data = payload;
api.state.query = "";
api.state.course = "";
const metrics = api.geographySummaryMetrics(payload);
assert.deepEqual(JSON.parse(JSON.stringify(metrics)), {
  courses: 5,
  items: 530,
  sources: 232,
  authoredSummaries: 38,
  citationOnlyItems: 492,
});
assert.equal(api.filteredItems().length, 530);
api.state.course = "compulsory-1";
assert.equal(api.filteredItems().length, 97);
api.state.course = "";
api.state.query = "大气受热";
assert.ok(api.filteredItems().some((item) => item.title === "大气受热与近地面运动"));

api.state.query = "";
api.renderGeography();
assert.match(view.innerHTML, /高中地理知识库/);
assert.match(view.innerHTML, /资料版本 geo-2026\.08\.23\.34/);
assert.match(view.innerHTML, /地理必修第一册 · 97/);
assert.match(view.innerHTML, /class="geography-source-link"/);
assert.match(view.innerHTML, /class="geography-source-local"/);

const directory = api.renderSourceDirectory(payload);
assert.match(directory, /geography-source-directory/);
assert.match(directory, /data-geography-source-filter="public"/);
assert.match(directory, /data-geography-source-filter="local"/);

console.log(JSON.stringify({
  ok: true,
  standaloneRoute: "/geography/",
  version: payload.version,
  courses: metrics.courses,
  items: metrics.items,
  sources: metrics.sources,
  admissionsBoundary: "geography-excluded",
}, null, 2));
