#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.322-hubei-official-rank2025-full-cohort-aligned-868426records";
const sourceId = "official-beijing-control-lines-2026";
const rankSourceUrl = "https://www.bjeea.cn/html/gkgz/tzgg/2026/0624/88238.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-beijing-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-beijing-control-lines-2026-v3286-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const beijing = readGzipJson(path.join(releaseDir, "beijing.json.gz"));
const records = beijing.records.filter((record) => record.sourceId === sourceId);
const rankRows = beijing.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-beijing-rank-2026");
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-beijing-rank-2026");

assert.equal(imported.diagnostics.recordCount, 9);
assert.equal(imported.diagnostics.ordinaryRecords, 2);
assert.equal(imported.diagnostics.specialPathRecords, 7);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 1,
  special: 1,
  art: 3,
  sports: 1,
  "ordinary-vocational": 1,
  "single-exam": 1,
  "single-exam-art": 1,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { bachelor: 429, vocational: 120 });
assert.deepEqual(imported.diagnostics.scoreBasisCounts, {
  "gaokao-total": 5,
  "chinese-math-foreign-450": 4,
});
assert.equal(records.length, 9);
assert.equal(new Set(records.map((record) => record.id)).size, 9);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 2);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 7);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 126013);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5126);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["北京"].records, 6623);
assert.equal(manifest.shards["北京"].rankConversions, 688);
assert.equal(beijing.rankConversions.length, 688);
assert.equal(runtimeManifest.after.sourceRecords, 9);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 341);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(rankRows.length, 341);
assert.ok(rankRows.every((record) => record.sourceUrl === rankSourceUrl));

assert.equal(sourceNote.quality, "official-beijing-control-line-html-verified");
assert.equal(sourceNote.pageHtmlBytes, 39436);
assert.equal(sourceNote.pageHtmlSha256, "d6770b626bc7399ba50924b56be892867b5576e4ee667f957238e0dbc08fef3c");
assert.equal(sourceNote.rankPageHtmlSha256, "b140391d70126bf52e82b5d1818443edafd144017555293f49be174e9fc2c009");
assert.equal(sourceNote.rankPdfSha256, "39f1e77097c56cbd7e1cd2971793e6231ba2ca9230811ba502a830153c4556a8");
assert.equal(rankSourceNote.pageHtmlBytes, 12943);
assert.equal(rankSourceNote.pageHtmlSha256, "b140391d70126bf52e82b5d1818443edafd144017555293f49be174e9fc2c009");
assert.equal(rankSourceNote.pdfBytes, 134541);
assert.equal(rankSourceNote.pdfSha256, "39f1e77097c56cbd7e1cd2971793e6231ba2ca9230811ba502a830153c4556a8");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 341);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

function findLine(route) {
  return records.find((record) => record.controlLineRouteKind === route);
}

assert.equal(findLine("ordinary-bachelor")?.minScore, 429);
assert.equal(findLine("ordinary-bachelor")?.scoreBasis, "gaokao-total");
assert.equal(findLine("ordinary-vocational")?.minScore, 120);
assert.equal(findLine("ordinary-vocational")?.scoreBasis, "chinese-math-foreign-450");
assert.equal(findLine("sports")?.professionalMinScore, 60);
assert.equal(findLine("sports")?.minScore, 369);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /id="vocationalScoreInput"[^>]+max="450"/);
assert.match(source, /专科资格分数口径待补充/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__beijingControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  controlLineScoreComparison,
  ordinaryVocationalQualificationStatus,
  isBelowOrdinaryVocationalLine,
  isVocationalProfile,
  candidatePoolsForProfile,
  classifyProfileBand,
  scoreCandidate,
  buildApplicationPlan,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__beijingControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = beijing.records;
api.state.data.admissionScoreLayer.rankConversions = beijing.rankConversions;

function profile(score, vocationalScore = "") {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: String(vocationalScore),
    rank: "30000",
    province: "北京",
    subject: "综合",
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: "物理 化学",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "北京 天津",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const total119 = profile(119);
const total200Unknown = profile(200);
const three119 = profile(200, 119);
const three120 = profile(200, 120);
const total428 = profile(428, 120);
const total429 = profile(429);

assert.equal(api.ordinaryBachelorControlLine(total429)?.score, 429);
assert.equal(api.ordinaryVocationalControlLine(three120)?.score, 120);
assert.equal(api.ordinaryVocationalControlLine(three120)?.record.scoreBasis, "chinese-math-foreign-450");
assert.equal(api.isVocationalProfile(total428), true);
assert.equal(api.isVocationalProfile(total429), false);
assert.ok(api.candidatePoolsForProfile(total428).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(total429).every((candidate) => candidate.id !== "vocational-dual"));

const inferred = api.controlLineScoreComparison(api.ordinaryVocationalControlLine(total119), total119);
assert.equal(inferred.status, "comparable");
assert.equal(inferred.below, true);
assert.equal(inferred.inferredUpperBound, true);
assert.equal(inferred.score, 119);
assert.match(inferred.label, /可推定/);

const unknown = api.ordinaryVocationalQualificationStatus(total200Unknown);
assert.equal(unknown.relevant, true);
assert.equal(unknown.unknown, true);
assert.equal(unknown.below, false);
assert.equal(unknown.comparison.status, "missing");
assert.equal(api.isBelowOrdinaryVocationalLine(total200Unknown), false, "Missing three-subject score must not be treated as below or at line");
assert.equal(api.ordinaryVocationalQualificationStatus(three119).below, true);
assert.equal(api.ordinaryVocationalQualificationStatus(three120).below, false);
assert.equal(api.ordinaryVocationalQualificationStatus(three120).unknown, false);

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const result119Inferred = api.scoreCandidate(vocationalCandidate, total119, api.classifyProfileBand(total119));
const resultUnknown = api.scoreCandidate(vocationalCandidate, total200Unknown, api.classifyProfileBand(total200Unknown));
const result119 = api.scoreCandidate(vocationalCandidate, three119, api.classifyProfileBand(three119));
const result120 = api.scoreCandidate(vocationalCandidate, three120, api.classifyProfileBand(three120));
const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const resultBachelor = api.scoreCandidate(undergraduateCandidate, total429, api.classifyProfileBand(total429));

for (const result of [result119Inferred, result119]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.equal(api.buildApplicationPlan([result]).length, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("普通批录取资格尚未达到")));
}
assert.equal(resultUnknown.confidence, "C");
assert.ok(resultUnknown.total <= 55);
assert.ok(resultUnknown.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
assert.equal(api.buildApplicationPlan([resultUnknown]).length, 0);
assert.ok(resultUnknown.reasons.some((reason) => /尚不能判断普通专科批资格/.test(reason)));
assert.ok(resultUnknown.warnings.some((warning) => /请补充该分数/.test(warning)));
assert.ok(result120.warnings.every((warning) => !/尚不能判断|请补充该分数|低于2026年普通专科/.test(warning)));
assert.ok(resultBachelor.reasons.some((reason) => /普通本科录取控制分数线429分/.test(reason)));
assert.ok(resultBachelor.reasons.some((reason) => reason.includes("不等于达到任何具体院校或专业投档线")));

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile(600)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile(600)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 7,
  scoreBasisSafety: {
    inferredTotalBelowLine: 119,
    unknownWithoutThreeSubjectScore: 200,
    explicitThreeSubjectScores: [119, 120],
    bachelorScores: [428, 429],
    belowLineMaxTotal: 42,
    unknownMaxTotal: 55,
  },
}, null, 2));
