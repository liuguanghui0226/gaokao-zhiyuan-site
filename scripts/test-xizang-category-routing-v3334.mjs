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
globalThis.__xizangCategoryTest = {
  state,
  normalizeXizangCandidateCategory,
  xizangCandidateCategoryMissing,
  recordMatchesCandidateCategory,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  admissionDataFreshness,
  profileAdmissionRecords,
  scoreCandidate,
  classifyScoreBand,
  classifyProfileBand,
  isVocationalProfile,
  CANDIDATE_POOLS,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__xizangCategoryTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const base = {
  childType: "均衡探索型",
  score: "280",
  rank: "",
  province: "西藏",
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
const profileA = { ...base, candidateCategory: "A类考生" };
const profileB = { ...base, candidateCategory: "B类考生" };

assert.equal(api.xizangCandidateCategoryMissing(base), true);
assert.equal(api.xizangCandidateCategoryMissing(profileA), false);
assert.equal(api.normalizeXizangCandidateCategory("A类"), "A类考生");
assert.equal(api.normalizeXizangCandidateCategory("汉族考生"), "B类考生");
assert.equal(api.recordMatchesCandidateCategory({ province: "西藏", candidateCategory: "A类" }, profileA), true);
assert.equal(api.recordMatchesCandidateCategory({ province: "西藏", candidateCategory: "B类" }, profileA), false);
assert.equal(api.recordMatchesCandidateCategory({ province: "西藏", candidateCategory: "汉族考生" }, profileB), true);
assert.equal(api.recordMatchesCandidateCategory({ province: "西藏", candidateCategory: "少数民族考生" }, profileA), false);

const bachelorA = api.ordinaryBachelorControlLine(profileA);
const bachelorB = api.ordinaryBachelorControlLine(profileB);
assert.equal(bachelorA.year, 2026);
assert.equal(bachelorB.year, 2026);
assert.equal(bachelorA.score, 260);
assert.equal(bachelorB.score, 300);
assert.equal(bachelorA.record.candidateCategory, "A类考生");
assert.equal(bachelorB.record.candidateCategory, "B类考生");
assert.equal(api.isVocationalProfile(profileA), false);
assert.equal(api.isVocationalProfile(profileB), true);
assert.equal(api.classifyProfileBand(profileA).label, "本科控制线以上基础段");
assert.equal(api.classifyProfileBand(profileB).label, "专科/技能段");
assert.equal(api.ordinaryVocationalControlLine(profileA).score, 195);
assert.equal(api.ordinaryVocationalControlLine(profileB).score, 195);

const blankFreshness = api.admissionDataFreshness(base, "2026-07-29");
assert.equal(blankFreshness.candidateCategoryRequired, true);
assert.equal(blankFreshness.candidateCategoryMissing, true);
assert.equal(blankFreshness.latestRankYear, null);
assert.ok(blankFreshness.warnings.some((warning) => /必须先确认A\/B类/.test(warning)));
assert.ok(blankFreshness.warnings.some((warning) => /不按分数编造位次/.test(warning)));
const categoryFreshness = api.admissionDataFreshness(profileB, "2026-07-29");
assert.equal(categoryFreshness.candidateCategoryMissing, false);

const engineering = api.CANDIDATE_POOLS.find((item) => item.id === "engineering-industry");
const missingCategoryRecommendation = api.scoreCandidate(engineering, base, api.classifyScoreBand(base.score, base.rank, base.province));
assert.equal(missingCategoryRecommendation.confidence, "C");
assert.ok(missingCategoryRecommendation.total <= 55);
assert.ok(missingCategoryRecommendation.warnings.some((warning) => /不得跨类别混用/.test(warning)));

assert.match(source, /id="xizangCandidateCategoryField" \$\{showXizangCandidateCategory \? "" : "hidden"\}/);
assert.match(source, /A类：区内世居两代以上少数民族/);
assert.match(source, /B类：汉族及区外少数民族/);
assert.match(source, /xizangCandidateCategoryField\.hidden = province !== "西藏"/);

console.log(JSON.stringify({
  status: "ok",
  aBachelorLine: bachelorA.score,
  bBachelorLine: bachelorB.score,
  missingCategoryConfidence: missingCategoryRecommendation.confidence,
  missingCategoryScore: missingCategoryRecommendation.total,
}, null, 2));
