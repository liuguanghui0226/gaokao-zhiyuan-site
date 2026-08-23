#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDataPath = path.join(projectRoot, "data/geography/knowledge.json");
const siteDataPath = path.join(projectRoot, "site/data/geography/knowledge.json");
const visualsPath = path.join(projectRoot, "data/geography/visuals.json");
const siteVisualsPath = path.join(projectRoot, "site/data/geography/visuals.json");
const appPath = path.join(projectRoot, "site/geography/assets/app.js");
const indexPath = path.join(projectRoot, "site/geography/index.html");

for (const file of [visualsPath, siteVisualsPath, appPath, indexPath]) {
  assert.equal(fs.existsSync(file), true, `required visual-learning file is missing: ${file}`);
}

const payload = JSON.parse(fs.readFileSync(sourceDataPath, "utf8"));
const sitePayload = JSON.parse(fs.readFileSync(siteDataPath, "utf8"));
const visuals = JSON.parse(fs.readFileSync(visualsPath, "utf8"));
const siteVisuals = JSON.parse(fs.readFileSync(siteVisualsPath, "utf8"));
const appSource = fs.readFileSync(appPath, "utf8");
const indexSource = fs.readFileSync(indexPath, "utf8");

assert.deepEqual(sitePayload, payload, "site geography knowledge must mirror canonical v38 data");
assert.deepEqual(siteVisuals, visuals, "site visual-learning manifest must mirror canonical visual data");
assert.match(appSource, /\.\.\/data\/geography\/visuals\.json/);
assert.match(appSource, /data-visual-course/);
assert.match(appSource, /visual-learning/);
assert.match(appSource, /target="_blank" rel="noreferrer"/);
assert.match(indexSource, /视觉学习/);

assert.equal(visuals.version, "geo-visuals-2026.08.24.02");
assert.equal(visuals.cards.length, 5, "one visual story is required for each course");
const sourceIds = new Set(payload.sources.map((source) => source.id));
const courseIds = new Set(payload.courses.map((course) => course.id));
assert.deepEqual(new Set(visuals.cards.map((card) => card.courseId)), courseIds);

for (const card of visuals.cards) {
  assert.ok(card.id && card.title && card.caption && card.scene, "visual card needs identity, title, caption and scene");
  assert.ok(courseIds.has(card.courseId), `visual card has unknown course ${card.courseId}`);
  assert.ok(Array.isArray(card.steps) && card.steps.length >= 3, `${card.id} needs at least three visual steps`);
  assert.ok(card.steps.every((step) => step.label && step.detail), `${card.id} visual steps need labels and explanations`);
  assert.ok(Array.isArray(card.sourceIds) && card.sourceIds.length >= 1);
  assert.ok(card.sourceIds.every((sourceId) => sourceIds.has(sourceId)), `${card.id} references an unknown source`);
  assert.ok(Array.isArray(card.mediaLinks) && card.mediaLinks.length >= 1, `${card.id} needs a video or interactive entry`);
  assert.ok(card.mediaLinks.every((link) => /^https:\/\//.test(link.url) && link.label && link.mediaType));
}

const bootIndex = appSource.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "standalone app must retain a boot failure boundary");
const view = { innerHTML: "" };
const elements = new Map([
  ["#geographyApp", view],
  ["#searchInput", { value: "" }],
  ["#clearFilters", { hidden: true }],
  ["#filterStatus", { textContent: "" }],
  ["#freshness", { textContent: "" }],
]);
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__geographyTest = { renderGeography, renderVisualLearning, filteredVisuals, state };`;
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
vm.runInContext(instrumented, context, { filename: appPath });

const api = context.__geographyTest;
api.state.data = payload;
api.state.visuals = visuals;
api.state.query = "";
api.state.course = "";
assert.equal(api.filteredVisuals().length, 5);
api.state.course = "compulsory-1";
assert.equal(api.filteredVisuals().length, 1);
api.state.course = "";
api.state.query = "森林资源";
assert.equal(api.filteredVisuals().length, 1, "visual search should match visual title, caption or steps");

api.state.query = "";
api.renderVisualLearning();
assert.match(view.innerHTML, /class="(?:panel )?visual-learning"/);
assert.match(view.innerHTML, /class="visual-story-card"/);
assert.match(view.innerHTML, /<svg[^>]+role="img"/);
assert.match(view.innerHTML, /aria-labelledby="visual-/);
assert.match(view.innerHTML, /class="visual-media-link"/);
assert.match(view.innerHTML, /视频|互动|数据图层/);
assert.match(view.innerHTML, /target="_blank" rel="noreferrer"/);

console.log(JSON.stringify({
  ok: true,
  version: visuals.version,
  cards: visuals.cards.length,
  courses: courseIds.size,
  mediaLinks: visuals.cards.reduce((total, card) => total + card.mediaLinks.length, 0),
  courseFilter: "scoped",
}, null, 2));
