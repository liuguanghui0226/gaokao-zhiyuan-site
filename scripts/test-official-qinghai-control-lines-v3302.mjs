#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.319-jiangsu-jseea-first-stage-rank2025-aligned-868426records";
const sourceId = "official-qinghai-control-lines-2026";
const rankSourceId = "official-qinghai-rank-2026";
const rankPdfUrl = "https://t2.chei.com.cn/news/getfile/2293847239-2293847238-8f4911ad66a2a5465806d4e60d7dd2d9.pdf";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-qinghai-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-qinghai-control-lines-2026-v3302-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const qinghai = readGzipJson(path.join(releaseDir, "qinghai.json.gz"));
const records = qinghai.records.filter((record) => record.sourceId === sourceId);
const rankRows = qinghai.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 19);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 15);
assert.equal(imported.diagnostics.professionalNumericRecords, 5);
assert.equal(imported.diagnostics.professionalQualificationRecords, 8);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, "minority-language": 5, sports: 4, art: 4 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 376, historyVocational: 150, physicsBachelor: 344, physicsVocational: 150 });
assert.equal(imported.diagnostics.rankRowsFullCrossChecked, 957);
assert.equal(imported.diagnostics.topBucketRangeRepairs, 2);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(imported.diagnostics.officialZeroPersonGapEventsRetained, 46);
assert.equal(imported.diagnostics.officialZeroPersonScoresRetained, 336);
assert.equal(records.length, 19);
assert.equal(new Set(records.map((record) => record.id)).size, 19);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 15);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 122287);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5123);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["青海"].records, 5182);
assert.equal(manifest.shards["青海"].rankConversions, 2432);
assert.equal(runtimeManifest.after.sourceRecords, 19);
assert.equal(runtimeManifest.after.rankConversions, 2432);
assert.equal(runtimeManifest.after.rankRowsLinked, 957);
assert.equal(runtimeManifest.after.rankRowsFullCrossChecked, 957);
assert.equal(runtimeManifest.after.rankRowsContinuityChecked, 957);
assert.equal(runtimeManifest.after.officialZeroPersonGapEventsRetained, 46);
assert.equal(runtimeManifest.after.officialZeroPersonScoresRetained, 336);
assert.equal(runtimeManifest.after.topBucketRangeRepairs, 2);
assert.equal(runtimeManifest.after.rankValueChanges, 0);

assert.equal(sourceNote.province, "青海");
assert.equal(sourceNote.url, "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847208.html");
assert.equal(sourceNote.quality, "official-chsi-mirror-qinghai-exam-authority-control-line-image-verified");
assert.equal(sourceNote.directMirrorRetrievalStatus, "success");
assert.equal(sourceNote.evidence.chsiControlPage.sha256, "1fe2e61d55d76ce3ea73c4ea0608aa6357fe95a062cdf3b557c07921b34a4e5f");
assert.equal(sourceNote.evidence.controlImage.sha256, "340c17fe0151884b8d588629944edc286a85008355b862353bf639c680f7ce5b");
assert.equal(sourceNote.evidence.chsiRankIndex.sha256, "e6449bb8e6bdd46d540080f7ee4bb9a1df707eb9d12e68d2e35263d0cc3bf012");
assert.equal(sourceNote.evidence.rankPdf.sha256, "4aae2d39d60ace58a794c2f47aa93b93a5b1077e074b4f66255d7f37f01585e8");
assert.equal(sourceNote.rankEvidence.records, 957);
assert.equal(sourceNote.rankEvidence.valueChanges, 0);
assert.equal(sourceNote.rankEvidence.topBucketRangeRepairs, 2);
assert.match(sourceNote.evidenceBoundary, /both 150 rank rows unavailable/);

