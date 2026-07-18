#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.312-xinjiang-official-2025-undergraduate2-score-only-868426records";
const sourceId = "official-anhui-control-lines-2026";
const rankSourceUrl = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847718.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-anhui-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-anhui-control-lines-2026-v3285-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const anhui = readGzipJson(path.join(releaseDir, "anhui.json.gz"));
const records = anhui.records.filter((record) => record.sourceId === sourceId);
const rankRows = anhui.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-anhui-rank-2026");
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-anhui-rank-2026");

assert.equal(imported.diagnostics.recordCount, 52);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  sports: 4,
  art: 42,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  historyBachelor: 490,
  historyVocational: 200,
  physicsBachelor: 451,
  physicsVocational: 200,
});
assert.equal(imported.diagnostics.professionalScoreRecords, 40);
assert.equal(imported.diagnostics.professionalQualificationRecords, 2);
assert.equal(records.length, 52);
assert.equal(new Set(records.map((record) => record.id)).size, 52);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 48);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5117);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 116656);
assert.equal(manifest.shards["安徽"].records, 16250);
assert.equal(manifest.shards["安徽"].rankConversions, 976);
assert.equal(anhui.rankConversions.length, 976);
assert.equal(runtimeManifest.after.sourceRecords, 52);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 976);
assert.equal(rankRows.length, 976);
assert.ok(rankRows.every((record) => record.sourceUrl === rankSourceUrl));

assert.equal(sourceNote.quality, "official-anhui-control-line-chsi-and-government-image-verified");
assert.equal(sourceNote.pageHtmlSha256, "1523c6a6a935cfe4b3ff284f694e8788a46e2edc836eb022dbd9cab56c3ae099");
assert.equal(sourceNote.imageSha256, "9761df950662518da62273f02405988502f0c39c01a3d69ab24ae58be65fd04b");
assert.equal(sourceNote.governmentPageHtmlSha256, "91f15a15e8083a049a6d032f6bd09d7bf633914b08111762fab3608a3cb44a9c");
assert.equal(sourceNote.governmentImageSha256, "d33d0e946068916663584237da62cb0255143f598352ac4b1119a38f9e002e8e");
assert.equal(rankSourceNote.pageHtmlBytes, 45088);
assert.equal(rankSourceNote.pageHtmlSha256, "277b7b3c9f9dca0a3f38f1eab83bba4a9696e2bb34474f553a34f95ecfd5828b");
assert.equal(rankSourceNote.pdfSha256, "a11a2b14f739a39dac0a3589b8bb862512b6e36ad995a0922b82a90c630a2b0f");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 976);
assert.equal(rankSourceNote.provenanceRevision.pdfMismatch, 0);

function findLine(subjectType, section, category) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineSection === section && record.majorGroup === category);
}

assert.equal(findLine("历史类", "本科", "普通类")?.minScore, 490);
assert.equal(findLine("物理类", "本科", "普通类")?.minScore, 451);
assert.equal(findLine("历史类", "高职（专科）", "普通类")?.minScore, 200);
assert.equal(findLine("物理类", "高职（专科）", "普通类")?.minScore, 200);
assert.equal(findLine("历史类", "特殊类型", "特殊类型招生")?.minScore, 522);
assert.equal(findLine("物理类", "特殊类型", "特殊类型招生")?.minScore, 514);
assert.deepEqual(
  { culture: findLine("历史类", "本科", "播音与主持类")?.minScore, professional: findLine("历史类", "本科", "播音与主持类")?.professionalMinScore },
  { culture: 490, professional: 128 },
);
assert.deepEqual(
  { culture: findLine("物理类", "本科", "美术与设计类")?.minScore, professional: findLine("物理类", "本科", "美术与设计类")?.professionalMinScore },
  { culture: 338, professional: 154 },
);
assert.deepEqual(
  { culture: findLine("历史类", "高职（专科）", "书法类")?.minScore, professional: findLine("历史类", "高职（专科）", "书法类")?.professionalMinScore },
  { culture: 160, professional: 193 },
);
assert.equal(findLine("物理类", "本科", "戏曲类（省际联考）")?.minScore, 226);
assert.equal(findLine("物理类", "本科", "戏曲类（省际联考）")?.professionalRequirement, "戏曲类省际联考合格");

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__anhuiControlTest = {
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
const api = context.__anhuiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = anhui.records;
api.state.data.admissionScoreLayer.rankConversions = anhui.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    rank: "",
    province: "安徽",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "合肥 南京 杭州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const history199 = profile("历史/文科", 199);
const history200 = profile("历史/文科", 200);
const history489 = profile("历史/文科", 489);
const history490 = profile("历史/文科", 490);
const physics199 = profile("物理/理科", 199);
const physics200 = profile("物理/理科", 200);
const physics450 = profile("物理/理科", 450);
const physics451 = profile("物理/理科", 451);

assert.equal(api.ordinaryBachelorControlLine(history490)?.score, 490);
assert.equal(api.ordinaryBachelorControlLine(physics451)?.score, 451);
assert.equal(api.ordinaryVocationalControlLine(history200)?.score, 200);
assert.equal(api.ordinaryVocationalControlLine(physics200)?.score, 200);
assert.equal(api.isVocationalProfile(history489), true);
assert.equal(api.isVocationalProfile(history490), false);
assert.equal(api.isVocationalProfile(physics450), true);
assert.equal(api.isVocationalProfile(physics451), false);
assert.ok(api.candidatePoolsForProfile(history489).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(history490).every((candidate) => candidate.id !== "vocational-dual"));

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const belowHistory = api.scoreCandidate(vocationalCandidate, history199, api.classifyProfileBand(history199));
const atHistory = api.scoreCandidate(vocationalCandidate, history200, api.classifyProfileBand(history200));
const belowPhysics = api.scoreCandidate(vocationalCandidate, physics199, api.classifyProfileBand(physics199));
const atPhysics = api.scoreCandidate(vocationalCandidate, physics200, api.classifyProfileBand(physics200));
const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const historyBachelor = api.scoreCandidate(undergraduateCandidate, history490, api.classifyProfileBand(history490));
const physicsBachelor = api.scoreCandidate(undergraduateCandidate, physics451, api.classifyProfileBand(physics451));

for (const result of [belowHistory, belowPhysics]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.ok(result.reasons.every((reason) => !reason.includes("命中结构化录取数据")));
  assert.ok(result.reasons.some((reason) => reason.includes("不使用历史院校投档命中")));
  assert.ok(result.warnings.some((warning) => /高职（专科）文化课录取控制分数线200分/.test(warning)));
}
assert.equal(api.isBelowOrdinaryVocationalLine(history199), true);
assert.equal(api.isBelowOrdinaryVocationalLine(history200), false);
assert.equal(api.buildApplicationPlan([belowHistory]).length, 0);
for (const result of [atHistory, atPhysics]) {
  assert.ok(result.warnings.every((warning) => !/低于2026年普通类高职（专科）文化课录取控制分数线200分/.test(warning)));
}
assert.ok(historyBachelor.reasons.some((reason) => /安徽历史\/文科普通类本科文化课录取控制分数线490分/.test(reason)));
assert.ok(physicsBachelor.reasons.some((reason) => /安徽物理\/理科普通类本科文化课录取控制分数线451分/.test(reason)));
assert.ok([historyBachelor, physicsBachelor].every((result) => result.reasons.some((reason) => reason.includes("不等于达到任何具体院校或专业投档线"))));

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("", 600)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("", 600)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 48,
  artDoubleThresholdRecords: 42,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [199, 200, 450, 451, 489, 490] },
}, null, 2));
