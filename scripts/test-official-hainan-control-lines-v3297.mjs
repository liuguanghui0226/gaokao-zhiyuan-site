#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.326-xinjiang-rank2025-score-basis-conflict-blocked-868426records";
const sourceId = "official-hainan-control-lines-2026";
const rankSourceId = "official-hainan-rank-2026";
const rankSourceUrl = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/P020260625627884748040.pdf";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hainan-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hainan-control-lines-2026-v3297-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const hainan = readGzipJson(path.join(releaseDir, "hainan.json.gz"));
const records = hainan.records.filter((record) => record.sourceId === sourceId);
const rankRows = hainan.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 14);
assert.equal(imported.diagnostics.ordinaryRecords, 1);
assert.equal(imported.diagnostics.specialPathRecords, 13);
assert.equal(imported.diagnostics.artRecords, 10);
assert.equal(imported.diagnostics.artProfessionalQualificationRecords, 10);
assert.equal(imported.diagnostics.sportsRecords, 1);
assert.equal(imported.diagnostics.professionalNumericRecords, 1);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 1, "national-special": 1, special: 1, sports: 1, art: 10 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { comprehensiveBachelor: 479, comprehensiveVocational: null });
assert.equal(imported.diagnostics.ordinaryVocationalStatus, "pending-official-release");
assert.equal(imported.diagnostics.rankRowsFullCrossChecked, 547);
assert.equal(imported.diagnostics.scoreMaximum, 900);
assert.equal(records.length, 14);
assert.equal(new Set(records.map((record) => record.id)).size, 14);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 1);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 13);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128591);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5130);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["海南"].records, 11076);
assert.equal(manifest.shards["海南"].rankConversions, 1102);
assert.equal(runtimeManifest.after.sourceRecords, 14);
assert.equal(runtimeManifest.after.rankRowsLinked, 547);
assert.equal(runtimeManifest.after.rankRowsFullCrossChecked, 547);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.ordinaryVocationalStatus, "pending-official-release");

assert.equal(rankRows.length, 547);
assert.ok(rankRows.every((record) => record.sourceUrl === rankSourceUrl));
assert.equal(rankRows[0].score, 800);
assert.deepEqual(rankRows[0].scoreRange, { min: 800, max: 900 });
assert.equal(rankRows[0].rankStart, 1);
assert.equal(rankRows[0].rankEnd, 111);
assert.equal(rankRows.at(-1).score, 254);
assert.equal(rankRows.at(-1).rankEnd, 70398);
for (let index = 0; index < rankRows.length; index += 1) {
  const record = rankRows[index];
  assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${record.score}`);
  if (index) assert.equal(rankRows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${record.score}`);
}

assert.equal(sourceNote.province, "海南");
assert.equal(sourceNote.originalOfficialUrl, "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/t20260625_4099246.html");
assert.equal(sourceNote.quality, "official-content-mirror-hainan-chsi-official-image-and-hainan-daily-text-verified");
assert.equal(sourceNote.directOfficialRetrievalStatus, "blocked-current-session-tls");
assert.equal(sourceNote.ordinaryVocationalStatus, "pending-official-release");
assert.match(sourceNote.ordinaryVocationalReason, /专科批次实行先报志愿再划线/);
assert.equal(sourceNote.scoreMaximum, 900);
assert.equal(sourceNote.evidence.chsiControlImage.sha256, "55be6fdf1034569e3961b5d7ec1573ae5b7a79a96280825977ad2be6c20db5eb");
assert.equal(sourceNote.evidence.chsiControlImage.width, 706);
assert.equal(sourceNote.evidence.chsiControlImage.height, 790);
assert.equal(sourceNote.evidence.chsiRankOrdinaryPdf.sha256, "9ee71c71ebd8c6a1641b2465fd5eff21707a9fd42306d04b219ea2aa8bca062c");
assert.equal(sourceNote.evidence.chsiRankOrdinaryPdf.pages, 20);
assert.equal(sourceNote.rankEvidence.fullRowCrossCheck.rowsCompared, 547);
assert.equal(sourceNote.rankEvidence.fullRowCrossCheck.valueDifferences, 0);
assert.match(sourceNote.manualVisualVerification.finding, /普通本科479/);
assert.equal(rankSourceNote.quality, "official-hainan-rank-conversion-pdf");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 547);
assert.equal(rankSourceNote.provenanceRevision.rowsFullCrossChecked, 547);
assert.equal(rankSourceNote.provenanceRevision.checkpointCount, 6);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.match(rankSourceNote.provenanceRevision.directPageRedownloadStatus, /chsi-mirror-full-row-verified/);
assert.equal(rankSourceNote.provenanceRevision.chsiMirrorPdf.sha256, sourceNote.evidence.chsiRankOrdinaryPdf.sha256);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.ordinaryBachelor.rankEnd, 45098);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.specialType.rankEnd, 19715);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.topBucket.rankEnd, 111);

