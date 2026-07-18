#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.309-national-school-official-qlu2021-2025-native-rank-859382records";
const sourceId = "official-jiangsu-control-lines-2026";
const rankSourceId = "official-jiangsu-rank-2026";
const historyRankUrl = "https://www.jseea.cn/webfile/upload/2026/06-24/18-24-3205871556923388.jpg";
const physicsRankUrl = "https://www.jseea.cn/webfile/upload/2026/06-24/18-24-3208191910823240.jpg";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-jiangsu-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-jiangsu-control-lines-2026-v3299-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const jiangsu = readGzipJson(path.join(releaseDir, "jiangsu.json.gz"));
const records = jiangsu.records.filter((record) => record.sourceId === sourceId);
const rankRows = jiangsu.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 28);
assert.equal(imported.diagnostics.ordinaryRecords, 2);
assert.equal(imported.diagnostics.specialPathRecords, 26);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 20);
assert.equal(imported.diagnostics.professionalQualificationRecords, 4);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, special: 2, sports: 2, art: 18, "art-school-exam": 2, "opera-joint-exam": 2 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 484, historyVocational: null, physicsBachelor: 456, physicsVocational: null });
assert.equal(imported.diagnostics.ordinaryVocationalStatus, "pending-official-release");
assert.equal(imported.diagnostics.rankRowsInventoryChecked, 408);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(imported.diagnostics.scoreMaximum, 750);
assert.equal(records.length, 28);
assert.equal(new Set(records.map((record) => record.id)).size, 28);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 2);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 26);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 859382);
assert.equal(core.admissionScoreLayer.structuredRecords, 859382);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5114);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 859382);
assert.equal(manifest.shards["江苏"].records, 26833);
assert.equal(manifest.shards["江苏"].rankConversions, 408);
assert.equal(runtimeManifest.after.sourceRecords, 28);
assert.equal(runtimeManifest.after.rankRowsLinked, 408);
assert.equal(runtimeManifest.after.rankRowsInventoryChecked, 408);
assert.equal(runtimeManifest.after.rankRowsContinuityChecked, 408);
assert.equal(runtimeManifest.after.priorVisionCorrectionsRetained, 12);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.ordinaryVocationalStatus, "pending-official-release");

assert.equal(sourceNote.province, "江苏");
assert.equal(sourceNote.url, "https://www.jseea.cn/webfile/index/index_zkxx/2026-06-24/7475450259783553024.html");
assert.equal(sourceNote.quality, "official-jiangsu-first-stage-control-line-image-manually-verified");
assert.equal(sourceNote.ordinaryVocationalStatus, "pending-official-release");
assert.match(sourceNote.ordinaryVocationalReason, /第二阶段/);
assert.equal(sourceNote.ordinaryVocationalSchedule.fillingStartsAt, "2026-07-27");
assert.equal(sourceNote.ordinaryVocationalSchedule.fillingEndsAt, "2026-07-28T17:00:00+08:00");
assert.equal(sourceNote.evidence.controlPage.sha256, "d08db6c1748e2b762a93c3f035831e26280efd2cd6daad4a5dc934b3b2745ce5");
assert.equal(sourceNote.evidence.controlImage.sha256, "f4815a19ec6452887aa8007bb57c88f16ace5382ed4a25ab754ca1a3d81837b5");
assert.equal(sourceNote.evidence.controlImage.width, 1080);
assert.equal(sourceNote.evidence.controlImage.height, 626);
assert.equal(sourceNote.evidence.rankHistory.sha256, "c90751acf88c8cc0129f7cb11c0e48736832a39688bdbf98a49245313b2de46b");
assert.equal(sourceNote.evidence.rankPhysics.sha256, "90b38029cd2e345c28400f1cfa9ebaf66030bec6e32b6a06070713fa5af56c96");
assert.equal(sourceNote.rankEvidence.records, 408);
assert.equal(sourceNote.rankEvidence.priorVisionCorrectionsRetained, 12);
assert.equal(sourceNote.rankEvidence.valueChanges, 0);
assert.match(sourceNote.evidenceBoundary, /not institution-group, institution or major admission score/);

