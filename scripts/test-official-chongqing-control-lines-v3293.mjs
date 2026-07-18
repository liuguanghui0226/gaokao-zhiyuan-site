#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.314-ningxia-official-rank2025-aligned-868426records";
const sourceId = "official-chongqing-control-lines-2026";
const rankSourceId = "official-chongqing-rank-2026";
const rankHistoryUrl = "https://www.cqksy.cn/uploadFile/infopub/2026/ptgk/yfd/wk.htm";
const rankPhysicsUrl = "https://www.cqksy.cn/uploadFile/infopub/2026/ptgk/yfd/lk.htm";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-chongqing-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-chongqing-control-lines-2026-v3293-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const chongqing = readGzipJson(path.join(releaseDir, "chongqing.json.gz"));
const records = chongqing.records.filter((record) => record.sourceId === sourceId);
const rankRows = chongqing.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 28);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 24);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 22);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  art: 20,
  sports: 2,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  historyBachelor: 415,
  historyVocational: 180,
  physicsBachelor: 406,
  physicsVocational: 180,
});

assert.equal(records.length, 28);
assert.equal(new Set(records.map((record) => record.id)).size, 28);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 24);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 22);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 117615);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5118);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["重庆"].records, 62503);
assert.equal(manifest.shards["重庆"].rankConversions, 988);
assert.equal(runtimeManifest.after.sourceRecords, 28);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 988);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.cultureProfessionalRecords, 22);

assert.equal(rankRows.length, 988);
assert.ok(rankRows.filter((record) => record.subjectType === "历史类").every((record) => record.sourceUrl === rankHistoryUrl));
assert.ok(rankRows.filter((record) => record.subjectType === "物理类").every((record) => record.sourceUrl === rankPhysicsUrl));
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 484, "物理类": 504 });
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}

assert.equal(sourceNote.province, "重庆");
assert.equal(sourceNote.controlPageSha256, "a6c014a0c36243197ebbf45bac7d5d5a60ad193b2eed558168852727a729db2a");
assert.equal(sourceNote.governmentSummarySha256, "4929eb5b7407407fd20d5e11d820c2d70ccc25f9b1fb6e7645e08b20099a8104");
assert.equal(sourceNote.governmentCrossCheck.history.bachelorCumulative, 38962);
assert.equal(sourceNote.governmentCrossCheck.physics.bachelorCumulative, 107000);
assert.equal(rankSourceNote.governmentCrossCheck.sha256, sourceNote.governmentSummarySha256);
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 988);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directPageRedownloadStatus, "existing-hash-inventory-retained");

function findLine(subjectType, section, category) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineSection === section && record.majorGroup === category);
}

assert.equal(findLine("历史类", "本科", "普通类")?.minScore, 415);
assert.equal(findLine("历史类", "专科", "普通类")?.minScore, 180);
assert.equal(findLine("物理类", "本科", "普通类")?.minScore, 406);
assert.equal(findLine("物理类", "专科", "普通类")?.minScore, 180);
assert.equal(findLine("历史类", "特殊类型", "特殊类型资格线")?.minScore, 510);
assert.equal(findLine("物理类", "特殊类型", "特殊类型资格线")?.minScore, 496);
assert.equal(findLine("艺术类", "本科", "美术与设计类")?.professionalMinScore, 185);
assert.equal(findLine("艺术类", "专科", "音乐教育")?.minScore, 190);
assert.equal(findLine("艺术类", "本科", "戏剧影视导演")?.professionalMinScore, 205);
assert.equal(findLine("体育类", "本科", "体育类")?.professionalMinScore, 73);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreDimension === "culture-and-professional" && record.scoreBasis === "culture-score"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__chongqingControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  ordinaryVocationalQualificationStatus,
  isBelowOrdinaryVocationalLine,
  isVocationalProfile,
  candidatePoolsForProfile,
  classifyProfileBand,
  estimateRankFromScore,
  scoreCandidate,
  buildApplicationPlan,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__chongqingControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = chongqing.records;
api.state.data.admissionScoreLayer.rankConversions = chongqing.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "重庆",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "重庆 成都 西安",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor] of [["历史类", 415], ["物理类", 406]]) {
  const belowVocational = profile(subject, 179);
  const atVocational = profile(subject, 180);
  const belowBachelor = profile(subject, bachelor - 1);
  const atBachelor = profile(subject, bachelor);
  assert.equal(api.ordinaryBachelorControlLine(atBachelor)?.score, bachelor);
  assert.equal(api.ordinaryVocationalControlLine(atVocational)?.score, 180);
  assert.equal(api.isVocationalProfile(belowBachelor), true);
  assert.equal(api.isVocationalProfile(atBachelor), false);
  assert.equal(api.isBelowOrdinaryVocationalLine(belowVocational), true);
  assert.equal(api.isBelowOrdinaryVocationalLine(atVocational), false);
  assert.deepEqual([...api.candidatePoolsForProfile(belowBachelor).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
  assert.ok(api.candidatePoolsForProfile(atBachelor).every((candidate) => candidate.id !== "vocational-dual"));
  const belowResult = api.scoreCandidate(vocationalCandidate, belowVocational, api.classifyProfileBand(belowVocational));
  assert.equal(belowResult.confidence, "C");
  assert.ok(belowResult.total <= 42);
  assert.ok(belowResult.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.ok(belowResult.schoolOptions.every((option) => !/大学|学院/.test(option.name)));
  assert.equal(api.buildApplicationPlan([belowResult]).length, 0);
  assert.ok(belowResult.warnings.some((warning) => /低于2026年普通类专科批录取最低控制分数线180分/.test(warning)));
}

for (const [subject, checkpoints] of [
  ["历史类", [[180, 69810], [415, 38962], [510, 15208], [600, 2120], [663, 60], [700, 60], [750, 60]]],
  ["物理类", [[180, 135621], [406, 107000], [496, 65519], [600, 12895], [684, 157], [700, 157], [750, 157]]],
]) {
  assert.equal(api.estimateRankFromScore(profile(subject, 179)), null);
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact or bucket-exact`);
  }
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 24,
  cultureProfessionalRecords: 22,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [179, 180, 405, 406, 414, 415, 496, 510, 600, 663, 684, 700, 750, 751] },
}, null, 2));
