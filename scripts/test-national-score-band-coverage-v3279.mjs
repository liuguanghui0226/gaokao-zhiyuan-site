#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const siteIndex = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const releaseMatch = siteIndex.match(/__GAOKAO_RUNTIME_RELEASE_BASE__\s*=\s*["']\.\/data\/([^"']+)/);
assert.ok(releaseMatch, "active compressed release is missing from site/index.html");
const releaseDir = path.join(projectRoot, "site/data", releaseMatch[1]);

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
assert.equal(manifest.provinceCount, 31);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /id="scoreInput"[^>]+max="1000"/, "score input must accept Hainan's 900-point scale");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoNationalCoverageTest = {
  state,
  CANDIDATE_POOLS,
  classifyScoreBand,
  classifyProfileBand,
  candidatePoolsForProfile,
  estimateRankFromScore,
  isVocationalAdmissionRecord,
  isVocationalProfile,
  ordinaryBachelorControlLine,
  ordinarySegmentStatus,
  ordinaryVocationalControlLine,
  scoreCandidate,
  scoreScaleForProvince,
  setProvinceData(payload) {
    state.data.admissionScoreLayer.records = payload.records || [];
    state.data.admissionScoreLayer.rankConversions = payload.rankConversions || [];
    admissionTrendIndexCache = null;
  },
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoNationalCoverageTest;
api.state.data = core;

assert.equal(api.scoreScaleForProvince("上海"), 660);
assert.equal(api.scoreScaleForProvince("海南"), 900);
assert.equal(api.scoreScaleForProvince("江西"), 750);
assert.equal(api.classifyScoreBand(800, "", "海南").id, "elite");
assert.equal(api.classifyScoreBand(600, "", "上海").id, "elite");
assert.equal(api.classifyScoreBand(250, 3000, "江西").id, "elite", "official rank must outrank a contradictory raw score");

function normalizedSubject(value) {
  const text = String(value || "");
  if (/物理|理科|理工/.test(text)) return "物理/理科";
  if (/历史|文科|文史/.test(text)) return "历史/文科";
  if (/综合/.test(text)) return "综合";
  return "";
}

function subjectForShard(shard) {
  const counts = new Map();
  for (const record of [...(shard.rankConversions || []), ...(shard.records || [])]) {
    const subject = normalizedSubject(record.subjectType);
    if (!subject) continue;
    const specialText = `${record.rankUsage || ""} ${record.batch || ""} ${record.majorName || ""}`;
    if (/艺术|体育|春季|职教|对口|单招/.test(specialText)) continue;
    counts.set(subject, (counts.get(subject) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "物理/理科";
}

function isVocationalRecord(record) {
  if (!record) return false;
  if (record.dataType === "vocational-admission") return true;
  return /专科|高职|对口/.test(`${record.batch || ""} ${record.educationLevel || ""}`) && !/本科/.test(String(record.batch || ""));
}

function profileFor(province, subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    rank: "",
    rankInput: "",
    province,
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankCategory: "",
    rankLevelUsage: "",
    electives: "化学 生物",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "",
    abilityProfile: "语文英语较强，数学物理中等，重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const rows = [];
const confidenceTotals = { A: 0, "A-": 0, B: 0, C: 0 };
let scenarioCount = 0;
let scoredRecommendationScenarios = 0;
let rankEstimatedScenarios = 0;
let rankMissingScenarios = 0;

for (const [province, entry] of Object.entries(manifest.shards)) {
  const shard = readGzipJson(path.join(releaseDir, `${entry.file}.gz`));
  api.setProvinceData(shard);
  const subject = subjectForShard(shard);
  const scoreScale = api.scoreScaleForProvince(province);
  const scores = [...new Set([0.25, 0.4, 0.55, 0.72, 0.9].map((ratio) => Math.round(scoreScale * ratio)))];
  const provinceRow = {
    province,
    subject,
    scoreScale,
    scenarios: 0,
    rankEstimated: 0,
    rankMissing: 0,
    vocational: 0,
    bands: new Set(),
    confidences: new Set(),
  };

  for (const [scoreIndex, score] of scores.entries()) {
    const profile = profileFor(province, subject, score);
    const rankEstimate = api.estimateRankFromScore(profile);
    if (rankEstimate) {
      profile.rank = String(rankEstimate.rank);
      profile.estimatedRank = rankEstimate.rank;
      profile.rankEstimateText = rankEstimate.text;
      provinceRow.rankEstimated += 1;
      rankEstimatedScenarios += 1;
    } else {
      provinceRow.rankMissing += 1;
      rankMissingScenarios += 1;
    }

    const vocational = api.isVocationalProfile(profile);
    const segmentStatus = api.ordinarySegmentStatus(profile);
    const band = api.classifyProfileBand(profile);
    const candidatePools = api.candidatePoolsForProfile(profile);
    if (!vocational && !["second", "below-second"].includes(segmentStatus?.band)) {
      assert.ok(candidatePools.every((candidate) => candidate.id !== "vocational-dual"), `${province} ${score}分 leaked the vocational candidate pool`);
    }
    provinceRow.scenarios += 1;
    provinceRow.vocational += vocational ? 1 : 0;
    provinceRow.bands.add(band.id);
    scenarioCount += 1;

    if (scoreIndex !== 2) continue;

    const candidateId = vocational && scoreIndex !== 0 ? "vocational-dual" : "engineering-industry";
    const candidate = candidatePools.find((item) => item.id === candidateId);
    assert.ok(candidate, `${province} ${score}分 is missing candidate pool ${candidateId}`);
    const results = [api.scoreCandidate(candidate, profile, band)];

    assert.equal(results.length, 1, `${province} ${score}分 did not score the selected candidate pool`);
    assert.ok(results.every((result) => Number.isInteger(result.total) && result.total >= 0 && result.total <= 96), `${province} ${score}分 produced an invalid model score`);
    assert.ok(results.every((result) => ["A", "A-", "B", "C"].includes(result.confidence)), `${province} ${score}分 produced an invalid confidence grade`);
    assert.ok(results.every((result) => result.schoolOptions.length > 0), `${province} ${score}分 produced an empty school option list`);

    if (!rankEstimate) {
      assert.ok(results.every((result) => !["A", "A-"].includes(result.confidence)), `${province} ${score}分 received high confidence without a rank`);
    }
    if (province === "西藏") {
      assert.ok(results.every((result) => !["A", "A-"].includes(result.confidence)), `Xizang ${score}分 exceeded its missing-rank/formal-score confidence ceiling`);
    }
    if (vocational) {
      assert.ok(results.filter((result) => !["vocational-dual", "regional-safe"].includes(result.id)).every((result) => result.total <= 48), `${province} ${score}分 leaked a high-scoring undergraduate-only pool`);
    } else if (!["second", "below-second"].includes(segmentStatus?.band)) {
      assert.ok(results.every((result) => result.schoolOptions.every((option) => !isVocationalRecord(option.record))), `${province} ${score}分 leaked a vocational admission/plan record`);
    }

    for (const result of results) {
      confidenceTotals[result.confidence] += 1;
      provinceRow.confidences.add(result.confidence);
    }
    scoredRecommendationScenarios += 1;
  }

  rows.push({
    ...provinceRow,
    bands: [...provinceRow.bands],
    confidences: [...provinceRow.confidences],
  });
}

api.setProvinceData(readGzipJson(path.join(releaseDir, `${manifest.shards["吉林"].file}.gz`)));
const jilinBelow = profileFor("吉林", "物理/理科", 300);
const jilinAbove = profileFor("吉林", "物理/理科", 350);
assert.equal(api.ordinaryBachelorControlLine(jilinBelow)?.score, 321);
assert.equal(api.isVocationalProfile(jilinBelow), true);
assert.equal(api.isVocationalProfile(jilinAbove), false);
assert.equal(api.isVocationalProfile({ ...jilinAbove, score: "650", rankUsage: "vocational" }), true, "explicit vocational score-table usage must control the education path");

api.setProvinceData(readGzipJson(path.join(releaseDir, `${manifest.shards["西藏"].file}.gz`)));
const xizangPhysicsB = profileFor("西藏", "物理/理科", 195);
xizangPhysicsB.candidateCategory = "B类考生";
assert.equal(api.ordinaryBachelorControlLine(xizangPhysicsB)?.score, 300);
assert.equal(api.ordinaryVocationalControlLine(xizangPhysicsB)?.score, 195);
assert.equal(api.isVocationalProfile({ ...xizangPhysicsB, score: "299" }), true);
assert.equal(api.isVocationalProfile({ ...xizangPhysicsB, score: "300" }), false);

api.setProvinceData(readGzipJson(path.join(releaseDir, `${manifest.shards["浙江"].file}.gz`)));
const zhejiang265 = profileFor("浙江", "综合", 265);
const zhejiang266 = profileFor("浙江", "综合", 266);
const zhejiang493 = profileFor("浙江", "综合", 493);
const zhejiang494 = profileFor("浙江", "综合", 494);
assert.equal(api.ordinaryBachelorControlLine(zhejiang494), null, "浙江第一段不得冒充本科控制线");
assert.equal(api.ordinaryVocationalControlLine(zhejiang266)?.score, 266, "浙江第二段只可作为最低分段边界");
assert.equal(api.ordinarySegmentStatus(zhejiang265)?.band, "below-second");
assert.equal(api.ordinarySegmentStatus(zhejiang266)?.band, "second");
assert.equal(api.ordinarySegmentStatus(zhejiang493)?.band, "second");
assert.equal(api.ordinarySegmentStatus(zhejiang494)?.band, "first");
assert.equal(api.isVocationalProfile(zhejiang265), false, "分段制线以下不得直接等同专科考生");
assert.ok(api.candidatePoolsForProfile(zhejiang265).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(zhejiang266).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(zhejiang493).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(zhejiang494).every((candidate) => candidate.id !== "vocational-dual"));
assert.equal(api.classifyProfileBand(zhejiang265).label, "普通类第二段线以下");
assert.equal(api.classifyProfileBand(zhejiang266).label, "普通类第二段");
assert.equal(api.classifyProfileBand(zhejiang493).label, "普通类第二段");
assert.equal(api.classifyProfileBand(zhejiang494).label, "普通类第一段");

const hainanHighRow = rows.find((row) => row.province === "海南");
assert.ok(hainanHighRow && hainanHighRow.scoreScale === 900);
assert.equal(scenarioCount, 155);
assert.equal(rows.length, 31);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: core.modelVersion,
  provinces: rows.length,
  scenarios: scenarioCount,
  scoredRecommendationScenarios,
  scoreScales: { standard: 750, Shanghai: 660, Hainan: 900 },
  rankEstimatedScenarios,
  rankMissingScenarios,
  confidenceTotals,
  rows,
}, null, 2));
