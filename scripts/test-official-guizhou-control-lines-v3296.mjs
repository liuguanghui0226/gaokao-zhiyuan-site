#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.325-hainan-official-rank2025-policy-bonus-inclusive-published-floor-aligned-868426records";
const sourceId = "official-guizhou-control-lines-2026";
const rankSourceId = "official-guizhou-rank-2026";
const historyRankUrl = "https://zsksy.guizhou.gov.cn/zlxz/202606/P020260625601945966806.pdf";
const physicsRankUrl = "https://zsksy.guizhou.gov.cn/zlxz/202606/P020260625601945906859.pdf";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const guizhou = readGzipJson(path.join(releaseDir, "guizhou.json.gz"));
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guizhou-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guizhou-control-lines-2026-v3296-runtime-manifest.json"), "utf8"));
const records = guizhou.records.filter((record) => record.sourceId === sourceId);
const rankRows = guizhou.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.records.length, 29);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 25);
assert.equal(imported.diagnostics.artSportsCultureRecords, 22);
assert.equal(imported.diagnostics.professionalNumericRecords, 0);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, art: 18, sports: 4, "minority-language-oral": 1 });
assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128591);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5129);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["贵州"].records, 57720);
assert.equal(manifest.shards["贵州"].rankConversions, 3636);
assert.equal(runtimeManifest.after.sourceRecords, 29);
assert.equal(runtimeManifest.after.rankRowsLinked, 1201);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.artSportsCultureRecords, 22);

assert.equal(rankRows.length, 1201);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 561, "物理类": 640 });
assert.ok(rankRows.every((record) => record.sourceUrl === (record.subjectType === "历史类" ? historyRankUrl : physicsRankUrl)));
assert.ok(rankRows.every((record) => record.sourceQuality === "official-guizhou-rank-conversion-pdf-text-validated"));
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score ?? JSON.stringify(record.scoreRange)}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}

assert.equal(sourceNote.province, "贵州");
assert.equal(sourceNote.url, "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847640.html");
assert.equal(sourceNote.originalOfficialUrl, "https://mp.weixin.qq.com/s/nKVg7jaelGMXD2NrAKEDAQ");
assert.equal(sourceNote.quality, "official-content-mirror-guizhou-chsi-government-image-and-chinanews-verified");
assert.equal(sourceNote.originalWechatRetrievalStatus, "blocked-by-environment-verification");
assert.equal(sourceNote.officialRankSiteRedownloadStatus, "blocked-current-session-tls");
assert.equal(sourceNote.evidence.chsiControlPage.sha256, "f120e3eb02405ef70242b8936438bd8e8a24a2607ea26c4674aedfb675e7d4c6");
assert.equal(sourceNote.evidence.tongrenGovernmentImage.sha256, "803941857c6ba11d75791d157f1710d2b7d5855791ed188b86b79970dfad339f");
assert.equal(sourceNote.evidence.tongrenGovernmentImage.width, 550);
assert.equal(sourceNote.evidence.tongrenGovernmentImage.height, 2305);
assert.equal(sourceNote.evidence.rankHistoryIdenticalMirror.sha256, "0b8cf4360336c19442eab70355617624ca87d9f4f40a65b99346ff8fb798d183");
assert.equal(sourceNote.evidence.rankPhysicsIdenticalMirror.sha256, "361ae84119880307acff21018f96cd06d1c530859bf4ad6fee41f1e07099f9c4");
assert.match(sourceNote.manualVisualVerification.finding, /铜仁政府转载原图/);
assert.equal(rankSourceNote.quality, "official-guizhou-rank-conversion-pdf-text-validated");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 1201);
assert.equal(rankSourceNote.provenanceRevision.checkpointCount, 6);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.match(rankSourceNote.provenanceRevision.directPageRedownloadStatus, /identical-mirror-hash-verified/);
assert.equal(rankSourceNote.provenanceRevision.identicalMirrorHashes.history, sourceNote.evidence.rankHistoryIdenticalMirror.sha256);
assert.equal(rankSourceNote.provenanceRevision.identicalMirrorHashes.physics, sourceNote.evidence.rankPhysicsIdenticalMirror.sha256);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 37867);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 158893);

function findLine(subjectType, routeKind, category, section) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category)
    && (!section || record.controlLineSection === section));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 439);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 200);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 393);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 200);
assert.equal(findLine("历史类", "special")?.minScore, 503);
assert.equal(findLine("物理类", "special")?.minScore, 494);
assert.equal(findLine("历史类", "sports", "体育类", "本科")?.minScore, 351);
assert.equal(findLine("物理类", "sports", "体育类", "高职（专科）")?.minScore, 180);
assert.equal(findLine("历史类", "art", "书法类", "本科")?.minScore, 351);
assert.equal(findLine("物理类", "art", "书法类", "本科")?.minScore, 314);
assert.equal(findLine("物理类", "art", "艺术类", "高职（专科）")?.minScore, 180);
const oral = findLine("民汉双语", "minority-language-oral", "民汉双语专业", "口语测试");
assert.equal(oral?.minScore, 97.7);
assert.equal(oral?.scoreBasis, "minority-language-oral-test");
assert.equal(oral?.scoreMaximum, 100);
assert.ok(records.every((record) => !Number.isFinite(record.professionalMinScore)));
assert.equal(records.filter((record) => record.professionalQualification).length, 22);
assert.ok(records.filter((record) => record.professionalQualification)
  .every((record) => record.scoreDimension === "culture-and-qualification" && record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__guizhouControlTest = {
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
const api = context.__guizhouControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = guizhou.records;
api.state.data.admissionScoreLayer.rankConversions = guizhou.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "贵州",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "贵阳 遵义 成都 重庆",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 439, 200], ["物理类", 393, 200]]) {
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
  assert.ok(belowResult.warnings.some((warning) => warning.includes(`200分`)));
}

for (const [subject, checkpoints] of [
  ["历史类", [[200, 83144], [439, 37867], [503, 15657], [600, 1571], [662, 31]]],
  ["物理类", [[200, 212055], [393, 158893], [494, 66184], [600, 11440], [691, 53]]],
]) {
  for (const [score, rank] of checkpoints) {
    const estimate = api.estimateRankFromScore(profile(subject, score));
    assert.equal(estimate?.rank, rank, `${subject}/${score} rank drifted`);
    assert.equal(estimate?.exact, true, `${subject}/${score} should be exact`);
  }
}
assert.equal(api.estimateRankFromScore(profile("历史类", 663)), null, "History score above published table must stay unavailable");
assert.equal(api.estimateRankFromScore(profile("物理类", 692)), null, "Physics score above published table must stay unavailable");
assert.equal(api.estimateRankFromScore(profile("历史类", 751)), null);
assert.equal(api.estimateRankFromScore(profile("物理类", 751)), null);

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankRowsLinked: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 25,
  artSportsCultureRecords: 22,
  professionalNumericRecords: 0,
  evidenceBoundary: sourceNote.evidenceBoundary,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [199, 200, 392, 393, 438, 439, 494, 503, 600, 662, 663, 691, 692, 751] },
}, null, 2));
