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
const sourceId = "official-guangxi-control-lines-2026";
const rankSourceId = "official-guangxi-rank-2026";
const historyRankUrl = "https://www.gxeea.cn/2026yfyd/yifenyidang/2026_yifenyidang_lishi_qg.html";
const physicsRankUrl = "https://www.gxeea.cn/2026yfyd/yifenyidang/2026_yifenyidang_wuli_qg.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const guangxi = readGzipJson(path.join(releaseDir, "guangxi.json.gz"));
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guangxi-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guangxi-control-lines-2026-v3295-runtime-manifest.json"), "utf8"));
const records = guangxi.records.filter((record) => record.sourceId === sourceId);
const rankRows = guangxi.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.records.length, 50);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 46);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 44);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 4, art: 40 });
assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 117615);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5118);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["广西"].records, 20452);
assert.equal(manifest.shards["广西"].rankConversions, 1012);
assert.equal(runtimeManifest.after.sourceRecords, 50);
assert.equal(runtimeManifest.after.rankRowsLinked, 1012);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.cultureProfessionalRecords, 44);

assert.equal(rankRows.length, 1012);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 492, "物理类": 520 });
assert.ok(rankRows.every((record) => record.sourceUrl === (record.subjectType === "历史类" ? historyRankUrl : physicsRankUrl)));
assert.ok(rankRows.every((record) => String(record.sourceQuality).startsWith("official-guangxi-rank-conversion-html-national-bonus")));
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score ?? JSON.stringify(record.scoreRange)}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}

assert.equal(sourceNote.province, "广西");
assert.equal(sourceNote.url, "https://www.gxeea.cn/view/content_619_32889.htm");
assert.equal(sourceNote.quality, "official-content-mirror-guangxi-control-line-image-and-chinanews-text-verified");
assert.equal(sourceNote.directPageRedownloadStatus, "blocked-current-session-tls");
assert.equal(sourceNote.evidence.universityOfficialImage.sha256, "51404304947a3671f30e18256fd692f1984f4f6270b8d6f0e89489f45563724c");
assert.equal(sourceNote.evidence.universityOfficialImage.width, 1132);
assert.equal(sourceNote.evidence.universityOfficialImage.height, 3264);
assert.equal(sourceNote.evidence.chinaNewsTextMirror.sha256, "507f2e5f7b69521c549ffed0176f91c14d4b297581cdc3b1752e86e51ff14ac7");
assert.match(sourceNote.manualVisualVerification.finding, /广西壮族自治区招生考试院/);
assert.equal(rankSourceNote.quality, "official-guangxi-rank-conversion-html-national-bonus");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 1012);
assert.equal(rankSourceNote.provenanceRevision.checkpointCount, 6);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.match(rankSourceNote.provenanceRevision.directPageRedownloadStatus, /blocked-current-session-tls/);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 49420);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 179539);

function findLine(subjectType, routeKind, category, section) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category)
    && (!section || record.controlLineSection === section));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 398);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 180);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 368);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 180);
assert.equal(findLine("历史类", "special")?.minScore, 520);
assert.equal(findLine("物理类", "special")?.minScore, 510);
assert.equal(findLine("历史类", "sports", "体育类", "本科")?.professionalMinScore, 83);
assert.equal(findLine("物理类", "sports", "体育类", "高职高专")?.professionalMinScore, 60);
assert.equal(findLine("历史类", "art", "书法类", "本科")?.minScore, 299);
assert.equal(findLine("历史类", "art", "书法类", "本科")?.professionalMinScore, 225);
assert.equal(findLine("物理类", "art", "书法类", "高职高专")?.minScore, 126);
assert.equal(findLine("物理类", "art", "书法类", "高职高专")?.professionalMinScore, 210);
assert.equal(findLine("物理类", "art", "戏曲类", "本科")?.professionalMinScore, 180);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreDimension === "culture-and-professional" && record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__guangxiControlTest = {
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
const api = context.__guangxiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = guangxi.records;
api.state.data.admissionScoreLayer.rankConversions = guangxi.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "广西",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "南宁 桂林 广州 深圳",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 398, 180], ["物理类", 368, 180]]) {
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
  assert.ok(belowResult.warnings.some((warning) => warning.includes(`180分`)));
}

for (const [subject, checkpoints] of [
  ["历史类", [[180, 109518], [398, 49420], [520, 11410], [600, 1455], [673, 12], [700, 12], [750, 12]]],
  ["物理类", [[180, 255675], [368, 179539], [510, 60703], [600, 10818], [699, 11], [700, 11], [750, 11]]],
]) {
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
  rankRowsLinked: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 46,
  cultureProfessionalRecords: 44,
  evidenceBoundary: sourceNote.evidenceBoundary,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [179, 180, 367, 368, 397, 398, 510, 520, 600, 673, 699, 700, 750, 751] },
}, null, 2));
