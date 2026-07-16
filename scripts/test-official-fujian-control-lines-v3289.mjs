#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.298-heilongjiang-control-lines2026-and-rank-provenance-847051records";
const sourceId = "official-fujian-control-lines-2026";
const rankSourceId = "official-fujian-rank-2026";
const rankUrls = {
  "历史类": "https://www.eeafj.cn/gkptgkgsgg/20260625/14698.html",
  "物理类": "https://www.eeafj.cn/gkptgkgsgg/20260625/14699.html",
};

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-fujian-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-fujian-control-lines-2026-v3289-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const fujian = readGzipJson(path.join(releaseDir, "fujian.json.gz"));
const records = fujian.records.filter((record) => record.sourceId === sourceId);
const rankRows = fujian.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 22);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 18);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 16);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  art: 12,
  sports: 4,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  "物理类": { bachelor: 446, vocational: 235 },
  "历史类": { bachelor: 458, vocational: 235 },
});
assert.deepEqual(imported.diagnostics.professionalMetricCounts, {
  "professional-unified-exam": 12,
  "xiqu-interprovincial-joint-exam": 4,
});
assert.equal(records.length, 22);
assert.equal(new Set(records.map((record) => record.id)).size, 22);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 18);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 16);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 847051);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5104);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1405);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 847051);
assert.equal(manifest.shards["福建"].records, 21516);
assert.equal(manifest.shards["福建"].rankConversions, 927);
assert.equal(runtimeManifest.after.sourceRecords, 22);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 927);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(rankRows.length, 927);
assert.deepEqual(Object.fromEntries(Object.entries(rankUrls).map(([subject, url]) => [subject,
  rankRows.filter((record) => record.subjectType === subject && record.sourceUrl === url).length,
])), { "历史类": 455, "物理类": 472 });

assert.equal(sourceNote.quality, "official-fujian-control-line-image-verified");
assert.equal(sourceNote.controlPageBytes, 16211);
assert.equal(sourceNote.controlPageSha256, "c2acd98f9bd57a7031fb3e28de51849d5f2427b5535108abc418e22c71391a3b");
assert.equal(sourceNote.controlImageBytes, 1297816);
assert.equal(sourceNote.controlImageSha256, "3e02438605e2703d2a86be08eec2fddfa797e2b313c8795a2082e9418245e645");
assert.equal(sourceNote.rankPageEvidence.length, 2);
assert.equal(sourceNote.rankImageEvidence.length, 8);
assert.equal(rankSourceNote.pageEvidence.length, 2);
assert.deepEqual(rankSourceNote.pageEvidence.map(({ subjectType, records: count }) => [subjectType, count]), [["历史类", 455], ["物理类", 472]]);
assert.equal(rankSourceNote.pageEvidence.flatMap((row) => row.images).length, 8);
assert.deepEqual(rankSourceNote.pageEvidence.flatMap((row) => row.images).map((item) => item.sha256), [
  "cd3171a0d1a20d917bd07ec76128f719ab20caccfcaceb604ad3810e8a8681e9",
  "b5d097cf46da309e4e531a136f1f64927e7d7a28b73c59ebe0341f48f9085a89",
  "2b04287960e3a18a8f132a0aa306ab127ce9f6016b4a9304697a4a149464258c",
  "ab7ad78fa4d94fa8843c38b9f0741633c444a8e55a0af985476ca6744c14564e",
  "7d1a23683ef5f3358f0dc56db5ab9259df14652b8513481af9d19b5176cc2e25",
  "b5ad7c44e2c3ea41c5bbd73e0b43e643fbb89f6200a6cfce019fd070974ee632",
  "f3bd3bdd42c2d24cd92b330f32ecbf090826019a7cb8a90271d948b31c17afa0",
  "75e3778bc018329a92f8e34a530bc4d10ec7ce1ae68ec436beef2218cc92594a",
]);
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 927);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

function findLine(subjectType, routeKind) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineRouteKind === routeKind);
}

assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 446);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 235);
assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 458);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 235);
assert.equal(findLine("物理类", "special")?.minScore, 528);
assert.equal(findLine("历史类", "special")?.minScore, 533);

const xiquRows = records.filter((record) => record.professionalScoreMetric === "xiqu-interprovincial-joint-exam");
const unifiedRows = records.filter((record) => record.professionalScoreMetric === "professional-unified-exam");
assert.equal(xiquRows.length, 4);
assert.ok(xiquRows.every((record) => record.professionalMinScore === 180));
assert.equal(unifiedRows.length, 12);
assert.ok(unifiedRows.filter((record) => record.controlLineSection === "本科").every((record) => record.professionalMinScore === 195 || record.professionalMinScore === 60));
assert.ok(unifiedRows.filter((record) => record.controlLineSection === "高职（专科）").every((record) => record.professionalMinScore === 180 || record.professionalMinScore === 60));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__fujianControlTest = {
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
const api = context.__fujianControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = fujian.records;
api.state.data.admissionScoreLayer.rankConversions = fujian.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "福建",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "福州 厦门 泉州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const physics234 = profile("物理类", 234);
const physics235 = profile("物理类", 235);
const physics445 = profile("物理类", 445);
const physics446 = profile("物理类", 446);
const history234 = profile("历史类", 234);
const history235 = profile("历史类", 235);
const history457 = profile("历史类", 457);
const history458 = profile("历史类", 458);

assert.equal(api.ordinaryBachelorControlLine(physics446)?.score, 446);
assert.equal(api.ordinaryBachelorControlLine(history458)?.score, 458);
assert.equal(api.ordinaryVocationalControlLine(physics235)?.score, 235);
assert.equal(api.ordinaryVocationalControlLine(history235)?.score, 235);
assert.equal(api.isVocationalProfile(physics445), true);
assert.equal(api.isVocationalProfile(physics446), false);
assert.equal(api.isVocationalProfile(history457), true);
assert.equal(api.isVocationalProfile(history458), false);
assert.ok(api.candidatePoolsForProfile(physics445).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(physics446).every((candidate) => candidate.id !== "vocational-dual"));

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const belowPhysics = api.scoreCandidate(vocationalCandidate, physics234, api.classifyProfileBand(physics234));
const atPhysics = api.scoreCandidate(vocationalCandidate, physics235, api.classifyProfileBand(physics235));
const belowHistory = api.scoreCandidate(vocationalCandidate, history234, api.classifyProfileBand(history234));
const atHistory = api.scoreCandidate(vocationalCandidate, history235, api.classifyProfileBand(history235));
for (const result of [belowPhysics, belowHistory]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.equal(api.buildApplicationPlan([result]).length, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("不使用历史院校投档命中")));
  assert.ok(result.warnings.some((warning) => /低于2026年普通类.*235分/.test(warning)));
}
assert.equal(api.isBelowOrdinaryVocationalLine(physics234), true);
assert.equal(api.isBelowOrdinaryVocationalLine(physics235), false);
assert.equal(api.isBelowOrdinaryVocationalLine(history234), true);
assert.equal(api.isBelowOrdinaryVocationalLine(history235), false);
for (const result of [atPhysics, atHistory]) {
  assert.ok(result.warnings.every((warning) => !/低于2026年普通类.*235分/.test(warning)));
}

const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const physicsBachelor = api.scoreCandidate(undergraduateCandidate, physics446, api.classifyProfileBand(physics446));
const historyBachelor = api.scoreCandidate(undergraduateCandidate, history458, api.classifyProfileBand(history458));
assert.ok(physicsBachelor.reasons.some((reason) => /达到2026年福建物理类普通类录取控制分数线446分/.test(reason)));
assert.ok(historyBachelor.reasons.some((reason) => /达到2026年福建历史类普通类录取控制分数线458分/.test(reason)));
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
  isolatedSpecialPaths: 18,
  cultureProfessionalRecords: 16,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [234, 235, 445, 446, 457, 458] },
}, null, 2));
