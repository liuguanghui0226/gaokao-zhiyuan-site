#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.328-shanghai-official-rank2025-policy-bonus-inclusive-undergraduate-floor-aligned-868426records";
const sourceId = "official-shanxi-rank-2025-v3321";
const floors = { 历史类: 443, 物理类: 419 };

function readGzip(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanxi-rank-conversion-2025-v3321-import.json"), "utf8"));
const applied = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanxi-rank-conversion-2025-v3321-runtime-manifest.json"), "utf8"));
const liteAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/runtime-core-lite-v3321-manifest.json"), "utf8"));
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readGzip(coreFile);
const lite = readGzip(liteFile);
const manifest = readGzip(manifestFile);
const shanxiItem = manifest.shards["山西"];
const shard = readGzip(path.join(releaseDir, `${path.basename(shanxiItem.file, ".json")}.json.gz`));

assert.equal(imported.dataset, "official-shanxi-rank-conversion-2025-v3321-import");
assert.equal(imported.rankConversions.length, 517);
assert.deepEqual(imported.audit, {
  ...imported.audit,
  parsedRecords: 517,
  publishedRows: 515,
  topBuckets: 2,
  duplicateIds: 0,
  htmlRowComparisons: 515,
  htmlCellComparisons: 1545,
  htmlDifferences: 0,
  authorityImageOcrScoreMatches: 509,
  authorityImageOcrCumulativeMatches: 514,
  authorityImageKnownRecognitionExceptions: 7,
  governmentTextCheckpointComparisons: 2,
  excludedUnadmittedCandidateSources: 1,
});
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "历史类").length, 230);
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "物理类").length, 287);
assert.equal(imported.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.ok(imported.sourceNotes[0].cautions.some((value) => value.includes("专科段不得由本科表外推")));
assert.equal(imported.sourceNotes[0].provenance.excludedUnadmittedCandidateTable, true);

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 129194);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 129194);
assert.equal(manifest.runtimeProfile.version, "v3.328");
assert.equal(manifest.runtimeProfile.initialCore, "knowledge-core-lite.json.gz");
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5132);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5132);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.ok(liteAudit.liteCore.rawReductionRate >= 0.75);

assert.equal(shard.records.length, 20681);
assert.equal(shard.rankConversions.length, 1587);
assert.equal(shanxiItem.records, 20681);
assert.equal(shanxiItem.rankConversions, 1587);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 517);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId && row.sourceQuality.startsWith("official")).length, 517);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.rankEnd, 1918);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.rankEnd, 10452);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 6587);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 5826);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 761);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 572);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 5132);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1206);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 114);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 130);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 5);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true && row.nativeAdmissionRankUnavailable === true));
assert.ok(linked.every((row) => Number(row.minScore) >= floors[row.subjectType]));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));

const remainingBelowFloor = shard.records.filter((row) => (
  row.year === 2025
  && Number.isInteger(floors[row.subjectType])
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) < floors[row.subjectType]
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(remainingBelowFloor.length, 2100);
assert.ok(remainingBelowFloor.every((row) => row.rankSourceId !== sourceId));
const isolatedSpecial = shard.records.filter((row) => (
  row.year === 2025
  && Number.isInteger(floors[row.subjectType])
  && Number(row.minScore) >= floors[row.subjectType]
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(isolatedSpecial.length, 75);
assert.ok(isolatedSpecial.every((row) => row.rankSourceId !== sourceId));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.deepEqual(sourceNote.publishedScoreFloors, { 历史类: 443, 物理类: 419 });
assert.equal(sourceNote.provenance.htmlDifferences, 0);
assert.equal(sourceNote.provenance.excludedUnadmittedCandidateTable, true);
assert.ok(sourceNote.usage.includes("低于对应本科线不外推"));
assert.ok(sourceNote.cautions.some((value) => value.includes("专科段不得由本科表外推")));

const shardRaw = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, `${path.basename(shanxiItem.file, ".json")}.json.gz`)));
const coreRaw = zlib.gunzipSync(fs.readFileSync(coreFile));
assert.equal(sha256(shardRaw), shanxiItem.sha256);
assert.equal(sha256(coreRaw), manifest.core.sha256);

assert.equal(applied.dataset, "official-shanxi-rank-conversion-2025-v3321-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 6587);
assert.equal(applied.after.specialPathExcludedRecords, 75);
assert.deepEqual(applied.after.linkedByType, {
  "institution-admission": 114,
  "major-admission": 1206,
  "major-group-admission": 5132,
  "school-admission-summary": 5,
  "vocational-admission": 130,
});

console.log("official Shanxi 2025 rank runtime v3.321 tests passed");
