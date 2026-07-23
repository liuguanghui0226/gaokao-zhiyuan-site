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
const sourceId = "official-shanghai-control-lines-2026";
const rankSourceId = "official-shanghai-rank-2026";
const rankSourceUrl = "https://www.shmeea.edu.cn/page/02200/20260623/20375.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanghai-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanghai-control-lines-2026-v3292-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const shanghai = readGzipJson(path.join(releaseDir, "shanghai.json.gz"));
const records = shanghai.records.filter((record) => record.sourceId === sourceId);
const rankRows = shanghai.rankConversions.filter((record) => record.year === 2026 && record.sourceId === rankSourceId);
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === rankSourceId);

assert.equal(imported.diagnostics.recordCount, 5);
assert.equal(imported.diagnostics.ordinaryRecords, 1);
assert.equal(imported.diagnostics.specialPathRecords, 4);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 1, special: 1, sports: 1, art: 2 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { bachelor: 403, vocational: null });
assert.equal(imported.diagnostics.ordinaryVocationalStatus, "pending-official-release");
assert.equal(imported.diagnostics.scoreMaximum, 660);
assert.equal(records.length, 5);
assert.equal(new Set(records.map((record) => record.id)).size, 5);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 1);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 4);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128591);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5129);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.shards["上海"].records, 6247);
assert.equal(manifest.shards["上海"].rankConversions, 214);
assert.equal(runtimeManifest.after.sourceRecords, 5);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 214);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(runtimeManifest.after.ordinaryVocationalStatus, "pending-official-release");
assert.equal(runtimeManifest.after.ordinaryVocationalExpectedPublicationAt, "2026-07-29");

assert.equal(rankRows.length, 214);
assert.ok(rankRows.every((record) => record.sourceUrl === rankSourceUrl));
assert.equal(rankRows[0].score, 616);
assert.deepEqual(rankRows[0].scoreRange, { min: 616, max: 660 });
assert.equal(rankRows[0].rankStart, 1);
assert.equal(rankRows[0].rankEnd, 58);
assert.equal(rankRows.at(-1).score, 403);
assert.equal(rankRows.at(-1).rankEnd, 51853);
for (let index = 0; index < rankRows.length; index += 1) {
  const record = rankRows[index];
  assert.equal(record.rankEnd - record.rankStart + 1, record.sameRankScore, `Rank width drifted at ${record.score}`);
  if (index) assert.equal(rankRows[index - 1].rankEnd + 1, record.rankStart, `Rank continuity drifted at ${record.score}`);
}

assert.equal(sourceNote.province, "上海");
assert.equal(sourceNote.ordinaryVocationalPending, true);
assert.equal(sourceNote.ordinaryVocationalStatus, "pending-official-release");
assert.equal(sourceNote.ordinaryVocationalExpectedPublicationAt, "2026-07-29");
assert.equal(sourceNote.scoreMaximum, 660);
assert.equal(sourceNote.controlPageSha256, "7ec1b138300d46710ea88f21b088b9f10438ad8d94d63caf4ad7cc2c616e28a5");
assert.equal(sourceNote.rankPageSha256, "3faa761df90d0bec7f99627cc1e32cd9df54dc683358d894af9b3cc135a4fa02");
assert.equal(sourceNote.rankPdfSha256, "057f58483e7c54f519982d45a91d27f6994a753543d2a4fb73aa7b49474320e1");
assert.equal(sourceNote.schedulePageSha256, "966666374eaefdba5bb3efd97373df43d3b54f6a1c1dce58ba45d396be253beb");
assert.equal(rankSourceNote.url, rankSourceUrl);
assert.equal(rankSourceNote.pageHtmlSha256, "3faa761df90d0bec7f99627cc1e32cd9df54dc683358d894af9b3cc135a4fa02");
assert.equal(rankSourceNote.pdfSha256, "057f58483e7c54f519982d45a91d27f6994a753543d2a4fb73aa7b49474320e1");
assert.equal(rankSourceNote.pageEvidence.records, 214);
assert.deepEqual(rankSourceNote.pageEvidence.scoreRange, { min: 403, max: 616 });
assert.deepEqual(rankSourceNote.pageEvidence.topScoreRange, { min: 616, max: 660 });
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 214);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

const ordinary = records.find((record) => record.controlLineRouteKind === "ordinary-bachelor");
assert.equal(ordinary?.minScore, 403);
assert.equal(ordinary?.scoreBasis, "gaokao-total");
assert.equal(ordinary?.scoreMaximum, 660);
assert.equal(records.find((record) => record.controlLineRouteKind === "special")?.minScore, 504);
assert.equal(records.find((record) => record.controlLineRouteKind === "sports")?.minScore, 282);
assert.deepEqual(records.filter((record) => record.controlLineRouteKind === "art").map((record) => record.minScore).sort((a, b) => a - b), [220, 302]);
assert.ok(records.filter((record) => record.formalScoreScope === "special-path-only").every((record) => !Number.isFinite(record.professionalMinScore)));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /2026年普通专科控制线待发布/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__shanghaiControlTest = {
  state,
  CANDIDATE_POOLS,
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
const api = context.__shanghaiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shanghai.records;
api.state.data.admissionScoreLayer.rankConversions = shanghai.rankConversions;

function profile(score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "",
    province: "上海",
    subject: "综合",
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: "物理 化学",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "上海 杭州 苏州",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const below = profile(402);
const atLine = profile(403);
assert.equal(api.ordinaryBachelorControlLine(atLine)?.score, 403);
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
assert.ok(pendingResult.schoolOptions.every((option) => !/大学|学院/.test(option.name)), "Pending vocational cards must not name a specific institution");
assert.deepEqual([...pendingResult.schoolOptions.map((option) => option.name)], ["2026普通高职专科资格线跟踪", "双高专业群与职业本科路径调研", "专升本与就业衔接核验"]);
assert.equal(api.buildApplicationPlan([pendingResult]).length, 0);
assert.ok(pendingResult.reasons.some((reason) => /普通高职专科控制线尚待官方发布/.test(reason)));
assert.ok(pendingResult.warnings.some((warning) => /当前结果只作路径调研/.test(warning)));

const atLineRank = api.estimateRankFromScore(atLine);
assert.equal(api.estimateRankFromScore(below), null, "402 must not borrow the 403 undergraduate rank boundary");
assert.equal(atLineRank?.rank, 51853);
assert.equal(atLineRank?.exact, true);
assert.equal(api.estimateRankFromScore(profile(616))?.rank, 58);
assert.equal(api.estimateRankFromScore(profile(617))?.rank, 58);
assert.equal(api.estimateRankFromScore(profile(660))?.rank, 58);
assert.equal(api.estimateRankFromScore(profile(661)), null);

const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const undergraduateResult = api.scoreCandidate(undergraduateCandidate, atLine, api.classifyProfileBand(atLine));
assert.ok(undergraduateResult.reasons.some((reason) => /本科录取控制分数线403分/.test(reason)));
assert.ok(undergraduateResult.reasons.some((reason) => /不等于达到任何具体院校或专业投档线/.test(reason)));

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile(600)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile(600)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundary: 403,
  pendingVocationalLine: true,
  rankCoverage: { minScore: 403, maxScore: 660, maxRank: 51853 },
  pendingLineSafety: { belowScore: 402, atLineScore: 403, maxTotal: 55, applicationPlanRows: 0 },
}, null, 2));
