#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.286-beijing-control-lines2026-and-score-basis-846666records";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hunan-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hunan-control-lines-2026-v3283-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const hunan = readGzipJson(path.join(releaseDir, "hunan.json.gz"));
const records = hunan.records.filter((record) => record.sourceId === "official-hunan-control-lines-2026");
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-hunan-control-lines-2026");

assert.equal(imported.diagnostics.recordCount, 37);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  sports: 4,
  art: 9,
  counterpart: 18,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  historyBachelor: 446,
  historyVocational: 200,
  physicsBachelor: 400,
  physicsVocational: 200,
});
assert.equal(imported.diagnostics.professionalScoreRecords, 17);
assert.equal(records.length, 37);
assert.equal(new Set(records.map((record) => record.id)).size, 37);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 33);
assert.ok(records.filter((record) => record.controlLineRouteKind !== "ordinary-bachelor" && record.controlLineRouteKind !== "ordinary-vocational")
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 846666);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5092);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1020);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 846666);
assert.equal(manifest.shards["湖南"].records, 31914);
assert.equal(manifest.shards["湖南"].rankConversions, 1137);
assert.equal(hunan.rankConversions.length, 1137);
assert.equal(runtimeManifest.after.sourceRecords, 37);
assert.equal(sourceNote.quality, "official-hunan-control-line-images-ocr-verified");
assert.equal(sourceNote.pageHtmlSha256, "cf4e18a47cd675d8921f0e78c3a035dcdbc56312aa8bb74cc51bf03ac2df5aae");
assert.deepEqual(sourceNote.imageSha256, [
  "cf4db00a4178b9d1200f01b618131f8f6333fc47c45684186e4ab859e213840d",
  "e8c62b0004c40ba2cd6a42ec231caae7a8198ea3e1cd5eb8fb1fcfe9e05b20ea",
  "4913ecef2b20ecd6dff0307606e55c9afac418eab9791dca3f066e24c3306440",
]);

function findLine(subjectType, section, category) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineSection === section && record.majorGroup === category);
}

assert.equal(findLine("历史类", "本科", "普通类")?.minScore, 446);
assert.equal(findLine("物理类", "本科", "普通类")?.minScore, 400);
assert.equal(findLine("历史类", "高职专科", "普通类")?.minScore, 200);
assert.equal(findLine("物理类", "高职专科", "普通类")?.minScore, 200);
assert.equal(findLine("历史类", "特殊类型", "特殊类型招生")?.minScore, 494);
assert.equal(findLine("物理类", "特殊类型", "特殊类型招生")?.minScore, 481);
assert.equal(findLine("艺术类", "本科", "音乐类")?.professionalMinScore, 209);
assert.equal(findLine("艺术类", "本科", "美术与设计类")?.professionalMinScore, 197);
assert.equal(findLine("职高对口", "本科", "计算机类")?.minScore, 596);
assert.equal(findLine("职高对口", "本科", "美术类")?.professionalMinScore, 307);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__hunanControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  isBelowOrdinaryVocationalLine,
  isVocationalProfile,
  candidatePoolsForProfile,
  classifyProfileBand,
  scoreCandidate,
  buildApplicationPlan,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__hunanControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = hunan.records;
api.state.data.admissionScoreLayer.rankConversions = hunan.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    rank: "",
    province: "湖南",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "长沙 武汉 广州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const history199 = profile("历史/文科", 199);
const history200 = profile("历史/文科", 200);
const history445 = profile("历史/文科", 445);
const history446 = profile("历史/文科", 446);
const physics199 = profile("物理/理科", 199);
const physics200 = profile("物理/理科", 200);
const physics399 = profile("物理/理科", 399);
const physics400 = profile("物理/理科", 400);

assert.equal(api.ordinaryBachelorControlLine(history446)?.score, 446);
assert.equal(api.ordinaryBachelorControlLine(physics400)?.score, 400);
assert.equal(api.ordinaryVocationalControlLine(history200)?.score, 200);
assert.equal(api.ordinaryVocationalControlLine(physics200)?.score, 200);
assert.equal(api.isVocationalProfile(history445), true);
assert.equal(api.isVocationalProfile(history446), false);
assert.equal(api.isVocationalProfile(physics399), true);
assert.equal(api.isVocationalProfile(physics400), false);
assert.ok(api.candidatePoolsForProfile(history445).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(history446).every((candidate) => candidate.id !== "vocational-dual"));
assert.equal(api.classifyProfileBand(physics399).label, "专科/技能段");

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const belowHistory = api.scoreCandidate(vocationalCandidate, history199, api.classifyProfileBand(history199));
const atHistory = api.scoreCandidate(vocationalCandidate, history200, api.classifyProfileBand(history200));
const belowPhysics = api.scoreCandidate(vocationalCandidate, physics199, api.classifyProfileBand(physics199));
const atPhysics = api.scoreCandidate(vocationalCandidate, physics200, api.classifyProfileBand(physics200));
const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const historyBachelor = api.scoreCandidate(undergraduateCandidate, history446, api.classifyProfileBand(history446));
const physicsBachelor = api.scoreCandidate(undergraduateCandidate, physics400, api.classifyProfileBand(physics400));

for (const result of [belowHistory, belowPhysics]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.ok(result.reasons.every((reason) => !reason.includes("命中结构化录取数据")));
  assert.ok(result.reasons.some((reason) => reason.includes("不使用历史院校投档命中")));
  assert.ok(result.reasons.some((reason) => /高职专科录取控制分数线200分/.test(reason)));
  assert.ok(result.warnings.some((warning) => /低于2026年普通类高职专科录取控制分数线200分/.test(warning)));
}
assert.equal(api.isBelowOrdinaryVocationalLine(history199), true);
assert.equal(api.isBelowOrdinaryVocationalLine(history200), false);
assert.equal(api.buildApplicationPlan([belowHistory]).length, 0);
for (const result of [atHistory, atPhysics]) {
  assert.ok(result.warnings.every((warning) => !/低于2026年普通类高职专科录取控制分数线200分/.test(warning)));
}
assert.ok(historyBachelor.reasons.some((reason) => /达到2026年湖南历史\/文科普通类本科录取控制分数线446分/.test(reason)));
assert.ok(physicsBachelor.reasons.some((reason) => /达到2026年湖南物理\/理科普通类本科录取控制分数线400分/.test(reason)));
assert.ok([historyBachelor, physicsBachelor].every((result) => result.reasons.some((reason) => reason.includes("不等于达到任何具体院校或专业投档线"))));

const specialOnly = records.filter((record) => record.formalScoreScope === "special-path-only");
api.state.data.admissionScoreLayer.records = specialOnly;
assert.equal(api.ordinaryBachelorControlLine(profile("", 600)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("", 600)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 33,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [199, 200, 399, 400, 445, 446] },
}, null, 2));
