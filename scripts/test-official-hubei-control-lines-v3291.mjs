#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.319-jiangsu-jseea-first-stage-rank2025-aligned-868426records";
const sourceId = "official-hubei-control-lines-2026";
const rankSourceId = "official-hubei-rank-2026";
const rankUrl = "https://www.hbea.edu.cn/html/2026-06/15962.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hubei-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hubei-control-lines-2026-v3291-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const hubei = readGzipJson(path.join(releaseDir, "hubei.json.gz"));
const records = hubei.records.filter((record) => record.sourceId === sourceId);
const rankRows = hubei.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 32);
assert.equal(imported.diagnostics.ordinaryRecords, 4);
assert.equal(imported.diagnostics.limitedSchoolRecords, 2);
assert.equal(imported.diagnostics.specialPathRecords, 26);
assert.equal(imported.diagnostics.cultureProfessionalRecords, 23);
assert.deepEqual(imported.diagnostics.routeCounts, {
  "ordinary-bachelor": 2,
  "ordinary-vocational": 2,
  "ordinary-vocational-limited-school": 2,
  special: 2,
  art: 11,
  sports: 2,
  "skill-gaokao": 11,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, {
  "物理类": { bachelor: 435, vocational: 200, limitedSchoolVocational: 150 },
  "历史类": { bachelor: 443, vocational: 200, limitedSchoolVocational: 150 },
});

assert.equal(records.length, 32);
assert.equal(new Set(records.map((record) => record.id)).size, 32);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(records.filter((record) => record.formalScoreScope === "limited-school-control-line-only").length, 2);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 26);
assert.equal(records.filter((record) => Number.isFinite(record.professionalMinScore)).length, 23);
assert.ok(records.filter((record) => !record.controlLineRouteKind.startsWith("ordinary-"))
  .every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 122287);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5123);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["湖北"].records, 16239);
assert.equal(manifest.shards["湖北"].rankConversions, 1079);
assert.equal(runtimeManifest.after.sourceRecords, 32);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 1079);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(rankRows.length, 1079);
assert.ok(rankRows.every((record) => record.sourceUrl === rankUrl));
assert.deepEqual(Object.fromEntries(["物理类", "历史类"].map((subject) => [subject,
  rankRows.filter((record) => record.subjectType === subject).length,
])), { "物理类": 553, "历史类": 526 });

assert.equal(sourceNote.quality, "official-hubei-control-line-image-verified");
assert.equal(sourceNote.controlPageBytes, 11006);
assert.equal(sourceNote.controlPageSha256, "d73d50d6f389f114351ce9a2a5169dfcc06d9069cf3824a3679bb75eae727424");
assert.equal(sourceNote.controlImageBytes, 1200796);
assert.equal(sourceNote.controlImageSha256, "d1fc254b8816fa5b6d1f4c307d489ad042444968698f5be922ee3c95ac80ea44");
assert.equal(sourceNote.rankEvidence.records, 1079);
assert.equal(sourceNote.rankEvidence.imageCount, 10);
assert.equal(sourceNote.rankEvidence.imageBytes, 7030400);
assert.match(sourceNote.limitedSchoolPolicy, /独立学院和民办高校.*武汉市以外/);
assert.equal(rankSourceNote.pageEvidence.sha256, "4726baed16eae15246014bd32c30acdb771ffdac469ef4753a2640c7d44cd70f");
assert.equal(rankSourceNote.pageEvidence.imageBytes, 7030400);
assert.deepEqual(rankSourceNote.pageEvidence.subjectRecords, { "物理类": 553, "历史类": 526 });
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 1079);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

function findLine(subjectType, routeKind) {
  return records.find((record) => record.subjectType === subjectType && record.controlLineRouteKind === routeKind);
}

