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
const sourceId = "official-neimenggu-control-lines-2026";
const rankSourceId = "official-neimenggu-rank-2026";
const rankUrls = {
  "历史类": "https://www.nm.zsks.cn/fzlm/26gktj/202606/t20260624_46464.html",
  "物理类": "https://www.nm.zsks.cn/fzlm/26gktj/202606/t20260624_46462.html",
};

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-neimenggu-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-neimenggu-control-lines-2026-v3288-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const neimenggu = readGzipJson(path.join(releaseDir, "inner-mongolia.json.gz"));
const records = neimenggu.records.filter((record) => record.sourceId === sourceId);
const rankRows = neimenggu.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 74);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.specialPathRecords, 70);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 36);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  special: 2,
  art: 20,
  sports: 2,
  "special-category": 16,
  counterpart: 30,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  "物理类": { bachelor: 363, vocational: 160 },
  "历史类": { bachelor: 403, vocational: 160 },
});
assert.deepEqual(imported.diagnostics.scoreBasisCounts, {
  "gaokao-total": 44,
  "counterpart-total": 30,
});
assert.equal(records.length, 74);
assert.equal(new Set(records.map((record) => record.id)).size, 74);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 70);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 36);
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
assert.equal(manifest.shards["内蒙古"].records, 15765);
assert.equal(manifest.shards["内蒙古"].rankConversions, 974);
assert.equal(runtimeManifest.after.sourceRecords, 74);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 974);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(rankRows.length, 974);
assert.deepEqual(Object.fromEntries(Object.entries(rankUrls).map(([subject, url]) => [subject,
  rankRows.filter((record) => record.subjectType === subject && record.sourceUrl === url).length,
])), { "历史类": 471, "物理类": 503 });

assert.equal(sourceNote.quality, "official-neimenggu-control-line-html-verified");
assert.equal(sourceNote.controlPageBytes, 31525);
assert.equal(sourceNote.controlPageSha256, "46a797ff4eb016f8db7cadc7410491a12934c1fd04a35b244577157210eec8c8");
assert.equal(sourceNote.rankIndexSha256, "b2b9a34d2556d1f89fb2160bcc05818b540c034cc0ae5fea2bffe1ce614c27c2");
assert.equal(sourceNote.rankHistorySha256, "9479d472ed9c58b94a1071b8f0174c0c56612f2e4b369185dc996c2f2b820ac1");
assert.equal(sourceNote.rankPhysicsSha256, "fe27c70886ba49833956c58c23a1f9c4003ad3d7fd3baeac2d761244781e1954");
assert.equal(rankSourceNote.indexHtmlBytes, 18163);
assert.equal(rankSourceNote.indexHtmlSha256, sourceNote.rankIndexSha256);
assert.deepEqual(rankSourceNote.pageEvidence.map(({ subjectType, records: count }) => [subjectType, count]), [["历史类", 471], ["物理类", 503]]);
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 974);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

function findLine(subjectType, routeKind) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineRouteKind === routeKind);
}

assert.equal(findLine("物理类", "ordinary-bachelor")?.minScore, 363);
assert.equal(findLine("物理类", "ordinary-vocational")?.minScore, 160);
assert.equal(findLine("历史类", "ordinary-bachelor")?.minScore, 403);
assert.equal(findLine("历史类", "ordinary-vocational")?.minScore, 160);
assert.equal(findLine("物理类", "special")?.minScore, 488);
assert.equal(findLine("历史类", "special")?.minScore, 512);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__neimengguControlTest = {
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
const api = context.__neimengguControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = neimenggu.records;
api.state.data.admissionScoreLayer.rankConversions = neimenggu.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "内蒙古",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "呼和浩特 北京 天津",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const physics159 = profile("物理类", 159);
const physics160 = profile("物理类", 160);
const physics362 = profile("物理类", 362);
const physics363 = profile("物理类", 363);
const history159 = profile("历史类", 159);
const history160 = profile("历史类", 160);
const history402 = profile("历史类", 402);
const history403 = profile("历史类", 403);

assert.equal(api.ordinaryBachelorControlLine(physics363)?.score, 363);
assert.equal(api.ordinaryBachelorControlLine(history403)?.score, 403);
assert.equal(api.ordinaryVocationalControlLine(physics160)?.score, 160);
assert.equal(api.ordinaryVocationalControlLine(history160)?.score, 160);
assert.equal(api.isVocationalProfile(physics362), true);
assert.equal(api.isVocationalProfile(physics363), false);
assert.equal(api.isVocationalProfile(history402), true);
assert.equal(api.isVocationalProfile(history403), false);
assert.ok(api.candidatePoolsForProfile(physics362).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(physics363).every((candidate) => candidate.id !== "vocational-dual"));

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const belowPhysics = api.scoreCandidate(vocationalCandidate, physics159, api.classifyProfileBand(physics159));
const atPhysics = api.scoreCandidate(vocationalCandidate, physics160, api.classifyProfileBand(physics160));
const belowHistory = api.scoreCandidate(vocationalCandidate, history159, api.classifyProfileBand(history159));
const atHistory = api.scoreCandidate(vocationalCandidate, history160, api.classifyProfileBand(history160));
for (const result of [belowPhysics, belowHistory]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.equal(api.buildApplicationPlan([result]).length, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("不据此用历史院校投档记录")));
  assert.ok(result.warnings.some((warning) => /低于2026年普通类.*160分/.test(warning)));
}
assert.equal(api.isBelowOrdinaryVocationalLine(physics159), true);
assert.equal(api.isBelowOrdinaryVocationalLine(physics160), false);
assert.equal(api.isBelowOrdinaryVocationalLine(history159), true);
assert.equal(api.isBelowOrdinaryVocationalLine(history160), false);
for (const result of [atPhysics, atHistory]) {
  assert.ok(result.warnings.every((warning) => !/低于2026年普通类.*160分/.test(warning)));
}

const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const physicsBachelor = api.scoreCandidate(undergraduateCandidate, physics363, api.classifyProfileBand(physics363));
const historyBachelor = api.scoreCandidate(undergraduateCandidate, history403, api.classifyProfileBand(history403));
assert.ok(physicsBachelor.reasons.some((reason) => /达到2026年内蒙古物理类普通类录取控制分数线363分/.test(reason)));
assert.ok(historyBachelor.reasons.some((reason) => /达到2026年内蒙古历史类普通类录取控制分数线403分/.test(reason)));
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
  isolatedSpecialPaths: 70,
  cultureProfessionalRecords: 36,
  boundarySafety: { belowVocationalMaxTotal: 42, confidence: "C", testedScores: [159, 160, 362, 363, 402, 403] },
}, null, 2));
