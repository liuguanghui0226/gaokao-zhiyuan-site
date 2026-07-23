#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.325-hainan-official-rank2025-policy-bonus-inclusive-published-floor-aligned-868426records";
const sourceId = "official-hainan-rank-2025-v3325";

function readGzip(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hainan-rank-conversion-2025-v3325-import.json"), "utf8"));
const applied = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hainan-rank-conversion-2025-v3325-runtime-manifest.json"), "utf8"));
const liteAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/runtime-core-lite-v3325-manifest.json"), "utf8"));
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readGzip(coreFile);
const lite = readGzip(liteFile);
const manifest = readGzip(manifestFile);
const hainanItem = manifest.shards["海南"];
const shardFile = path.join(releaseDir, `${path.basename(hainanItem.file, ".json")}.json.gz`);
const shard = readGzip(shardFile);

assert.equal(imported.dataset, "official-hainan-rank-conversion-2025-v3325-import");
assert.equal(imported.rankConversions.length, 555);
assert.equal(imported.audit.parsedRecords, 555);
assert.equal(imported.audit.officialImagePages, 21);
assert.equal(imported.audit.mirrorImagePages, 21);
assert.equal(imported.audit.numericScoreRows, 554);
assert.equal(imported.audit.directCumulativeMatches, 549);
assert.equal(imported.audit.cumulativeCorrections, 7);
assert.equal(imported.audit.arithmeticCorrections, 4);
assert.equal(imported.audit.mirrorCorrections, 3);
assert.equal(imported.audit.duplicateIds, 0);
assert.equal(imported.audit.allDerivedCountsClose, true);
assert.equal(imported.audit.allCumulativeRanksContinuous, true);
assert.equal(imported.audit.scoreBasis, "gaokao-comprehensive-filing-score-including-policy-bonus");
assert.equal(imported.audit.rankPolicyBonusIncluded, true);
assert.ok(imported.sourceNotes[0].cautions.some((value) => value.includes("照顾加分")));
assert.equal(imported.sourceNotes[0].provenance.cumulativeCorrections.length, 7);

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128591);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 128591);
assert.equal(manifest.runtimeProfile.version, "v3.325");
assert.equal(manifest.runtimeProfile.initialCore, "knowledge-core-lite.json.gz");
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5129);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5129);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.ok(liteAudit.liteCore.rawReductionRate >= 0.75);

assert.equal(shard.records.length, 11076);
assert.equal(shard.rankConversions.length, 1102);
assert.equal(hainanItem.records, 11076);
assert.equal(hainanItem.rankConversions, 1102);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 555);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId && row.sourceQuality.startsWith("official")).length, 555);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "综合" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "综合" && row.score === 600)?.rankEnd, 12182);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "综合" && row.score === 246)?.rankEnd, 67408);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "综合" && row.score === 245)?.sourceId, undefined);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 4241);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 3976);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 265);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 244);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 2867);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 447);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 56);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 871);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true && row.nativeAdmissionRankUnavailable === true));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-comprehensive-filing-score-including-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));

const isolatedSpecial = shard.records.filter((row) => (
  row.year === 2025
  && row.subjectType === "综合"
  && row.minScore !== null
  && row.minScore !== undefined
  && row.minScore !== ""
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 246
  && Number(row.minScore) <= 900
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(isolatedSpecial.length, 35);
assert.ok(isolatedSpecial.every((row) => row.rankSourceId !== sourceId));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.equal(sourceNote.publishedScoreFloor, 246);
assert.equal(sourceNote.scoreBasis, "gaokao-comprehensive-filing-score-including-policy-bonus");
assert.equal(sourceNote.rankPolicyBonusIncluded, true);
assert.equal(sourceNote.provenance.officialImagePages, 21);
assert.equal(sourceNote.provenance.mirrorImagePages, 21);
assert.equal(sourceNote.provenance.directCumulativeMatches, 549);
assert.ok(core.admissionScoreLayer.currentFinding.includes("4241条海南2025综合普通类整数最低分"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("口径含照顾加分"));

const shardRaw = zlib.gunzipSync(fs.readFileSync(shardFile));
const coreRaw = zlib.gunzipSync(fs.readFileSync(coreFile));
assert.equal(sha256(shardRaw), hainanItem.sha256);
assert.equal(sha256(coreRaw), manifest.core.sha256);

assert.equal(applied.dataset, "official-hainan-rank-conversion-2025-v3325-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 4241);
assert.equal(applied.after.officialLinkedRecords, 3976);
assert.equal(applied.after.thirdPartyLinkedRecords, 265);
assert.equal(applied.after.specialPathExcludedRecords, 35);
assert.equal(applied.after.topBucketLinkedRecords, 16);
assert.deepEqual(applied.after.linkedByType, {
  "institution-admission": 56,
  "major-admission": 447,
  "major-group-admission": 2867,
  "vocational-admission": 871,
});

const hdu = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-hdu-national-2014-2025-school-major-admission");
assert.equal(hdu.hainan2025ScoreDerivedRankRecords, 8);
assert.equal(hdu.hainan2025RankScoreBasis, "gaokao-comprehensive-filing-score-including-policy-bonus");
assert.equal(hdu.hainan2025RankPolicyBonusIncluded, true);
assert.equal(hdu.derivedRankRecords, 222);
assert.equal(hdu.rankUnavailableRecords, 7241);
assert.ok(hdu.rankAlignmentBoundary.includes("海南2025年8条"));

console.log("official Hainan 2025 rank runtime v3.325 tests passed");
