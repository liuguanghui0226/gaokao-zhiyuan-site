#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.304-yunnan-control-lines2026-art-thresholds-and-rank-image-provenance-847238records";
const sourceId = "official-liaoning-control-lines-2026";
const rankSourceId = "official-liaoning-rank-2026";
const historyRankUrl = "https://www.lnzsks.com/lnzkbfiles/2026/lns2026gkcjtjb0624clhptlw02.pdf";
const physicsRankUrl = "https://www.lnzsks.com/lnzkbfiles/2026/lns2026gkcjtjb0624clhptll01.pdf";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-liaoning-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-liaoning-control-lines-2026-v3300-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const liaoning = readGzipJson(path.join(releaseDir, "liaoning.json.gz"));
const records = liaoning.records.filter((record) => record.sourceId === sourceId);
const rankRows = liaoning.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 16);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 12);
assert.equal(imported.diagnostics.professionalQualificationRecords, 10);
assert.equal(imported.diagnostics.professionalNumericRecords, 0);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 2, art: 8 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 442, historyVocational: 150, physicsBachelor: 344, physicsVocational: 150 });
assert.equal(imported.diagnostics.rankRowsInventoryChecked, 1076);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(records.length, 16);
assert.equal(new Set(records.map((record) => record.id)).size, 16);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 12);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 847238);
assert.equal(core.admissionScoreLayer.structuredRecords, 847238);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5110);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 847238);
assert.equal(manifest.shards["辽宁"].records, 33811);
assert.equal(manifest.shards["辽宁"].rankConversions, 1076);
assert.equal(runtimeManifest.after.sourceRecords, 16);
assert.equal(runtimeManifest.after.rankRowsLinked, 1076);
assert.equal(runtimeManifest.after.rankRowsInventoryChecked, 1076);
assert.equal(runtimeManifest.after.rankRowsContinuityChecked, 1076);
assert.equal(runtimeManifest.after.officialZeroPersonScoreGapsRetained, 4);
assert.equal(runtimeManifest.after.rankValueChanges, 0);

assert.equal(sourceNote.province, "辽宁");
assert.equal(sourceNote.url, "https://jyt.ln.gov.cn/jyt/jyzx/jyyw/2026063013492555300/index.shtml");
assert.equal(sourceNote.quality, "official-content-mirror-liaoning-education-government-and-chsi-verified");
assert.equal(sourceNote.directOriginalRetrievalStatus, "timed-out-current-session");
assert.equal(sourceNote.evidence.governmentControlPage.sha256, "78342d9274cee339f8fc25252f9de9bb745c93d8a96565553c360df1ce9cfd45");
assert.equal(sourceNote.evidence.governmentRankIndex.sha256, "3dcb7f67183aa319696596cb99dead220bbb58187a10a1303eed278ab932cac4");
assert.equal(sourceNote.evidence.chsiControlPage.sha256, "80c539ebaef02e2c09bc177910179bc8d72fa7cfe8b393237d8e6d27e1ba570d");
assert.equal(sourceNote.evidence.chsiRankIndex.sha256, "01a89ee35cf85f4f35a8ea60e58757e40bc40853c050d2927c708bed6a79420e");
assert.equal(sourceNote.rankEvidence.records, 1076);
assert.equal(sourceNote.rankEvidence.valueChanges, 0);
assert.match(sourceNote.evidenceBoundary, /not institution, major or admission probability/);

assert.equal(rankSourceNote.quality, "official-liaoning-rank-conversion-pdf");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 1076);
assert.equal(rankSourceNote.provenanceRevision.rowsInventoryChecked, 1076);
assert.equal(rankSourceNote.provenanceRevision.rowsContinuityChecked, 1076);
assert.equal(rankSourceNote.provenanceRevision.officialZeroPersonScoreGapsRetained, 4);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.match(rankSourceNote.provenanceRevision.directOfficialRedownloadStatus, /timed-out-current-session/);
assert.match(rankSourceNote.provenanceRevision.verificationScope, /no fresh full-PDF row extraction/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 24410);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 119069);

assert.equal(rankRows.length, 1076);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 518, "物理类": 558 });
assert.ok(rankRows.every((record) => record.sourceUrl === (record.subjectType === "历史类" ? historyRankUrl : physicsRankUrl)));
assert.ok(rankRows.every((record) => record.sourceQuality === "official-liaoning-rank-conversion-pdf"));
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}
for (const [subject, score] of [["历史类", 671], ["历史类", 670], ["历史类", 669], ["历史类", 173], ["历史类", 157], ["物理类", 151]]) {
  assert.equal(rankRows.some((record) => record.subjectType === subject && record.score === score), false, `Official zero-person score ${subject}/${score} must remain omitted`);
}

function findLine(subjectType, routeKind, category) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 442);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 344);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("历史类", "special")?.minScore, 527);
assert.equal(findLine("物理类", "special")?.minScore, 508);
assert.equal(findLine("历史类", "sports", "体育类")?.minScore, 150);
assert.equal(findLine("物理类", "sports", "体育类")?.minScore, 150);
assert.equal(findLine("历史类", "art", "艺术类本科普通专业文化线")?.minScore, 331);
assert.equal(findLine("物理类", "art", "艺术类本科普通专业文化线")?.minScore, 258);
assert.equal(findLine("历史类", "art", "戏曲类专业文化线")?.minScore, 221);
assert.equal(findLine("物理类", "art", "戏曲类专业文化线")?.minScore, 172);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 0);
assert.equal(records.filter((record) => record.professionalQualification).length, 10);
assert.ok(records.filter((record) => record.professionalQualification)
  .every((record) => record.scoreDimension === "culture-and-qualification" && record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__liaoningControlTest = {
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
const api = context.__liaoningControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = liaoning.records;
api.state.data.admissionScoreLayer.rankConversions = liaoning.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "辽宁",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "沈阳 大连 鞍山 锦州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 442, 150], ["物理类", 344, 150]]) {
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
  ["历史类", [[150, 52453], [442, 24410], [527, 10124], [600, 2200], [672, 12], [750, 12]]],
  ["物理类", [[150, 141691], [344, 119069], [508, 49824], [600, 14235], [708, 10], [750, 10]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact or bucket-exact`);
  }
  assert.equal(api.estimateRankFromScore(profile(subject, 149)), null);
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Liaoning special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Liaoning special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  rankRowsInventoryAndContinuityChecked: 1076,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  specialPaths: 12,
  professionalQualificationRecords: 10,
  numericProfessionalThresholdsInvented: 0,
  officialZeroPersonScoreGapsRetained: 4,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [149, 150, 343, 344, 441, 442, 508, 527, 600, 672, 708, 750, 751] },
}, null, 2));
