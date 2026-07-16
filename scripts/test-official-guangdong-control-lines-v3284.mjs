#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.305-pending-vocational-schedule-audit-and-ui-847238records";
const sourceId = "official-guangdong-control-lines-2026";
const rankSourceUrl = "https://eea.gd.gov.cn/ptgk/content/post_4916165.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guangdong-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guangdong-control-lines-2026-v3284-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const guangdong = readGzipJson(path.join(releaseDir, "guangdong.json.gz"));
const records = guangdong.records.filter((record) => record.sourceId === sourceId);
const rankRows = guangdong.rankConversions.filter((record) => record.year === 2026 && ["official-guangdong-rank-2026", "official-guangdong-special-rank-2026"].includes(record.sourceId));
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-guangdong-rank-2026");

assert.equal(imported.diagnostics.recordCount, 49);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  sports: 3,
  art: 18,
  special: 2,
  "local-special": 2,
  military: 3,
  "fire-rescue": 2,
  "teacher-special": 4,
  "health-special": 5,
  "minority-class": 2,
  preparatory: 4,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  historyBachelor: 440,
  historyVocational: 200,
  physicsBachelor: 425,
  physicsVocational: 200,
});
assert.equal(imported.diagnostics.professionalScoreRecords, 19);
assert.equal(imported.diagnostics.professionalQualificationRecords, 2);
assert.equal(records.length, 49);
assert.equal(new Set(records.map((record) => record.id)).size, 49);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 45);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 847238);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5110);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 847238);
assert.equal(manifest.rankConversionCount, 116656);
assert.equal(manifest.shards["广东"].records, 17644);
assert.equal(manifest.shards["广东"].rankConversions, 8816);
assert.equal(guangdong.rankConversions.length, 8816);
assert.equal(runtimeManifest.after.sourceRecords, 49);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 8816);
assert.equal(rankRows.length, 8816);
assert.ok(rankRows.every((record) => record.sourceUrl === rankSourceUrl));
assert.equal(sourceNote.quality, "official-guangdong-control-line-html-verified");
assert.equal(sourceNote.pageHtmlBytes, 23984);
assert.equal(sourceNote.pageHtmlSha256, "fba7a579d36918cda0bede7be5d0ebac92320629cb8d12f8f9cedba3b8353052");
assert.equal(rankSourceNote.pageHtmlBytes, 21284);
assert.equal(rankSourceNote.pageHtmlSha256, "1c121b0078eff38892a9a5920d20c4390a95843724d0830d30b2d5b50f3bcb7b");
assert.equal(rankSourceNote.provenanceRevision.canonicalRowsCompared, 1200);
assert.equal(rankSourceNote.provenanceRevision.canonicalMismatch, 0);
const physicsRankSource = rankSourceNote.subjects.find((subject) => subject.subjectType === "物理类");
assert.equal(physicsRankSource.previousPdfSha256, "650e82f720d9901de5568d90f19617123ba1ba203e85824f3a2fd88d182fc1f6");
assert.equal(physicsRankSource.pdfSha256, "9bde2c4aaddf28cf3c294e2fdde3fa76981ae2ec4c6df39185d34d6d31044f9f");
assert.equal(physicsRankSource.pdfBytes, 550540);
assert.deepEqual(runtimeManifest.after.rankPhysicsPdf, {
  previousSha256: "650e82f720d9901de5568d90f19617123ba1ba203e85824f3a2fd88d182fc1f6",
  currentSha256: "9bde2c4aaddf28cf3c294e2fdde3fa76981ae2ec4c6df39185d34d6d31044f9f",
  canonicalRowsCompared: 1200,
  canonicalMismatch: 0,
});

function findLine(subjectType, section, category) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineSection === section && record.majorGroup === category);
}