assert.equal(rankSourceNote.quality, "official-jiangsu-rank-conversion-image-vision-validated");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 408);
assert.equal(rankSourceNote.provenanceRevision.rowsInventoryChecked, 408);
assert.equal(rankSourceNote.provenanceRevision.rowsContinuityChecked, 408);
assert.equal(rankSourceNote.provenanceRevision.priorVisionCorrectionsRetained, 12);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directOfficialRedownloadStatus, "success");
assert.match(rankSourceNote.provenanceRevision.verificationScope, /no fresh full-image row OCR/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 54036);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 217438);

assert.equal(rankRows.length, 408);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 174, "物理类": 234 });
assert.ok(rankRows.every((record) => record.sourceUrl === (record.subjectType === "历史类" ? historyRankUrl : physicsRankUrl)));
assert.ok(rankRows.every((record) => /official-jiangsu-rank-conversion-image-vision-validated/.test(record.sourceQuality)));
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

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 484);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 456);
assert.equal(findLine("历史类", "special")?.minScore, 532);
assert.equal(findLine("物理类", "special")?.minScore, 513);
assert.equal(findLine("历史类", "sports", "体育类")?.minScore, 413);
assert.equal(findLine("历史类", "sports", "体育类")?.professionalMinScore, 110);
assert.equal(findLine("物理类", "sports", "体育类")?.professionalMinScore, 110);
assert.equal(findLine("历史类", "art", "音乐表演（声乐、器乐）")?.minScore, 330);
assert.equal(findLine("历史类", "art", "音乐表演（声乐、器乐）")?.professionalMinScore, 180);
assert.equal(findLine("物理类", "art", "舞蹈类")?.minScore, 279);
assert.equal(findLine("物理类", "art", "舞蹈类")?.professionalMinScore, 185);
assert.equal(findLine("历史类", "art", "书法类")?.professionalMinScore, 210);
assert.equal(findLine("历史类", "art-school-exam", "艺术类校考")?.minScore, 484);
assert.match(findLine("物理类", "art-school-exam", "艺术类校考")?.professionalQualification, /校考合格/);
assert.equal(findLine("历史类", "opera-joint-exam", "戏曲类省际联考")?.minScore, 242);
assert.equal(findLine("物理类", "opera-joint-exam", "戏曲类省际联考")?.minScore, 228);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 20);
assert.equal(records.filter((record) => record.professionalQualification).length, 4);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreDimension === "culture-and-professional" && record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /2026年普通专科控制线待发布/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__jiangsuControlTest = {
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
const api = context.__jiangsuControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = jiangsu.records;
api.state.data.admissionScoreLayer.rankConversions = jiangsu.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "江苏",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "南京 苏州 无锡 常州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor] of [["历史类", 484], ["物理类", 456]]) {
  const below = profile(subject, bachelor - 1);
  const atLine = profile(subject, bachelor);
  assert.equal(api.ordinaryBachelorControlLine(atLine)?.score, bachelor);
  assert.equal(api.ordinaryVocationalControlLine(below), null);
  assert.equal(api.isVocationalProfile(below), true);
  assert.equal(api.isVocationalProfile(atLine), false);
  assert.equal(api.pendingOrdinaryVocationalControlSource(below)?.id, sourceId);
  assert.equal(api.pendingOrdinaryVocationalControlSource(atLine), null);
  assert.equal(api.ordinaryVocationalQualificationStatus(below).pending, true);
  assert.equal(api.ordinaryVocationalQualificationStatus(below).unknown, false);
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
}

for (const [subject, checkpoints] of [
  ["历史类", [[484, 54036], [532, 31312], [600, 5533], [657, 104], [750, 104]]],
  ["物理类", [[456, 217438], [513, 145420], [600, 35398], [689, 110], [750, 110]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact or bucket-exact`);
  }
  const minimum = subject === "历史类" ? 484 : 456;
  assert.equal(api.estimateRankFromScore(profile(subject, minimum - 1)), null);
  assert.equal(api.estimateRankFromScore(profile(subject, 751)), null);
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Jiangsu special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Jiangsu special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  rankRowsInventoryAndContinuityChecked: 408,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  pendingVocationalLine: true,
  specialPaths: 26,
  cultureProfessionalRecords: 20,
  professionalQualificationRecords: 4,
  pendingLineSafety: { historyBelow: 483, physicsBelow: 455, maxTotal: 55, applicationPlanRows: 0 },
  rankCoverage: { history: "484-750", physics: "456-750", belowTableReturnsNull: true },
}, null, 2));
