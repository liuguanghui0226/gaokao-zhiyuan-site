#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");

assert.match(app, /const RECOMMENDATION_INPUT_KEYS = \[/, "Recommendation input snapshot must define an explicit input contract");
assert.match(app, /function recommendationInputSnapshot\(/, "Recommendation input snapshot helper is required");
assert.match(app, /function recommendationInputSnapshotIsStale\(/, "Recommendation stale-run helper is required");
assert.match(
  app,
  /const snapshot = recommendationInputSnapshot\(\);[\s\S]*?await prepareRecommendationData\(snapshot\.province\);[\s\S]*?recommendationInputSnapshotIsStale\(snapshot\)/,
  "runRecommendation must snapshot before loading and reject changed inputs after loading",
);
assert.match(app, /state\.recommendationInvalidated = true;[\s\S]*?refreshRecommendationResults\(\);/, "Stale runs must reuse the visible invalidated-result state");
assert.match(app, /recommendationInputRevision: 0,/, "Recommendation input revision must have an initial value");
assert.match(app, /state\.recommendationInputRevision \+= 1;/, "Recommendation input events must invalidate in-flight runs");

const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { state, recommendationInputSnapshot, recommendationInputSnapshotIsStale };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const { state, recommendationInputSnapshot, recommendationInputSnapshotIsStale } = context.__gaokaoTest;

const submitted = {
  childType: "均衡探索型",
  score: "593",
  guangxiLocalScore: "",
  vocationalScore: "",
  rank: "",
  rankInput: "",
  xizangRankSource: "",
  guangxiLocalRank: "",
  guangxiLocalRankInput: "",
  province: "江西",
  subject: "物理/理科",
  candidateCategory: "",
  rankUsage: "",
  rankCategory: "",
  rankLevelUsage: "",
  electives: "化学 生物",
  disciplineFocus: "08",
  interest: "计算机 软件 数据",
  cities: "南昌 武汉",
  abilityProfile: "数学102 物理77",
  redLines: "不接受高学费",
  budget: "中等敏感",
  strategy: "均衡",
};

state.recommendationInputRevision = 7;
const snapshot = recommendationInputSnapshot(submitted);
assert.equal(snapshot.province, "江西");
assert.equal(snapshot.revision, 7);
assert.equal(recommendationInputSnapshotIsStale(snapshot, submitted), false);

state.recommendationInputRevision = 8;
assert.equal(recommendationInputSnapshotIsStale(snapshot, submitted), true, "an input event during loading must invalidate the run");

state.recommendationInputRevision = 7;
assert.equal(
  recommendationInputSnapshotIsStale(snapshot, { ...submitted, province: "西藏" }),
  true,
  "a changed province must invalidate the run even without relying on the revision event",
);
assert.equal(
  recommendationInputSnapshotIsStale(snapshot, { ...submitted, score: "594" }),
  true,
  "a changed score must invalidate the run",
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const resultRegion = { innerHTML: "" };
const status = { textContent: "" };
const fieldValues = {
  "#childType": "均衡探索型",
  "#scoreInput": "593",
  "#rankInput": "",
  "#provinceInput": "江西",
  "#subjectInput": "物理/理科",
  "#rankUsageInput": "ordinary||",
  "#disciplineFocus": "08",
  "#interestInput": "计算机 软件 数据",
  "#cityInput": "南昌 武汉",
  "#abilityProfileInput": "数学102 物理77",
  "#redLineInput": "不接受高学费",
  "#budgetInput": "中等敏感",
  "#strategyInput": "均衡",
};
const document = {
  querySelector(selector) {
    if (selector === "#recommendResultRegion") return resultRegion;
    if (selector === "#recommendStatus") return status;
    const value = fieldValues[selector];
    return value === undefined ? null : { value };
  },
  querySelectorAll(selector) {
    return selector === ".elective-input:checked" ? [] : [];
  },
};
const runDeferred = deferred();
const runContext = vm.createContext({ console, Intl, Date, Set, Map, document });
const runInstrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { state, runRecommendation };`;
vm.runInContext(runInstrumented, runContext, { filename: appFile });
const runApi = runContext.__gaokaoTest;
runApi.state.data = { admissionScoreLayer: { records: [], rankConversions: [] } };
runApi.state.provinceManifest = { shards: { 江西: { file: "jiangxi.json" } } };
runApi.state.provinceShardCache.set("江西", { records: [], rankConversions: [] });
runApi.state.recommendationDataPromise = runDeferred.promise;
const pendingRun = runApi.runRecommendation();
await Promise.resolve();
runApi.state.recommendationInputRevision += 1;
runDeferred.resolve({ version: "v3.364-test" });
assert.equal(await pendingRun, false, "a run invalidated while loading must not commit results");
assert.equal(runApi.state.recommendation, null);
assert.equal(runApi.state.recommendationInvalidated, true);
assert.match(resultRegion.innerHTML, /输入已变化，请重新生成推荐/);
assert.match(status.textContent, /输入已变化，请重新生成推荐/);

console.log(JSON.stringify({
  status: "ok",
  explicitInputKeys: true,
  revisionInvalidates: true,
  profileSignatureInvalidates: true,
  staleRunDiscarded: true,
}, null, 2));
