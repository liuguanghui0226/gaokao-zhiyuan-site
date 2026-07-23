#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.329-anhui-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const sourceId = "official-shanxi-control-lines-2026";
const rankSourceId = "official-shanxi-rank-2026";
const rankUrls = {
  "历史类": "http://www.sxkszx.cn/news/2026625/n5905127212.html",
  "物理类": "http://www.sxkszx.cn/news/2026625/n2816127213.html",
};

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanxi-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanxi-control-lines-2026-v3303-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const shanxi = readGzipJson(path.join(releaseDir, "shanxi.json.gz"));
const records = shanxi.records.filter((record) => record.sourceId === sourceId);
const rankRows = shanxi.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 32);
assert.equal(imported.diagnostics.ordinaryRecords, 2);
assert.equal(imported.diagnostics.specialPathRecords, 30);
assert.equal(imported.diagnostics.professionalNumericRecords, 26);
assert.equal(imported.diagnostics.professionalQualificationRecords, 2);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, special: 2, "art-school-exam": 2, "art-opera": 2, art: 22, sports: 2 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 409, historyVocational: null, physicsBachelor: 401, physicsVocational: null });
assert.equal(imported.diagnostics.ordinaryVocationalStatus, "pending-official-release");
assert.equal(imported.diagnostics.rankRowsFullCorroborationCrossChecked, 555);
assert.equal(imported.diagnostics.rankRowsContinuityChecked, 555);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(records.length, 32);
assert.equal(new Set(records.map((record) => record.id)).size, 32);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 2);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 30);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 130155);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5133);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["山西"].records, 20681);
assert.equal(manifest.shards["山西"].rankConversions, 1587);
assert.equal(runtimeManifest.after.sourceRecords, 32);
assert.equal(runtimeManifest.after.rankRowsLinked, 555);
assert.equal(runtimeManifest.after.rankRowsFullCorroborationCrossChecked, 555);
assert.equal(runtimeManifest.after.rankRowsContinuityChecked, 555);
assert.equal(runtimeManifest.after.topBucketRangeRepairs, 0);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.ordinaryVocationalStatus, "pending-official-release");

assert.equal(sourceNote.province, "山西");
assert.equal(sourceNote.url, "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847661.html");
assert.equal(sourceNote.quality, "official-chsi-mirror-shanxi-admission-committee-control-lines-html-verified");
assert.equal(sourceNote.directChsiMirrorRetrievalStatus, "success");
assert.equal(sourceNote.directOfficialRetrievalStatus, "blocked-current-session-tls-and-http-403");
assert.equal(sourceNote.ordinaryVocationalStatus, "pending-official-release");
assert.match(sourceNote.ordinaryVocationalReason, /不以往年100分补造/);
assert.equal(sourceNote.evidence.chsiControlPage.sha256, "659f252c7a34bf61e136e5a34d56e5b461908301b231b96241d3869ef9467146");
assert.equal(sourceNote.evidence.chsiRankIndex.sha256, "74aafbc65e16a577cd351cd3bcd0b54b4c6b24b578715f2a283974a8bffdaf60");
assert.equal(sourceNote.evidence.eolRankCorroboration.sha256, "c55404ade9fb2db37ffdb39518a1f6b16c17057b9b3850bd10d358b987e4dbe0");
assert.equal(sourceNote.rankEvidence.records, 555);
assert.equal(sourceNote.rankEvidence.valueChanges, 0);
assert.match(sourceNote.evidenceBoundary, /ordinary vocational line=pending/);

assert.equal(rankSourceNote.quality, "official-shanxi-rank-conversion-html-table");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 555);
assert.equal(rankSourceNote.provenanceRevision.rowsFullCorroborationCrossChecked, 555);
assert.equal(rankSourceNote.provenanceRevision.rowsContinuityChecked, 555);
assert.equal(rankSourceNote.provenanceRevision.topBucketRangeRepairs, 0);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directOfficialPageRedownloadStatus, "blocked-current-session-tls-and-http-403");
assert.equal(rankSourceNote.provenanceRevision.chsiOfficialLinkIndexRetrievalStatus, "success");
assert.equal(rankSourceNote.provenanceRevision.corroborationMirrorRetrievalStatus, "success");
assert.match(rankSourceNote.provenanceRevision.verificationScope, /full 555-row table corroboration/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 35387);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 129364);

