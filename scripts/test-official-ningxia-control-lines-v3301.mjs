#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.327-tianjin-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const sourceId = "official-ningxia-control-lines-2026";
const rankSourceId = "official-ningxia-rank-2026";
const historyRankUrl = "https://t2.chei.com.cn/news/getfile/2293847237-2293847211-6e97879425ea63e133cf22df41989fef.pdf";
const physicsRankUrl = "https://t2.chei.com.cn/news/getfile/2293847236-2293847211-cfba6e5fc57b5d9f67885f0b8626fe9a.pdf";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-ningxia-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-ningxia-control-lines-2026-v3301-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const ningxia = readGzipJson(path.join(releaseDir, "ningxia.json.gz"));
const records = ningxia.records.filter((record) => record.sourceId === sourceId);
const rankRows = ningxia.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 38);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 34);
assert.equal(imported.diagnostics.professionalNumericRecords, 32);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 4, art: 28 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 393, historyVocational: 150, physicsBachelor: 360, physicsVocational: 150 });
assert.equal(imported.diagnostics.rankRowsFullCrossChecked, 960);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(imported.diagnostics.officialZeroPersonGapEventsRetained, 12);
assert.equal(imported.diagnostics.officialZeroPersonScoresRetained, 20);
assert.equal(records.length, 38);
assert.equal(new Set(records.map((record) => record.id)).size, 38);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 34);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128972);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5131);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["宁夏"].records, 9257);
assert.equal(manifest.shards["宁夏"].rankConversions, 1919);
assert.equal(runtimeManifest.after.sourceRecords, 38);
assert.equal(runtimeManifest.after.rankRowsLinked, 960);
assert.equal(runtimeManifest.after.rankRowsFullCrossChecked, 960);
assert.equal(runtimeManifest.after.rankRowsContinuityChecked, 960);
assert.equal(runtimeManifest.after.officialZeroPersonGapEventsRetained, 12);
assert.equal(runtimeManifest.after.officialZeroPersonScoresRetained, 20);
assert.equal(runtimeManifest.after.rankValueChanges, 0);

assert.equal(sourceNote.province, "宁夏");
assert.equal(sourceNote.url, "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847132.html");
assert.equal(sourceNote.quality, "official-chsi-mirror-ningxia-education-department-control-line-images-verified");
assert.equal(sourceNote.directMirrorRetrievalStatus, "success");
assert.equal(sourceNote.evidence.chsiControlPage.sha256, "223f1de3edf360047a1ea636884d345c776be02e8a8191e11d7b300ba16db13a");
assert.equal(sourceNote.evidence.ordinaryImage.sha256, "4bb7ef514872495f4baf218f500ed3a9d498b4f98df81dddc19e785921cef724");
assert.equal(sourceNote.evidence.sportsImage.sha256, "29dbbf62d165ba229e16cdb247b2bc6ead831d7eca20afccb9992f2242eeb3a9");
assert.equal(sourceNote.evidence.artImage.sha256, "2b0144c9945d9caacd94ea311212c4e944e5908b32f9fc6fced10c050b92fe14");
assert.equal(sourceNote.evidence.historyPdf.sha256, "3c9ed5ff44c9841026873e4a405c951d2fa8b4207cc972d1362902ca5862f507");
assert.equal(sourceNote.evidence.physicsPdf.sha256, "19f9bd652b516435f4ded2ab92699881b987737b3c29a3ce8c891c69fcefa6b2");
assert.equal(sourceNote.rankEvidence.records, 960);
assert.equal(sourceNote.rankEvidence.valueChanges, 0);
assert.match(sourceNote.evidenceBoundary, /physics 150 rank unavailable/);

assert.equal(rankSourceNote.quality, "official-ningxia-rank-conversion-pdf");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 960);
assert.equal(rankSourceNote.provenanceRevision.rowsFullCrossChecked, 960);
assert.equal(rankSourceNote.provenanceRevision.rowsContinuityChecked, 960);
assert.equal(rankSourceNote.provenanceRevision.officialZeroPersonGapEventsRetained, 12);
assert.equal(rankSourceNote.provenanceRevision.officialZeroPersonScoresRetained, 20);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directOfficialMirrorRedownloadStatus, "success");
assert.match(rankSourceNote.provenanceRevision.verificationScope, /full 960-row extraction/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 9093);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 31395);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.vocationalRankEnd, null);

assert.equal(rankRows.length, 960);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 469, "物理类": 491 });
assert.ok(rankRows.every((record) => record.sourceUrl === (record.subjectType === "历史类" ? historyRankUrl : physicsRankUrl)));
assert.ok(rankRows.every((record) => record.sourceQuality === "official-ningxia-rank-conversion-pdf"));
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}
for (const score of [190, 182, 161, 160, 158, 156]) {
  assert.equal(rankRows.some((record) => record.subjectType === "历史类" && record.score === score), false, `History zero-person score ${score} must remain omitted`);
}
for (const score of [183, 181, 179, 178, 177, 176, 167, 166, 163, 162, 159, 157, 156, 155]) {
  assert.equal(rankRows.some((record) => record.subjectType === "物理类" && record.score === score), false, `Physics zero-person score ${score} must remain omitted`);
}

function findLine(subjectType, routeKind, category, section) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category)
    && (!section || record.controlLineSection === section));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 393);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 360);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("历史类", "special")?.minScore, 474);
assert.equal(findLine("物理类", "special")?.minScore, 437);
assert.deepEqual([findLine("历史类", "sports", "体育类", "本科")?.minScore, findLine("历史类", "sports", "体育类", "本科")?.professionalMinScore], [315, 73]);
assert.deepEqual([findLine("物理类", "sports", "体育类", "高职（专科）")?.minScore, findLine("物理类", "sports", "体育类", "高职（专科）")?.professionalMinScore], [150, 60]);
assert.deepEqual([findLine("历史类", "art", "戏曲类", "本科")?.minScore, findLine("历史类", "art", "戏曲类", "本科")?.professionalMinScore], [197, 180]);
assert.deepEqual([findLine("物理类", "art", "舞蹈类", "本科")?.minScore, findLine("物理类", "art", "舞蹈类", "本科")?.professionalMinScore], [252, 180]);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 32);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only" && record.professionalScoreDimension));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__ningxiaControlTest = {
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
const api = context.__ningxiaControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = ningxia.records;
api.state.data.admissionScoreLayer.rankConversions = ningxia.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "宁夏",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "银川 西安 兰州 成都",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 393, 150], ["物理类", 360, 150]]) {
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
}

for (const [subject, checkpoints] of [
  ["历史类", [[150, 19622], [393, 9093], [474, 3417], [600, 135], [624, 53]]],
  ["物理类", [[154, 44247], [360, 31395], [437, 16994], [600, 969], [658, 53]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact`);
  }
  assert.equal(api.estimateRankFromScore(profile(subject, 149)), null);
  assert.equal(api.estimateRankFromScore(profile(subject, subject === "历史类" ? 625 : 659)), null);
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}
assert.equal(api.estimateRankFromScore(profile("物理类", 150)), null, "Physics 150 rank must remain unavailable below the official table minimum of 154");

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Ningxia special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Ningxia special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  rankRowsFullCrossChecked: 960,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  specialPaths: 34,
  numericProfessionalThresholds: 32,
  officialZeroPersonGapEventsRetained: 12,
  officialZeroPersonScoresRetained: 20,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", physicsRankUnavailableAt150: true, testedScores: [149, 150, 154, 359, 360, 392, 393, 437, 474, 600, 624, 658, 659, 751] },
}, null, 2));
