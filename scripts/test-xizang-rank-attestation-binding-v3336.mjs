#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(release, name))));
const core = read("knowledge-core-lite.json.gz");
const shard = read("xizang.json.gz");
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.indexOf("async function boot()");
assert.ok(bootIndex > 0, "Could not find app boot boundary");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__xizangRankAttestationTest = {
  state,
  xizangRankSourceUnconfirmed,
  usableRankForProfile,
  classifyProfileBand,
  admissionDataFreshness,
  scoreCandidate,
  invalidateRecommendationResults,
  CANDIDATE_POOLS,
};`;
const resultRegion = { innerHTML: "" };
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      return selector === "#recommendResultRegion" ? resultRegion : null;
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__xizangRankAttestationTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const base = {
  childType: "均衡探索型",
  score: "280",
  rank: "1000",
  rankInput: "1000",
  province: "西藏",
  candidateCategory: "A类考生",
  subject: "物理/理科",
  disciplineFocus: "08",
  interest: "计算机 软件工程 数字媒体技术",
  cities: "拉萨 成都 西安",
  abilityProfile: "偏好技术实践",
  redLines: "",
  budget: "中等敏感",
  strategy: "均衡",
  electives: "",
};
const unconfirmed = { ...base, xizangRankSource: "" };
const confirmed = { ...base, xizangRankSource: "official-personal-query" };
const nonXizang = { ...base, province: "江西", candidateCategory: "", xizangRankSource: "" };
const blankRankInput = { ...base, rankInput: "", xizangRankSource: "" };

assert.equal(api.xizangRankSourceUnconfirmed(unconfirmed), true);
assert.equal(api.usableRankForProfile(unconfirmed), 0);
assert.equal(api.classifyProfileBand(unconfirmed).label, "本科控制线以上基础段");
assert.equal(api.xizangRankSourceUnconfirmed(confirmed), false);
assert.equal(api.usableRankForProfile(confirmed), 1000);
assert.equal(api.classifyProfileBand(confirmed).label, "高位段");
assert.equal(api.xizangRankSourceUnconfirmed(nonXizang), false);
assert.equal(api.usableRankForProfile(nonXizang), 1000);
assert.equal(api.xizangRankSourceUnconfirmed(blankRankInput), true);
assert.equal(api.usableRankForProfile(blankRankInput), 0);

const freshness = api.admissionDataFreshness(unconfirmed, "2026-07-30");
assert.ok(freshness.warnings.some((warning) => /尚未确认为官方个人查询结果/.test(warning)));
assert.ok(freshness.warnings.some((warning) => /选择“西藏官方个人查询”来源后/.test(warning)));

const engineering = api.CANDIDATE_POOLS.find((item) => item.id === "engineering-industry");
const result = api.scoreCandidate(engineering, unconfirmed, api.classifyProfileBand(unconfirmed));
assert.equal(result.confidence, "C");
assert.ok(result.total <= 55);
assert.ok(result.warnings.some((warning) => /该位次已从模型输入中排除/.test(warning)));

assert.match(source, /id="xizangRankSourceField" \$\{showXizangRankSource \? "" : "hidden"\}/);
assert.match(source, /未确认，不进入排序/);
assert.match(source, /西藏官方个人查询/);
assert.match(source, /profile\.rank = "";\s+profile\.rankRejectedBySource = true;/);
assert.match(source, /xizangRankSourceField\.hidden = province !== "西藏"/);
assert.match(source, /xizangRankSourceInput\.value = ""/);
assert.match(source, /id="recommendResultRegion"/);
assert.match(source, /输入已变化，请重新生成推荐/);
assert.match(source, /const attestationBoundInputIds = new Set\(\[/);
for (const inputId of [
  "scoreInput",
  "rankInput",
  "provinceInput",
  "subjectInput",
  "candidateCategoryInput",
  "rankUsageInput",
]) {
  assert.match(source, new RegExp(`"${inputId}"`));
}
assert.match(source, /form\.addEventListener\("input", handleRecommendationInputChange\)/);
assert.match(source, /form\.addEventListener\("change", handleRecommendationInputChange\)/);

api.state.recommendation = { profile: confirmed, band: api.classifyProfileBand(confirmed), results: [] };
api.state.recommendationInvalidated = false;
assert.equal(api.invalidateRecommendationResults(), true);
assert.equal(api.state.recommendation, null);
assert.equal(api.state.recommendationInvalidated, true);
assert.match(resultRegion.innerHTML, /输入已变化，请重新生成推荐/);
assert.equal(api.invalidateRecommendationResults(), false);

console.log(JSON.stringify({
  status: "ok",
  unconfirmedRankUsed: api.usableRankForProfile(unconfirmed),
  unconfirmedBand: api.classifyProfileBand(unconfirmed).label,
  confirmedRankUsed: api.usableRankForProfile(confirmed),
  confirmedBand: api.classifyProfileBand(confirmed).label,
  unconfirmedConfidence: result.confidence,
  staleResultInvalidated: true,
}, null, 2));
