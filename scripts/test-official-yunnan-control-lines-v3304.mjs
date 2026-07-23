#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.328-shanghai-official-rank2025-policy-bonus-inclusive-undergraduate-floor-aligned-868426records";
const sourceId = "official-yunnan-control-lines-2026";
const rankSourceId = "official-yunnan-rank-2026";
const rankMirrorUrl = "https://t2.chei.com.cn/news/img/2293847809.png";
const rankImageSha256 = "2ab0fadc3af4f1d68ad15a14c5bf2a0514c5364723c12c2c32ff4224d7dc797a";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-yunnan-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-yunnan-control-lines-2026-v3304-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const yunnan = readGzipJson(path.join(releaseDir, "yunnan.json.gz"));
const records = yunnan.records.filter((record) => record.sourceId === sourceId);
const rankRows = yunnan.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 54);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 50);
assert.equal(imported.diagnostics.professionalNumericRecords, 44);
assert.equal(imported.diagnostics.professionalQualificationRecords, 4);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, art: 44, sports: 4 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 465, historyVocational: 180, physicsBachelor: 435, physicsVocational: 180 });
assert.equal(imported.diagnostics.rankRowsInventoryChecked, 986);
assert.equal(imported.diagnostics.rankRowsContinuityChecked, 986);
assert.equal(imported.diagnostics.retainedOcrCorrections, 32);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(records.length, 54);
assert.equal(new Set(records.map((record) => record.id)).size, 54);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 50);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 129194);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5132);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["云南"].records, 16022);
assert.equal(manifest.shards["云南"].rankConversions, 1966);
assert.equal(runtimeManifest.after.sourceRecords, 54);
assert.equal(runtimeManifest.after.rankRowsLinked, 986);
assert.equal(runtimeManifest.after.rankRowsInventoryChecked, 986);
assert.equal(runtimeManifest.after.rankRowsContinuityChecked, 986);
assert.equal(runtimeManifest.after.retainedOcrCorrections, 32);
assert.equal(runtimeManifest.after.topBucketRangeRepairs, 0);
assert.equal(runtimeManifest.after.rankValueChanges, 0);

assert.equal(sourceNote.province, "云南");
assert.equal(sourceNote.url, "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847730.html");
assert.equal(sourceNote.quality, "official-chsi-mirror-yunnan-exam-authority-control-line-images-verified");
assert.equal(sourceNote.directChsiMirrorRetrievalStatus, "success");
assert.equal(sourceNote.directOriginalRankPageRetrievalStatus, "blocked-current-session-tls");
assert.equal(sourceNote.evidence.chsiControlPage.sha256, "f7398a32eca5a5e5e04aba16ff71abffb5ad97628d3b49ddc87cf36e7fa1c676");
assert.equal(sourceNote.evidence.controlImage.sha256, "3a8c9c72b0af918d8edafab3eac6b85bfe93d5513c7b9d11109b5b4ce48fb2e6");
assert.equal(sourceNote.evidence.artProfessionalImage.sha256, "25b74f136750c48215999a47c0e8d62259abb3dd499cdca3f091247673eb4f4d");
assert.equal(sourceNote.evidence.rankImage.sha256, rankImageSha256);
assert.equal(sourceNote.rankEvidence.records, 986);
assert.equal(sourceNote.rankEvidence.imageByteIdentityWithStoredOfficialSource, true);
assert.equal(sourceNote.rankEvidence.retainedOcrCorrections, 32);
assert.equal(sourceNote.rankEvidence.valueChanges, 0);
assert.match(sourceNote.evidenceBoundary, /control-line-only=4; special-path-only=50/);

