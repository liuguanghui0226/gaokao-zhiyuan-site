#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.308-national-school-official-wtu2021-2025-native-rank-857225records";
const sourceId = "official-gansu-control-lines-2026";
const rankSourceId = "gk100-gansu-rank-2026";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-gansu-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-gansu-control-lines-2026-v3294-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const gansu = readGzipJson(path.join(releaseDir, "gansu.json.gz"));
const records = gansu.records.filter((record) => record.sourceId === sourceId);
const rankRows = gansu.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 53);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 49);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 28);
assert.equal(imported.diagnostics.qualificationRecords, 3);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  art: 22,
  sports: 6,
  "art-school-exam": 2,
  "opera-interprovincial": 1,
  "secondary-vocational": 16,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  historyBachelor: 405,
  historyVocational: 160,
  physicsBachelor: 367,
  physicsVocational: 180,
});

assert.equal(records.length, 53);
assert.equal(new Set(records.map((record) => record.id)).size, 53);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 49);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 28);
assert.equal(records.filter((record) => record.controlLineRouteKind === "secondary-vocational").length, 16);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 857225);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5113);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 857225);
assert.equal(manifest.shards["甘肃"].records, 13643);
assert.equal(manifest.shards["甘肃"].rankConversions, 2679);
assert.equal(runtimeManifest.after.sourceRecords, 53);
assert.equal(runtimeManifest.after.rankRowsCrossChecked, 1343);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.cultureProfessionalRecords, 28);

assert.equal(rankRows.length, 1343);
assert.ok(rankRows.every((record) => String(record.sourceQuality).startsWith("third-party-")));
assert.ok(rankRows.every((record) => !record.sourceUrl), "Gansu rank rows must not be linked to the official control page as if it were a rank table");
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "历史类": 661, "物理类": 682 });
for (const subject of ["历史类", "物理类"]) {
  const rows = rankRows.filter((record) => record.subjectType === subject);
  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    if (record.sameRankScore === 0) {
      assert.equal(record.rankStart, record.rankEnd, `Zero-person rank boundary drifted at ${subject}/${record.score}`);
      if (index) assert.equal(rows[index - 1].rankEnd, record.rankEnd, `Zero-person cumulative rank drifted at ${subject}/${record.score}`);
    } else {
      assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${subject}/${record.score}`);
      if (index) assert.equal(rows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${subject}/${record.score}`);
    }
  }
}

assert.equal(sourceNote.province, "甘肃");
assert.equal(sourceNote.url, "https://www.ganseea.cn/shouyegonggao/1904.html");
assert.equal(sourceNote.controlPage.sha256, "7307b7d293849ac589fe09aed5b6a5bd5f9cd65a9b5e92455ab312cc136d01ed");
assert.equal(sourceNote.images.length, 4);
assert.deepEqual(sourceNote.images.map((image) => image.sha256), [
  "41e7dedbd2a5ecd9bf2678f38781f9119d1b133b52c1c67c26cee2340546cbec",
  "964136c81ae377d11cf4dd51379d98ceff4ffbb320c1eabdb6c8d7e54642aafc",
  "2064f2f6d09a4b7a5f5a3c2a1efaaab50b98b47521c908c15bf613c708506626",
  "1c6532ba16f77be4063f90f490c2318a3848a0a4706cc3d561d52501f22436c9",
]);
assert.equal(rankSourceNote.quality, "third-party-gk100-gansu-rank-conversion-image-tesseract-grid-validated");
assert.equal(rankSourceNote.provenanceRevision.rankRowsCrossChecked, 1343);
assert.equal(rankSourceNote.provenanceRevision.checkpointCount, 6);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);
assert.equal(rankSourceNote.provenanceRevision.officialRankPageFound, false);
assert.equal(rankSourceNote.officialControlCrossCheck.history.bachelorRankEnd, 25199);
assert.equal(rankSourceNote.officialControlCrossCheck.physics.bachelorRankEnd, 95355);

function findLine(subjectType, routeKind, category) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineRouteKind === routeKind && (!category || record.majorGroup === category));
}

assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 405);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 160);
assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 367);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 180);
assert.equal(findLine("历史类", "special")?.minScore, 508);
assert.equal(findLine("物理类", "special")?.minScore, 477);
assert.equal(findLine("艺术类", "art", "书法类")?.professionalMinScore, 214);
assert.equal(findLine("艺术类", "art", "播音与主持类")?.minScore, 367);
assert.equal(findLine("体育类", "sports", "体育类（田径）")?.professionalMinScore, 248);
assert.equal(findLine("中职升学", "secondary-vocational", "医药卫生类")?.minScore, 594);
assert.ok(records.filter((record) => Number.isFinite(record.professionalMinScore))
  .every((record) => record.scoreDimension === "culture-and-professional" && record.scoreBasis === "culture-score"));
assert.ok(records.filter((record) => record.controlLineRouteKind === "secondary-vocational")
  .every((record) => record.scoreBasis === "secondary-vocational-entrance-exam-total" && record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gansuControlTest = {
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
const api = context.__gansuControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = gansu.records;
api.state.data.admissionScoreLayer.rankConversions = gansu.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "甘肃",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "兰州 西安 成都",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const [subject, bachelor, vocational] of [["历史类", 405, 160], ["物理类", 367, 180]]) {
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
  assert.ok(belowResult.warnings.some((warning) => warning.includes(`低于2026年普通类${subject === "历史类" ? "高职（专科）" : "高职（专科）"}批录取最低控制分数线${vocational}分`)));
}

for (const [subject, checkpoints] of [
  ["历史类", [[160, 48149], [405, 25199], [508, 8306], [600, 1123], [660, 38], [700, 38], [750, 38]]],
  ["物理类", [[180, 118170], [367, 95355], [477, 41347], [600, 5646], [681, 38], [700, 38], [750, 38]]],
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
  rankRowsCrossChecked: rankRows.length,
  rankSourceQuality: rankSourceNote.quality,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 49,
  cultureProfessionalRecords: 28,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [159, 160, 179, 180, 366, 367, 404, 405, 477, 508, 600, 660, 681, 700, 750, 751] },
}, null, 2));