assert.equal(rankSourceNote.quality, "official-qinghai-rank-conversion-pdf");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 957);
assert.equal(rankSourceNote.provenanceRevision.rowsFullCrossChecked, 957);
assert.equal(rankSourceNote.provenanceRevision.rowsContinuityChecked, 957);
assert.equal(rankSourceNote.provenanceRevision.officialZeroPersonGapEventsRetained, 46);
assert.equal(rankSourceNote.provenanceRevision.officialZeroPersonScoresRetained, 336);
assert.equal(rankSourceNote.provenanceRevision.topBucketRangeRepairs, 2);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directOfficialMirrorRedownloadStatus, "success");
assert.match(rankSourceNote.provenanceRevision.verificationScope, /full 957-row extraction/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 6185);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 20662);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.vocationalRankEnd, null);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.vocationalRankEnd, null);

assert.equal(rankRows.length, 957);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 468, "物理类": 489 });
assert.ok(rankRows.every((record) => record.sourceUrl === rankPdfUrl));
assert.ok(rankRows.every((record) => record.sourceQuality === "official-qinghai-rank-conversion-pdf"));
assert.equal(rankRows.filter((record) => record.scoreRange?.max === 750).length, 2);
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
  assert.equal(rows.some((record) => record.score === 150), false, `${subject}/150 must remain an official zero-person score`);
}

function findLine(subjectType, routeKind, category, section) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category)
    && (!section || record.controlLineSection === section));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 376);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 344);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("历史类", "special")?.minScore, 427);
assert.equal(findLine("物理类", "special")?.minScore, 417);
assert.deepEqual([findLine("历史类", "minority-language", "高校民族语言授课专业-藏文类", "本科")?.minScore, findLine("历史类", "minority-language", "高校民族语言授课专业-藏文类", "本科")?.professionalMinScore], [356, 40]);
assert.deepEqual([findLine("物理类", "minority-language", "高校民族语言授课专业-蒙文类", "本科")?.minScore, findLine("物理类", "minority-language", "高校民族语言授课专业-蒙文类", "本科")?.professionalMinScore], [280, 40]);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 5);
assert.equal(records.filter((record) => record.professionalQualification).length, 8);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only" && record.professionalScoreDimension));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__qinghaiControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
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
const api = context.__qinghaiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = qinghai.records;
api.state.data.admissionScoreLayer.rankConversions = qinghai.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "青海",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "西宁 西安 兰州 成都",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 376, 150], ["物理类", 344, 150]]) {
  const belowVocational = profile(subject, vocational - 1);
  const atVocational = profile(subject, vocational);
  const belowBachelor = profile(subject, bachelor - 1);
  const atBachelor = profile(subject, bachelor);
  assert.equal(api.ordinaryBachelorControlLine(atBachelor)?.score, bachelor);
  assert.equal(api.ordinaryVocationalControlLine(atVocational)?.score, vocational);
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
  assert.ok(belowResult.warnings.some((warning) => warning.includes("150分")));
  const vocationalEstimate = api.estimateRankFromScore(atVocational);
  const expectedNearest = subject === "历史类" ? { score: 149, rank: 15069 } : { score: 155, rank: 31461 };
  assert.equal(vocationalEstimate?.exact, false, `${subject}/150 must not be presented as an exact official row`);
  assert.equal(vocationalEstimate?.score, expectedNearest.score, `${subject}/150 nearest-score basis drifted`);
  assert.equal(vocationalEstimate?.rank, expectedNearest.rank, `${subject}/150 approximate rank drifted`);
}

for (const [subject, checkpoints] of [
  ["历史类", [[376, 6185], [427, 3139], [600, 61], [625, 11], [700, 11], [750, 11]]],
  ["物理类", [[344, 20662], [417, 10682], [600, 484], [676, 11], [700, 11], [750, 11]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact or top-bucket exact`);
  }
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Qinghai special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Qinghai special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  rankRowsFullCrossChecked: 957,
  topBucketRangeRepairs: 2,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  specialPaths: 15,
  numericLanguageThresholds: 5,
  professionalQualificationRecords: 8,
  officialZeroPersonGapEventsRetained: 46,
  officialZeroPersonScoresRetained: 336,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", exactRankUnavailableAt150: true, nearestScoreApproximationRequired: true, testedScores: [149, 150, 343, 344, 375, 376, 417, 427, 600, 625, 676, 700, 750, 751] },
}, null, 2));
