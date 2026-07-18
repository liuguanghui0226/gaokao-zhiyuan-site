#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.311-xinjiang-official-2025-undergraduate1-score-only-867350records";
const sourceId = "official-hebei-control-lines-2026";
const rankSourceId = "official-hebei-rank-2026";
const rankUrl = "https://www.hebeea.edu.cn/c/2026-06-24/493215.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hebei-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hebei-control-lines-2026-v3290-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const hebei = readGzipJson(path.join(releaseDir, "hebei.json.gz"));
const records = hebei.records.filter((record) => record.sourceId === sourceId);
const rankRows = hebei.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 54);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 50);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 28);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  art: 24,
  sports: 4,
  counterpart: 20,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  "历史类": { bachelor: 485, vocational: 200 },
  "物理类": { bachelor: 443, vocational: 200 },
});
assert.deepEqual(imported.diagnostics.professionalMetricCounts, {
  "professional-unified-exam": 22,
  "xiqu-interprovincial-joint-exam": 2,
  "sports-professional-test": 4,
});
assert.equal(records.length, 54);
assert.equal(new Set(records.map((record) => record.id)).size, 54);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 50);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 28);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 867350);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5116);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 867350);
assert.equal(manifest.shards["河北"].records, 69443);
assert.equal(manifest.shards["河北"].rankConversions, 1094);
assert.equal(runtimeManifest.after.sourceRecords, 54);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 1094);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(rankRows.length, 1094);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject && record.sourceUrl === rankUrl).length,
])), { "历史类": 532, "物理类": 562 });

assert.equal(sourceNote.quality, "official-hebei-control-line-image-verified");
assert.equal(sourceNote.controlPageBytes, 21530);
assert.equal(sourceNote.controlPageSha256, "89137895e8126fa5d8845f7b11a9aa8e3e477e501b61eb107e16b1732fdf4591");
assert.equal(sourceNote.controlImageBytes, 497717);
assert.equal(sourceNote.controlImageSha256, "cd4adbc26dc402f2db0f24724e7e03da2dd436302e0886e68a22ec3872a5eb42");
assert.equal(sourceNote.rankEvidence.records, 1094);
assert.equal(sourceNote.nonNumericPolicies.length, 3);
assert.equal(rankSourceNote.pageEvidence.sha256, "67045aa3c9dcb2a6e7917c39b502ab267def279bc1296f06567871e6aed95bbe");
assert.equal(rankSourceNote.pageEvidence.pdfSha256, "fcd70c8356b95dc787b92c1c1f7c97183fc5a1532dadf492714e3d5edae7cf16");
assert.deepEqual(rankSourceNote.pageEvidence.subjectRecords, { "历史类": 532, "物理类": 562 });
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 1094);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

function findLine(subjectType, routeKind) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineRouteKind === routeKind);
}

assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 443);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 200);
assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 485);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 200);
assert.equal(findLine("物理类", "special")?.minScore, 510);
assert.equal(findLine("历史类", "special")?.minScore, 512);

const xiquRows = records.filter((record) => record.professionalScoreMetric === "xiqu-interprovincial-joint-exam");
const unifiedRows = records.filter((record) => record.professionalScoreMetric === "professional-unified-exam");
assert.equal(xiquRows.length, 2);
assert.ok(xiquRows.every((record) => record.professionalMinScore === 180));
assert.equal(unifiedRows.length, 22);
assert.equal(records.filter((record) => record.professionalScoreMetric === "sports-professional-test").length, 4);
assert.equal(records.filter((record) => record.controlLineRouteKind === "counterpart").length, 20);
assert.ok(records.filter((record) => record.controlLineRouteKind === "counterpart").every((record) => record.scoreBasis === "counterpart-exam-total" && record.formalScoreScope === "special-path-only"));
assert.equal(records.find((record) => record.majorGroup === "美术与设计类" && record.controlLineSection === "艺术本科")?.professionalMinScore, 180);
assert.equal(records.find((record) => record.majorGroup === "美术与设计类" && record.controlLineSection === "艺术本科")?.minScore, 302);
assert.equal(records.find((record) => record.majorGroup === "对口计算机类" && record.controlLineSection === "对口本科")?.minScore, 504);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__hebeiControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  isBelowOrdinaryVocationalLine,
  isVocationalProfile,
  candidatePoolsForProfile,
  classifyProfileBand,
  scoreCandidate,
  buildApplicationPlan,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__hebeiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = hebei.records;
api.state.data.admissionScoreLayer.rankConversions = hebei.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "河北",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "石家庄 保定 秦皇岛",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const physics199 = profile("物理类", 199);
const physics200 = profile("物理类", 200);
const physics442 = profile("物理类", 442);
const physics443 = profile("物理类", 443);
const history199 = profile("历史类", 199);
const history200 = profile("历史类", 200);
const history484 = profile("历史类", 484);
const history485 = profile("历史类", 485);

assert.equal(api.ordinaryBachelorControlLine(physics443)?.score, 443);
assert.equal(api.ordinaryBachelorControlLine(history485)?.score, 485);
assert.equal(api.ordinaryVocationalControlLine(physics200)?.score, 200);
assert.equal(api.ordinaryVocationalControlLine(history200)?.score, 200);
assert.equal(api.isVocationalProfile(physics442), true);
assert.equal(api.isVocationalProfile(physics443), false);
assert.equal(api.isVocationalProfile(history484), true);
assert.equal(api.isVocationalProfile(history485), false);
assert.ok(api.candidatePoolsForProfile(physics442).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(physics443).every((candidate) => candidate.id !== "vocational-dual"));

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const belowPhysics = api.scoreCandidate(vocationalCandidate, physics199, api.classifyProfileBand(physics199));
const atPhysics = api.scoreCandidate(vocationalCandidate, physics200, api.classifyProfileBand(physics200));
const belowHistory = api.scoreCandidate(vocationalCandidate, history199, api.classifyProfileBand(history199));
const atHistory = api.scoreCandidate(vocationalCandidate, history200, api.classifyProfileBand(history200));
for (const result of [belowPhysics, belowHistory]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.equal(api.buildApplicationPlan([result]).length, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("不使用历史院校投档命中")));
  assert.ok(result.warnings.some((warning) => /低于2026年普通类.*200分/.test(warning)));
}
assert.equal(api.isBelowOrdinaryVocationalLine(physics199), true);
assert.equal(api.isBelowOrdinaryVocationalLine(physics200), false);
assert.equal(api.isBelowOrdinaryVocationalLine(history199), true);
assert.equal(api.isBelowOrdinaryVocationalLine(history200), false);
for (const result of [atPhysics, atHistory]) {
  assert.ok(result.warnings.every((warning) => !/低于2026年普通类.*200分/.test(warning)));
}

const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const physicsBachelor = api.scoreCandidate(undergraduateCandidate, physics443, api.classifyProfileBand(physics443));
const historyBachelor = api.scoreCandidate(undergraduateCandidate, history485, api.classifyProfileBand(history485));
assert.ok(physicsBachelor.reasons.some((reason) => /达到2026年河北物理类普通类录取控制分数线443分/.test(reason)));
assert.ok(historyBachelor.reasons.some((reason) => /达到2026年河北历史类普通类录取控制分数线485分/.test(reason)));
assert.ok([physicsBachelor, historyBachelor].every((result) => result.reasons.some((reason) => reason.includes("不等于达到任何具体院校或专业投档线"))));

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile("物理类", 700)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("历史类", 700)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 50,
  cultureProfessionalRecords: 28,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [199, 200, 442, 443, 484, 485] },
}, null, 2));