assert.equal(rankRows.length, 555);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 260, "物理类": 295 });
assert.ok(rankRows.every((record) => record.sourceUrl === rankUrls[record.subjectType]));
assert.ok(rankRows.every((record) => record.sourceQuality === "official-shanxi-rank-conversion-html-table"));
assert.equal(rankRows.filter((record) => record.scoreRange?.max === 750).length, 2);
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}

function findLine(subjectType, routeKind, category) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 409);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 401);
assert.equal(findLine("历史类", "special")?.minScore, 538);
assert.equal(findLine("物理类", "special")?.minScore, 524);
assert.deepEqual([findLine("历史类", "art-opera")?.minScore, findLine("历史类", "art-opera")?.professionalMinScore], [205, 180]);
assert.deepEqual([findLine("物理类", "sports")?.minScore, findLine("物理类", "sports")?.professionalMinScore], [321, 85]);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 26);
assert.equal(records.filter((record) => record.professionalQualification).length, 2);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only" && record.professionalScoreDimension));
assert.ok(!records.some((record) => record.controlLineRouteKind === "ordinary-vocational"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /普通高职专科控制线尚待官方发布/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__shanxiControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  pendingOrdinaryVocationalControlSource,
  ordinaryVocationalQualificationStatus,
  isVocationalProfile,
  candidatePoolsForProfile,
  classifyProfileBand,
  estimateRankFromScore,
  scoreCandidate,
  buildApplicationPlan,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__shanxiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shanxi.records;
api.state.data.admissionScoreLayer.rankConversions = shanxi.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "山西",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "太原 西安 北京 天津",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor] of [["历史类", 409], ["物理类", 401]]) {
  const below = profile(subject, bachelor - 1);
  const atLine = profile(subject, bachelor);
  assert.equal(api.ordinaryBachelorControlLine(atLine)?.score, bachelor);
  assert.equal(api.ordinaryVocationalControlLine(below), null);
  assert.equal(api.isVocationalProfile(below), true);
  assert.equal(api.isVocationalProfile(atLine), false);
  assert.equal(api.pendingOrdinaryVocationalControlSource(below)?.id, sourceId);
  assert.equal(api.pendingOrdinaryVocationalControlSource(atLine), null);
  assert.equal(api.ordinaryVocationalQualificationStatus(below).pending, true);
  assert.deepEqual([...api.candidatePoolsForProfile(below).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
  assert.ok(api.candidatePoolsForProfile(atLine).every((candidate) => candidate.id !== "vocational-dual"));
  const pendingResult = api.scoreCandidate(vocationalCandidate, below, api.classifyProfileBand(below));
  assert.equal(pendingResult.confidence, "C");
  assert.ok(pendingResult.total <= 55);
  assert.ok(pendingResult.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.ok(pendingResult.schoolOptions.every((option) => !/大学|学院/.test(option.name)));
  assert.equal(api.buildApplicationPlan([pendingResult]).length, 0);
  assert.ok(pendingResult.reasons.some((reason) => /普通高职专科控制线尚待官方发布/.test(reason)));
  assert.ok(pendingResult.warnings.some((warning) => /当前结果只作路径调研/.test(warning)));
  assert.equal(api.estimateRankFromScore(below), null);
  assert.equal(api.estimateRankFromScore(profile(subject, 150)), null);
}

for (const [subject, checkpoints] of [
  ["历史类", [[409, 35387], [538, 8512], [600, 1649], [668, 13], [700, 13], [750, 13]]],
  ["物理类", [[401, 129364], [524, 53482], [600, 14366], [695, 13], [700, 13], [750, 13]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact or top-bucket exact`);
  }
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Shanxi special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Shanxi special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  rankRowsFullCorroborationCrossChecked: 555,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  pendingVocationalLine: true,
  specialPaths: 30,
  numericProfessionalThresholds: 26,
  professionalQualificationRecords: 2,
  pendingLineSafety: { maxTotal: 55, confidence: "C", applicationPlanRows: 0 },
  testedScores: [150, 400, 401, 408, 409, 524, 538, 600, 668, 695, 700, 750, 751],
}, null, 2));
