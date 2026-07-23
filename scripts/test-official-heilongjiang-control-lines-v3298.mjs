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
const sourceId = "official-heilongjiang-control-lines-2026";
const rankSourceId = "official-heilongjiang-rank-2026";
const historyRankUrl = "https://jyt.hlj.gov.cn/jyt/c110476/202606/31952462/files/1.%E9%BB%91%E9%BE%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E5%8E%86%E5%8F%B2%E7%B1%BB%E6%96%87%E5%8C%96%E8%AF%BE%E4%B8%80%E5%88%86%E6%AE%B5%E7%BB%9F%E8%AE%A1%E8%A1%A8.xls";
const physicsRankUrl = "https://jyt.hlj.gov.cn/jyt/c110476/202606/31952462/files/2.%E9%BB%91%E9%BE%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E7%89%A9%E7%90%86%E7%B1%BB%E6%96%87%E5%8C%96%E8%AF%BE%E4%B8%80%E5%88%86%E6%AE%B5%E7%BB%9F%E8%AE%A1%E8%A1%A8.xls";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-heilongjiang-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-heilongjiang-control-lines-2026-v3298-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const heilongjiang = readGzipJson(path.join(releaseDir, "heilongjiang.json.gz"));
const records = heilongjiang.records.filter((record) => record.sourceId === sourceId);
const rankRows = heilongjiang.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 18);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 14);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 9);
assert.equal(imported.diagnostics.professionalQualificationRecords, 3);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 4, art: 8 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { historyBachelor: 385, historyVocational: 150, physicsBachelor: 340, physicsVocational: 150 });
assert.equal(imported.diagnostics.rankRowsFullCrossChecked, 1071);
assert.equal(imported.diagnostics.rankValueChanges, 0);
assert.equal(records.length, 18);
assert.equal(new Set(records.map((record) => record.id)).size, 18);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 14);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128591);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5129);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["黑龙江"].records, 15910);
assert.equal(manifest.shards["黑龙江"].rankConversions, 2162);
assert.equal(runtimeManifest.after.sourceRecords, 18);
assert.equal(runtimeManifest.after.rankRowsLinked, 1071);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.rankRowsFullCrossChecked, 1071);

assert.equal(sourceNote.province, "黑龙江");
assert.equal(sourceNote.url, "https://www.hlj.gov.cn/hlj/c108427/202606/c00_31953024.shtml");
assert.equal(sourceNote.quality, "official-heilongjiang-government-control-lines-html");
assert.equal(sourceNote.evidence.controlPage.sha256, "26ff5c8469380e854a5346b4b0ec262823daee4a30051872fa08af376b921159");
assert.equal(sourceNote.evidence.rankHistory.sha256, "e7beb16f3d3a925ad2fbe6fcc83d35bce16a216bda394e22e37052bbb2f00bcd");
assert.equal(sourceNote.evidence.rankPhysics.sha256, "9e70a27172d6c1a4ebe1b57386d14feaa13e71b5bab03c6a798aaadda53007e0");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 1071);
assert.equal(rankSourceNote.provenanceRevision.rowsFullCrossChecked, 1071);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.directOfficialRedownloadStatus, "success");
assert.equal(rankSourceNote.controlBoundaryCrossCheck.history.bachelorRankEnd, 21417);
assert.equal(rankSourceNote.controlBoundaryCrossCheck.physics.bachelorRankEnd, 82444);

assert.equal(rankRows.length, 1071);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 520, "物理类": 551 });
assert.ok(rankRows.every((record) => record.sourceUrl === (record.subjectType === "历史类" ? historyRankUrl : physicsRankUrl)));
assert.ok(rankRows.every((record) => record.sourceQuality === "official-heilongjiang-rank-conversion-xls"));
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
    if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
  }
}
assert.equal(rankRows.some((record) => record.subjectType === "历史类" && record.score === 664), false, "Official zero-person history score 664 must stay omitted");

function findLine(subjectType, routeKind, category, section) {
  return records.find((record) => record.subjectType === subjectType
    && record.controlLineRouteKind === routeKind
    && (!category || record.majorGroup === category)
    && (!section || record.controlLineSection === section));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 385);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 340);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 150);
assert.equal(findLine("历史类", "special")?.minScore, 466);
assert.equal(findLine("物理类", "special")?.minScore, 464);
assert.equal(findLine("历史类", "sports", "体育类", "本科")?.minScore, 269);
assert.equal(findLine("历史类", "sports", "体育类", "本科")?.professionalMinScore, 70);
assert.equal(findLine("物理类", "sports", "体育类", "本科")?.minScore, 238);
assert.equal(findLine("物理类", "sports", "体育类", "高职（专科）")?.professionalMinScore, undefined);
assert.match(findLine("物理类", "sports", "体育类", "高职（专科）")?.professionalQualification, /术科/);
assert.equal(findLine("艺术类", "art", "美术与设计类", "本科")?.minScore, 255);
assert.equal(findLine("艺术类", "art", "美术与设计类", "本科")?.professionalMinScore, 150);
assert.equal(findLine("艺术类", "art", "戏曲类", "本科")?.minScore, 170);
assert.equal(findLine("艺术类", "art", "戏曲类", "本科")?.professionalMinScore, 180);
assert.equal(findLine("艺术类", "art", "艺术类", "高职（专科）")?.minScore, 150);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 9);
assert.equal(records.filter((record) => record.professionalQualification).length, 3);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreDimension === "culture-and-professional" && record.scoreBasis === "culture-score" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__heilongjiangControlTest = {
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
const api = context.__heilongjiangControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = heilongjiang.records;
api.state.data.admissionScoreLayer.rankConversions = heilongjiang.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "黑龙江",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "哈尔滨 长春 大连 沈阳",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 385, 150], ["物理类", 340, 150]]) {
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
  ["历史类", [[150, 44608], [385, 21417], [466, 10509], [600, 857], [670, 15], [750, 15]]],
  ["物理类", [[150, 109811], [340, 82444], [464, 40652], [600, 6580], [700, 17], [750, 17]]],
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
assert.equal(api.ordinaryBachelorControlLine(profile("历史类", 700)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("物理类", 700)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankRowsLinked: rankRows.length,
  rankRowsFullCrossChecked: rankSourceNote.provenanceRevision.rowsFullCrossChecked,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 14,
  cultureProfessionalRecords: 9,
  nonnumericProfessionalQualifications: 3,
  officialZeroPersonScoreGap: { subjectType: "历史类", score: 664, inventedRuntimeRow: false },
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [149, 150, 339, 340, 384, 385, 464, 466, 600, 670, 700, 750, 751] },
}, null, 2));