assert.equal(rankSourceNote.quality, "official-yunnan-rank-conversion-image-tesseract-validated");
assert.equal(rankSourceNote.imageSha256, rankImageSha256);
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 986);
assert.equal(rankSourceNote.provenanceRevision.rowsInventoryChecked, 986);
assert.equal(rankSourceNote.provenanceRevision.rowsContinuityChecked, 986);
assert.equal(rankSourceNote.provenanceRevision.retainedOcrCorrections, 32);
assert.equal(rankSourceNote.provenanceRevision.topBucketRangeRepairs, 0);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directChsiMirrorImageRedownloadStatus, "success-byte-identical-to-stored-official-image");
assert.equal(rankSourceNote.provenanceRevision.directOriginalPageRedownloadStatus, "blocked-current-session-tls");
assert.equal(rankSourceNote.provenanceRevision.officialImage.sha256, rankImageSha256);
assert.equal(rankSourceNote.provenanceRevision.officialImage.mirrorUrl, rankMirrorUrl);
assert.match(rankSourceNote.provenanceRevision.verificationScope, /all 986 runtime rows inventory and continuity checked/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 43559);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 118990);

assert.equal(rankRows.length, 986);
assert.deepEqual(Object.fromEntries(["文科", "理科"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "文科": 482, "理科": 504 });
assert.ok(rankRows.every((record) => record.sourceUrl === rankMirrorUrl));
assert.ok(rankRows.every((record) => String(record.sourceQuality).startsWith("official-yunnan-rank-conversion-image-tesseract-validated")));
assert.equal(rankRows.filter((record) => record.sourceQuality.endsWith("-top-boundary")).length, 2);
assert.equal(rankRows.filter((record) => record.scoreRange?.max === 750).length, 2);
for (const subject of ["文科", "理科"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}

function findLine(subjectType, routeKind, category, section) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category)
    && (!section || record.controlLineSection === section));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 465);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 180);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 435);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 180);
assert.equal(findLine("历史类", "special")?.minScore, 545);
assert.equal(findLine("物理类", "special")?.minScore, 505);
assert.deepEqual([
  findLine("历史类", "art", "书法类", "本科")?.minScore,
  findLine("历史类", "art", "书法类", "本科")?.professionalMinScore,
], [345, 190]);
assert.deepEqual([
  findLine("物理类", "art", "美术与设计类", "高职（专科）")?.minScore,
  findLine("物理类", "art", "美术与设计类", "高职（专科）")?.professionalMinScore,
], [180, 175]);
assert.equal(findLine("物理类", "sports", "体育类", "本科")?.minScore, 365);
assert.match(findLine("物理类", "sports", "体育类", "本科")?.professionalQualification, /相应录取要求/);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 44);
assert.equal(records.filter((record) => record.professionalQualification).length, 4);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreDimension === "culture-and-professional" && record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only"));
assert.ok(records.filter((record) => record.professionalQualification)
  .every((record) => !Number.isFinite(record.professionalMinScore) && record.scoreDimension === "culture-and-qualification" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__yunnanControlTest = {
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
const api = context.__yunnanControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = yunnan.records;
api.state.data.admissionScoreLayer.rankConversions = yunnan.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "云南",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "昆明 成都 重庆 广州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor] of [["历史类", 465], ["物理类", 435]]) {
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
  assert.ok(belowResult.warnings.some((warning) => warning.includes("180分")));
  assert.equal(api.estimateRankFromScore(belowVocational), null);
}

for (const [subject, checkpoints] of [
  ["历史类", [[180, 107628], [465, 43559], [545, 13390], [600, 2738], [661, 50], [700, 50], [750, 50]]],
  ["物理类", [[180, 177823], [435, 118990], [505, 67138], [600, 11493], [683, 52], [700, 52], [750, 52]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact or top-bucket exact`);
  }
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Yunnan special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Yunnan special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankRowsLinked: rankRows.length,
  rankRowsInventoryChecked: 986,
  rankRowsContinuityChecked: 986,
  retainedOcrCorrections: 32,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 50,
  numericProfessionalThresholds: 44,
  qualificationOnlyThresholds: 4,
  boundarySafety: { belowVocationalScore: 179, maxTotal: 42, confidence: "C", applicationPlanRows: 0 },
  testedScores: [179, 180, 434, 435, 464, 465, 505, 545, 600, 661, 683, 700, 750, 751],
}, null, 2));