for (const [subject, bachelor] of [["物理类", 435], ["历史类", 443]]) {
  assert.equal(findLine(subject, "ordinary-bachelor")?.minScore, bachelor);
  assert.equal(findLine(subject, "ordinary-vocational")?.minScore, 200);
  const limitedLine = findLine(subject, "ordinary-vocational-limited-school");
  assert.equal(limitedLine?.minScore, 150);
  assert.equal(limitedLine?.formalScoreScope, "limited-school-control-line-only");
  assert.match(limitedLine?.applicableSchoolScope || "", /独立学院和民办高校.*武汉市以外/);
}
assert.equal(findLine("物理类", "special")?.minScore, 529);
assert.equal(findLine("历史类", "special")?.minScore, 532);
assert.equal(records.filter((record) => record.controlLineRouteKind === "art").length, 11);
assert.equal(records.filter((record) => record.controlLineRouteKind === "sports").length, 2);
assert.equal(records.filter((record) => record.controlLineRouteKind === "skill-gaokao").length, 11);
assert.equal(records.filter((record) => record.professionalScoreMetric === "professional-skills-score").length, 10);
assert.ok(records.filter((record) => record.professionalScoreMetric === "professional-skills-score")
  .every((record) => record.professionalMinScore === 294 && record.scoreBasis === "skill-gaokao-combined-total"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__hubeiControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  limitedOrdinaryVocationalControlLine,
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
const api = context.__hubeiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = hubei.records;
api.state.data.admissionScoreLayer.rankConversions = hubei.rankConversions;

function profile(subject, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "湖北",
    subject,
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: subject.includes("物理") ? "物理 化学" : "历史 政治",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "武汉 荆州 襄阳",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
for (const subject of ["物理类", "历史类"]) {
  const bachelorScore = subject === "物理类" ? 435 : 443;
  const belowAll = profile(subject, 149);
  const atLimited = profile(subject, 150);
  const belowGeneral = profile(subject, 199);
  const atGeneral = profile(subject, 200);
  const belowBachelor = profile(subject, bachelorScore - 1);
  const atBachelor = profile(subject, bachelorScore);

  assert.equal(api.ordinaryBachelorControlLine(atBachelor)?.score, bachelorScore);
  assert.equal(api.ordinaryVocationalControlLine(atGeneral)?.score, 200);
  assert.equal(api.limitedOrdinaryVocationalControlLine(atLimited)?.score, 150);
  assert.equal(api.isVocationalProfile(belowBachelor), true);
  assert.equal(api.isVocationalProfile(atBachelor), false);
  assert.deepEqual([...api.candidatePoolsForProfile(belowBachelor).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
  assert.ok(api.candidatePoolsForProfile(atBachelor).every((candidate) => candidate.id !== "vocational-dual"));

  const belowStatus = api.ordinaryVocationalQualificationStatus(belowAll);
  assert.equal(belowStatus.generalBelow, true);
  assert.equal(belowStatus.limitedOnly, false);
  assert.equal(belowStatus.below, true);
  assert.equal(api.isBelowOrdinaryVocationalLine(belowAll), true);
  assert.deepEqual([...api.candidatePoolsForProfile(belowAll).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
  const belowResult = api.scoreCandidate(vocationalCandidate, belowAll, api.classifyProfileBand(belowAll));
  assert.equal(belowResult.confidence, "C");
  assert.ok(belowResult.total <= 42);
  assert.ok(belowResult.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
  assert.ok(belowResult.schoolOptions.every((option) => !/大学|学院/.test(option.name)));
  assert.equal(api.buildApplicationPlan([belowResult]).length, 0);
  assert.ok(belowResult.warnings.some((warning) => /低于限定院校线150分/.test(warning)));

  for (const limitedProfile of [atLimited, belowGeneral]) {
    const status = api.ordinaryVocationalQualificationStatus(limitedProfile);
    assert.equal(status.generalBelow, true);
    assert.equal(status.limitedOnly, true);
    assert.equal(status.below, false);
    assert.equal(api.isBelowOrdinaryVocationalLine(limitedProfile), false);
    assert.deepEqual([...api.candidatePoolsForProfile(limitedProfile).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
    const result = api.scoreCandidate(vocationalCandidate, limitedProfile, api.classifyProfileBand(limitedProfile));
    assert.equal(result.confidence, "C");
    assert.ok(result.total <= 58);
    assert.ok(result.schoolOptions.length > 0);
    assert.ok(result.schoolOptions.every((option) => option.record));
    assert.ok(result.schoolOptions.every((option) => option.record.province === "湖北" && /^C/.test(option.record.schoolCode || "")));
    assert.ok(result.schoolOptions.every((option) => /^official-hubei-vocational-2025-(history|physics)$/.test(option.record.sourceId)));
    assert.ok(result.schoolOptions.every((option) => option.record.minScore >= 150 && option.record.minScore < 200 && option.record.minScore <= Number(limitedProfile.score)));
    assert.ok(result.warnings.some((warning) => /150分线仅适用于.*独立学院和民办高校.*武汉市以外/.test(warning)));
    const plan = api.buildApplicationPlan([result]);
    assert.ok(plan.length > 0);
    assert.ok(plan.every((tier) => tier.id === "plan"));
  }

  const generalStatus = api.ordinaryVocationalQualificationStatus(atGeneral);
  assert.equal(generalStatus.generalBelow, false);
  assert.equal(generalStatus.limitedOnly, false);
  assert.equal(generalStatus.below, false);
  assert.deepEqual([...api.candidatePoolsForProfile(atGeneral).map((candidate) => candidate.id)], ["vocational-dual", "regional-safe"]);
  const generalResult = api.scoreCandidate(vocationalCandidate, atGeneral, api.classifyProfileBand(atGeneral));
  assert.ok(generalResult.warnings.every((warning) => !/当前分数低于湖北2026普通高职高专通用线/.test(warning)));
}

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope !== "control-line-only");
assert.equal(api.ordinaryBachelorControlLine(profile("物理类", 700)), null, "Limited and special rows must not become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile("历史类", 700)), null, "Limited and special rows must not become the general vocational line");
assert.equal(api.limitedOrdinaryVocationalControlLine(profile("历史类", 150))?.score, 150, "Limited line must remain independently available");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundaries: imported.diagnostics.ordinaryBoundaries,
  isolatedSpecialPaths: 26,
  isolatedLimitedSchoolLines: 2,
  boundarySafety: { belowAllMaxTotal: 42, limitedOnlyMaxTotal: 58, confidence: "C", testedScores: [149, 150, 199, 200, 434, 435, 442, 443] },
}, null, 2));