assert.equal(findLine("历史类", "本科", "普通类")?.minScore, 440);
assert.equal(findLine("物理类", "本科", "普通类")?.minScore, 425);
assert.equal(findLine("历史类", "高职专科", "普通类")?.minScore, 200);
assert.equal(findLine("物理类", "高职专科", "普通类")?.minScore, 200);
assert.equal(findLine("历史类", "特殊类型", "特殊类型招生")?.minScore, 546);
assert.equal(findLine("物理类", "特殊类型", "特殊类型招生")?.minScore, 539);
assert.equal(findLine("艺术类", "本科", "表（导）演类（戏剧影视导演）")?.professionalMinScore, 233);
assert.equal(findLine("艺术类", "高职专科", "戏曲类")?.professionalRequirement, "省际联考须合格");
assert.deepEqual(findLine("物理类", "本科预科", "边防军人子女预科班（指定院校）")?.applicableSchools, ["湖南大学", "重庆大学"]);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__guangdongControlTest = {
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
const api = context.__guangdongControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = guangdong.records;
api.state.data.admissionScoreLayer.rankConversions = guangdong.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    rank: "",
    province: "广东",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "广州 深圳 珠海",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const history199 = profile("历史/文科", 199);
const history200 = profile("历史/文科", 200);
const history439 = profile("历史/文科", 439);
const history440 = profile("历史/文科", 440);
const physics199 = profile("物理/理科", 199);
const physics200 = profile("物理/理科", 200);
const physics424 = profile("物理/理科", 424);
const physics425 = profile("物理/理科", 425);

assert.equal(api.ordinaryBachelorControlLine(history440)?.score, 440);
assert.equal(api.ordinaryBachelorControlLine(physics425)?.score, 425);
assert.equal(api.ordinaryVocationalControlLine(history200)?.score, 200);
assert.equal(api.ordinaryVocationalControlLine(physics200)?.score, 200);
assert.equal(api.isVocationalProfile(history439), true);
assert.equal(api.isVocationalProfile(history440), false);
assert.equal(api.isVocationalProfile(physics424), true);
assert.equal(api.isVocationalProfile(physics425), false);
assert.ok(api.candidatePoolsForProfile(history439).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(history440).every((candidate) => candidate.id !== "vocational-dual"));
assert.equal(api.classifyProfileBand(physics424).label, "专科/技能段");

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const belowHistory = api.scoreCandidate(vocationalCandidate, history199, api.classifyProfileBand(history199));
const atHistory = api.scoreCandidate(vocationalCandidate, history200, api.classifyProfileBand(history200));
const belowPhysics = api.scoreCandidate(vocationalCandidate, physics199, api.classifyProfileBand(physics199));
const atPhysics = api.scoreCandidate(vocationalCandidate, physics200, api.classifyProfileBand(physics200));
const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const historyBachelor = api.scoreCandidate(undergraduateCandidate, history440, api.classifyProfileBand(history440));
const physicsBachelor = api.scoreCandidate(undergraduateCandidate, physics425, api.classifyProfileBand(physics425));

for (const result of [belowHistory, belowPhysics]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.ok(result.reasons.every((reason) => !reason.includes("命中结构化录取数据")));
  assert.ok(result.reasons.some((reason) => reason.includes("不使用历史院校投档命中")));
  assert.ok(result.reasons.some((reason) => /普通类高职专科录取最低分数线200分/.test(reason)));
  assert.ok(result.warnings.some((warning) => /低于2026年普通类高职专科录取最低分数线200分/.test(warning)));
}
assert.equal(api.isBelowOrdinaryVocationalLine(history199), true);
assert.equal(api.isBelowOrdinaryVocationalLine(history200), false);
assert.equal(api.buildApplicationPlan([belowHistory]).length, 0);
for (const result of [atHistory, atPhysics]) {
  assert.ok(result.warnings.every((warning) => !/低于2026年普通类高职专科录取最低分数线200分/.test(warning)));
}
assert.ok(historyBachelor.reasons.some((reason) => /达到2026年广东历史\/文科普通类本科录取最低分数线440分/.test(reason)));
assert.ok(physicsBachelor.reasons.some((reason) => /达到2026年广东物理\/理科普通类本科录取最低分数线425分/.test(reason)));
assert.ok([historyBachelor, physicsBachelor].every((result) => result.reasons.some((reason) => reason.includes("不等于达到任何具体院校或专业投档线"))));

const specialOnly = records.filter((record) => record.formalScoreScope === "special-path-only");
api.state.data.admissionScoreLayer.records = specialOnly;
assert.equal(api.ordinaryBachelorControlLine(profile("", 600)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("", 600)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 45,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [199, 200, 424, 425, 439, 440] },
}, null, 2));
