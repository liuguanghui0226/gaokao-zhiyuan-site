#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const indexFile = path.join(projectRoot, "site/index.html");
const appSource = fs.readFileSync(appFile, "utf8");
const indexSource = fs.readFileSync(indexFile, "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(indexSource, /id="view-overview"/);
assert.match(appSource, /id="startRecommendation"/);
assert.match(appSource, /function bindOverviewEvents\(\)/);
assert.match(appSource, /bindOverviewEvents\(\);/);

const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, DEFAULT_PROFILE, startRecommendationFromOverview };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__gaokaoTest;
const rendered = [];
const navigated = [];
const render = (view, options) => rendered.push({ view, options });
const navigate = (view) => navigated.push(view);

api.state.recommendation = null;
api.state.prefillProfile = null;
api.startRecommendationFromOverview(render, navigate);
assert.equal(api.state.prefillProfile, api.DEFAULT_PROFILE);
assert.equal(rendered.at(-1).view, "recommend");
assert.equal(rendered.at(-1).options.force, true);
assert.equal(navigated.at(-1), "recommend");

const savedProfile = { province: "广东", score: "610" };
api.state.recommendation = null;
api.state.prefillProfile = savedProfile;
api.startRecommendationFromOverview(render, navigate);
assert.equal(api.state.prefillProfile, savedProfile);

const currentProfile = { province: "江西", score: "593" };
api.state.recommendation = { profile: currentProfile };
api.state.prefillProfile = savedProfile;
api.startRecommendationFromOverview(render, navigate);
assert.equal(api.state.prefillProfile, currentProfile);

console.log(JSON.stringify({
  ok: true,
  buttonPresent: true,
  preservesCurrentProfile: true,
  preservesSavedDraft: true,
  fallsBackToExample: true,
  forcesRecommendationRerender: true,
}, null, 2));
