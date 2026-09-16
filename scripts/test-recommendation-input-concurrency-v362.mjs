#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");
assert.match(app, /async function prepareRecommendationData\(/);
assert.match(app, /const snapshot = recommendationInputSnapshot\(\);\s*await prepareRecommendationData\(snapshot\.province\)/);
assert.match(app, /const \[shard\] = await Promise\.all\(/);
assert.match(app, /provinceFetcher\(provinceValue\)/);
assert.match(app, /recommendationLoader\(\)/);

const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { prepareRecommendationData };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const { prepareRecommendationData } = context.__gaokaoTest;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const events = [];
const recommendation = deferred();
const shard = deferred();
const pending = prepareRecommendationData(
  "北京",
  () => { events.push("recommendation-start"); return recommendation.promise; },
  () => { events.push("province-start"); return shard.promise; },
  (payload) => { events.push(`apply-${payload.province}`); },
);
assert.equal(events.join(","), "province-start,recommendation-start");
shard.resolve({ province: "北京", payload: { records: [] } });
await Promise.resolve();
assert.equal(events.join(","), "province-start,recommendation-start");
recommendation.resolve({ version: "v3.362" });
await pending;
assert.equal(events.join(","), "province-start,recommendation-start,apply-北京");

const failureEvents = [];
const failedRecommendation = deferred();
const failure = prepareRecommendationData(
  "青海",
  () => { failureEvents.push("recommendation-start"); return failedRecommendation.promise; },
  async () => { failureEvents.push("province-start"); return { province: "青海", payload: { records: [] } }; },
  () => { failureEvents.push("apply"); },
);
failedRecommendation.reject(new Error("supplement failed"));
await assert.rejects(failure, /supplement failed/);
assert.equal(failureEvents.join(","), "province-start,recommendation-start");

console.log(JSON.stringify({ status: "ok", parallelInputs: 2, applyAfterBoth: true, failureDoesNotApply: true }, null, 2));
