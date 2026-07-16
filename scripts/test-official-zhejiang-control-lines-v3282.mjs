#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.296-guizhou-control-lines2026-and-rank-provenance-847019records";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-zhejiang-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-zhejiang-control-lines-2026-v3282-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const zhejiang = readGzipJson(path.join(releaseDir, "zhejiang.json.gz"));
const records = zhejiang.records.filter((record) => record.sourceId === "official-zhejiang-control-lines-2026");
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-zhejiang-control-lines-2026");

assert.equal(imported.diagnostics.recordCount, 57);
assert.equal(imported.diagnostics.tableCount, 5);
assert.deepEqual(imported.diagnostics.routeCounts, {
  segment: 2,
  special: 1,
  "art-culture": 5,
  "art-composite": 22,
  "sports-composite": 2,
  "single-exam": 25,
});
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { firstSegment: 494, secondSegment: 266, specialType: 594 });
assert.equal(records.length, 57);
assert.equal(new Set(records.map((record) => record.id)).size, 57);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 2);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 55);
assert.equal(records.filter((record) => record.controlLineRouteKind === "segment").length, 2);
assert.equal(records.filter((record) => record.controlLineRouteKind === "single-exam").length, 25);
assert.ok(records.filter((record) => record.controlLineRouteKind !== "segment").every((record) => record.formalScoreScope === "special-path-only"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 847019);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5102);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1373);
assert.deepEqual(core.admissionScoreLayer.coverage.formalScoreMissingProvinces, ["西藏"]);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 847019);
assert.equal(manifest.shards["浙江"].records, 110946);
assert.equal(zhejiang.rankConversions.length, 428);
assert.equal(runtimeManifest.after.sourceRecords, 57);
assert.equal(sourceNote.quality, "official-zhejiang-control-line-html-verified");
assert.equal(sourceNote.pageHtmlSha256, "ecbb3531e9dfed98bb6ae4e31a18d5e9979fe789e04bdad39f7bf6648a5a0550");

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__zhejiangControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  ordinarySegmentStatus,
  isVocationalProfile,
  candidatePoolsForProfile,
  recordMatchesProfileEducationPath,
  recordEligibleForCandidate,
  classifyProfileBand,
  scoreCandidate,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__zhejiangControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = zhejiang.records;
api.state.data.admissionScoreLayer.rankConversions = zhejiang.rankConversions;

function profile(score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    rank: "",
    province: "浙江",
    subject: "综合",
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: "物理 化学",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "杭州 宁波",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const firstLine = profile(494);
const secondTop = profile(493);
const secondLine = profile(266);
const belowSecond = profile(265);
const missingScore = { ...profile(266), score: "" };

assert.equal(api.ordinaryBachelorControlLine(firstLine), null, "Zhejiang first segment must not masquerade as a bachelor line");
assert.equal(api.ordinaryVocationalControlLine(firstLine)?.score, 266);
assert.equal(api.ordinarySegmentStatus(firstLine)?.band, "first");
assert.equal(api.ordinarySegmentStatus(secondTop)?.band, "second");
assert.equal(api.ordinarySegmentStatus(secondLine)?.band, "second");
assert.equal(api.ordinarySegmentStatus(belowSecond)?.band, "below-second");
assert.equal(api.ordinarySegmentStatus(missingScore)?.band, "unknown");
assert.equal(api.isVocationalProfile(firstLine), false);
assert.equal(api.isVocationalProfile(secondTop), false, "Zhejiang second segment must keep remaining bachelor options visible");
assert.equal(api.isVocationalProfile(belowSecond), false, "Segment routing must not hard-filter education level below the line");
assert.equal(api.classifyProfileBand(secondTop).label, "普通类第二段");
assert.equal(api.classifyProfileBand(belowSecond).label, "普通类第二段线以下");
assert.equal(api.classifyProfileBand(firstLine).label, "普通类第一段");

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const engineeringCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
assert.ok(vocationalCandidate);
assert.ok(engineeringCandidate);
assert.equal(api.candidatePoolsForProfile(firstLine).some((candidate) => candidate.id === "vocational-dual"), false);
assert.equal(api.candidatePoolsForProfile(secondTop).some((candidate) => candidate.id === "vocational-dual"), true);
assert.equal(api.candidatePoolsForProfile(belowSecond).some((candidate) => candidate.id === "vocational-dual"), true);

const undergraduateRecord = { batch: "本科批", dataType: "major-admission" };
const vocationalRecord = { batch: "专科批", dataType: "vocational-admission" };
assert.equal(api.recordMatchesProfileEducationPath(undergraduateRecord, secondTop), true);
assert.equal(api.recordMatchesProfileEducationPath(vocationalRecord, secondTop), true);
assert.equal(api.recordMatchesProfileEducationPath(undergraduateRecord, firstLine), true);
assert.equal(api.recordMatchesProfileEducationPath(vocationalRecord, firstLine), false);
assert.equal(api.recordEligibleForCandidate(vocationalRecord, vocationalCandidate, secondTop), true);
assert.equal(api.recordEligibleForCandidate(undergraduateRecord, vocationalCandidate, secondTop), false);
assert.equal(api.recordEligibleForCandidate(undergraduateRecord, engineeringCandidate, secondTop), true);
assert.equal(api.recordEligibleForCandidate(vocationalRecord, engineeringCandidate, secondTop), false);

const belowResult = api.scoreCandidate(vocationalCandidate, belowSecond, api.classifyProfileBand(belowSecond));
const atResult = api.scoreCandidate(vocationalCandidate, secondLine, api.classifyProfileBand(secondLine));
const secondResult = api.scoreCandidate(vocationalCandidate, secondTop, api.classifyProfileBand(secondTop));
const firstResult = api.scoreCandidate(api.CANDIDATE_POOLS.find((candidate) => candidate.id === "regional-safe"), firstLine, api.classifyProfileBand(firstLine));
const missingResult = api.scoreCandidate(vocationalCandidate, missingScore, api.classifyProfileBand(missingScore));

assert.equal(belowResult.confidence, "C");
assert.ok(belowResult.total <= 42);
assert.ok(belowResult.reasons.some((reason) => reason.includes("普通类第二段线266分")));
assert.ok(belowResult.warnings.some((warning) => /低于2026年普通类第二段线266分/.test(warning)));
assert.ok(atResult.warnings.every((warning) => !/低于2026年普通类第二段线266分/.test(warning)));
assert.ok(secondResult.reasons.some((reason) => /第二段仍可能包含剩余本科与高职专科计划/.test(reason)));
assert.ok(firstResult.reasons.some((reason) => /达到2026年浙江普通类第一段线494分/.test(reason)));
assert.ok(missingResult.warnings.every((warning) => !/普通类第二段线266分/.test(warning)));

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  ordinarySegments: { first: 494, second: 266 },
  specialRecords: 55,
  boundarySafety: { belowSecondMaxTotal: 42, confidence: "C", secondKeepsBachelorAndVocational: true },
}, null, 2));