const ordinary = records.find((record) => record.controlLineRouteKind === "ordinary-bachelor");
assert.equal(ordinary?.minScore, 479);
assert.equal(ordinary?.scoreBasis, "gaokao-total");
assert.equal(ordinary?.scoreMaximum, 900);
assert.equal(records.find((record) => record.controlLineRouteKind === "national-special")?.minScore, 479);
assert.equal(records.find((record) => record.controlLineRouteKind === "special")?.minScore, 568);
const sports = records.find((record) => record.controlLineRouteKind === "sports");
assert.equal(sports?.minScore, 421);
assert.equal(sports?.professionalMinScore, 75);
assert.equal(sports?.professionalScoreMaximum, 100);
assert.equal(sports?.scoreDimension, "culture-and-professional");
const artRecords = records.filter((record) => record.controlLineRouteKind === "art");
assert.equal(artRecords.length, 10);
assert.deepEqual(artRecords.map((record) => record.minScore).sort((a, b) => a - b), [383, 383, 383, 383, 383, 383, 407, 407, 407, 407]);
assert.ok(artRecords.every((record) => record.professionalQualification && !Number.isFinite(record.professionalMinScore)));
assert.ok(records.every((record) => record.scoreMaximum === 900));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /2026年普通专科控制线待发布/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__hainanControlTest = {
  state,
  CANDIDATE_POOLS,
  scoreScaleForProvince,
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
const api = context.__hainanControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = hainan.records;
api.state.data.admissionScoreLayer.rankConversions = hainan.rankConversions;

function profile(score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "海南",
    subject: "综合",
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: "物理 化学",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "海口 三亚 广州 深圳",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

assert.equal(api.scoreScaleForProvince("海南"), 900);
const below = profile(478);
const atLine = profile(479);
assert.equal(api.ordinaryBachelorControlLine(atLine)?.score, 479);
assert.equal(api.ordinaryVocationalControlLine(below), null);
assert.equal(api.isVocationalProfile(below), true);
assert.equal(api.isVocationalProfile(atLine), false);
assert.equal(api.pendingOrdinaryVocationalControlSource(below)?.id, sourceId);
assert.equal(api.pendingOrdinaryVocationalControlSource(atLine), null);
assert.equal(api.ordinaryVocationalQualificationStatus(below).pending, true);
assert.equal(api.ordinaryVocationalQualificationStatus(below).unknown, false);
assert.deepEqual([...api.candidatePoolsForProfile(below).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
assert.ok(api.candidatePoolsForProfile(atLine).every((candidate) => candidate.id !== "vocational-dual"));

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const pendingResult = api.scoreCandidate(vocationalCandidate, below, api.classifyProfileBand(below));
assert.equal(pendingResult.confidence, "C");
assert.ok(pendingResult.total <= 55);
assert.ok(pendingResult.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
assert.ok(pendingResult.schoolOptions.every((option) => !/大学|学院/.test(option.name)));
assert.equal(api.buildApplicationPlan([pendingResult]).length, 0);
assert.ok(pendingResult.reasons.some((reason) => /普通高职专科控制线尚待官方发布/.test(reason)));
assert.ok(pendingResult.warnings.some((warning) => /当前结果只作路径调研/.test(warning)));

for (const [score, rank] of [[254, 70398], [383, 64360], [407, 61050], [421, 58664], [478, 45337], [479, 45098], [568, 19715], [600, 12630], [800, 111], [900, 111]]) {
  const estimate = api.estimateRankFromScore(profile(score));
  assert.equal(estimate?.rank, rank, `Hainan rank drifted at ${score}`);
  assert.equal(estimate?.exact, true, `Hainan score ${score} should be exact or bucket-exact`);
}
assert.equal(api.estimateRankFromScore(profile(253)), null);
assert.equal(api.estimateRankFromScore(profile(901)), null);

const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const undergraduateResult = api.scoreCandidate(undergraduateCandidate, atLine, api.classifyProfileBand(atLine));
assert.ok(undergraduateResult.reasons.some((reason) => /本科.*479分/.test(reason)));
assert.ok(undergraduateResult.reasons.some((reason) => /不等于达到任何具体院校或专业投档线/.test(reason)));

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile(700)), null, "Hainan special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile(700)), null, "Hainan special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  rankRowsFullCrossChecked: sourceNote.rankEvidence.fullRowCrossCheck.rowsCompared,
  ordinaryBoundary: 479,
  pendingVocationalLine: true,
  scoreMaximum: 900,
  specialPaths: { nationalSpecial: 1, specialType: 1, sports: 1, art: 10 },
  pendingLineSafety: { belowScore: 478, atLineScore: 479, maxTotal: 55, applicationPlanRows: 0 },
  rankCoverage: { minScore: 254, topBucket: "800-900", maxRank: 70398 },
}, null, 2));
