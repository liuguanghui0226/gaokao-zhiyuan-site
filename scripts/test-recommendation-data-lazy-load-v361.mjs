#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");
const bootStart = app.indexOf("async function boot()");
const bootEnd = app.indexOf("function renderBootFailure", bootStart);
assert.ok(bootStart >= 0 && bootEnd > bootStart, "boot function must be present");
const bootSource = app.slice(bootStart, bootEnd);
assert.match(bootSource, /knowledge-core-lite\.json/);
assert.match(bootSource, /provinces\/manifest\.json/);
assert.match(bootSource, /province-plan-readiness\.json/);
assert.doesNotMatch(bootSource, /admission-plan-supplement-v35[689]\.json/);
assert.doesNotMatch(bootSource, /admission-score-supplement-v357\.json/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v358\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v359\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v360\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v361\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v363\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-score-supplement-v357\.json", "官方投档补充"\)/);
assert.match(app, /state\.recommendationDataPromise/);
assert.match(app, /await prepareRecommendationData\(\$\("#provinceInput"\)\.value\.trim\(\)\)/);
assert.match(app, /正在载入推荐数据和本省数据，请稍候/);

const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { state, ensureRecommendationData };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const { state, ensureRecommendationData } = context.__gaokaoTest;
state.data = { admissionScoreLayer: { sourceNotes: [{ id: "core" }], structuredRecords: 10 } };
const names = [
  "admission-plan-supplement-v356.json",
  "admission-plan-supplement-v358.json",
  "admission-plan-supplement-v359.json",
  "admission-plan-supplement-v360.json",
  "admission-plan-supplement-v361.json",
  "admission-plan-supplement-v363.json",
  "admission-score-supplement-v357.json",
];
const calls = [];
const loader = async (name) => {
  calls.push(name);
  if (name === "admission-score-supplement-v357.json") return { version: "v3.357", sources: [{ id: "score" }], summary: { records: 2 }, records: [{ id: "score-x", province: "江西" }] };
  const version = name.match(/v(\d+)/)[1];
  return { version: `v3.${version}`, sources: [{ id: `plan-${version}` }], summary: { records: Number(version) }, records: [{ id: `plan-${version}-x`, province: "江西" }] };
};
const [first, second] = await Promise.all([ensureRecommendationData(loader), ensureRecommendationData(loader)]);
assert.equal(first, second);
assert.deepEqual([...calls].sort(), [...names].sort());
assert.equal(calls.length, names.length);
assert.equal(state.planSupplementManifest.version, "v3.356+v3.358+v3.359+v3.360+v3.361+v3.363");
assert.equal(state.planSupplementRecords.length, 6);
assert.equal(state.scoreSupplementRecords.length, 1);
assert.equal(state.data.admissionScoreLayer.structuredRecords, 12);
assert.equal(Array.from(state.data.admissionScoreLayer.sourceNotes, (source) => source.id).join(","), "core,score");

state.recommendationDataPromise = null;
const failedCalls = [];
let failOnce = true;
const retryLoader = async (name) => {
  failedCalls.push(name);
  if (failOnce) {
    failOnce = false;
    throw new Error("transient");
  }
  return loader(name);
};
await assert.rejects(() => ensureRecommendationData(retryLoader), /transient/);
assert.equal(state.recommendationDataPromise, null);
await ensureRecommendationData(retryLoader);
assert.ok(failedCalls.length > names.length);

console.log(JSON.stringify({ status: "ok", bootCriticalFetches: 3, deferredFetches: 7, concurrentFetches: calls.length, retryableFailure: true }, null, 2));
