#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.322-hubei-official-rank2025-full-cohort-aligned-868426records";
const sourceId = "official-hubei-rank-2025-v3322";
const floors = { 历史类: 0, 物理类: 0 };

function readGzip(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hubei-rank-conversion-2025-v3322-import.json"), "utf8"));
const applied = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hubei-rank-conversion-2025-v3322-runtime-manifest.json"), "utf8"));
const liteAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/runtime-core-lite-v3322-manifest.json"), "utf8"));
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readGzip(coreFile);
const lite = readGzip(liteFile);
const manifest = readGzip(manifestFile);
const hubeiItem = manifest.shards["湖北"];
const shard = readGzip(path.join(releaseDir, `${path.basename(hubeiItem.file, ".json")}.json.gz`));

assert.equal(imported.dataset, "official-hubei-rank-conversion-2025-v3322-import");
assert.equal(imported.rankConversions.length, 1313);
assert.equal(imported.audit.parsedRecords, 1313);
assert.equal(imported.audit.officialPdfRows, 1311);
assert.equal(imported.audit.officialPdfCellsValidated, 3933);
assert.equal(imported.audit.topBuckets, 2);
assert.equal(imported.audit.duplicateIds, 0);
assert.equal(imported.audit.allCountsClose, true);
assert.equal(imported.audit.allCumulativeRanksContinuous, true);
assert.equal(imported.audit.officialImages, 12);
assert.equal(imported.audit.imageOcrRowsCompared, 1311);
assert.equal(imported.audit.imageOcrMatches.cumulative, 1289);
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "历史类").length, 650);
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "物理类").length, 663);
assert.equal(imported.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.ok(imported.sourceNotes[0].cautions.some((value) => value.includes("含政策性加分")));
assert.equal(imported.sourceNotes[0].provenance.officialPdfRows, 1311);

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 126013);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 126013);
assert.equal(manifest.runtimeProfile.version, "v3.322");
assert.equal(manifest.runtimeProfile.initialCore, "knowledge-core-lite.json.gz");
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5126);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5126);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.ok(liteAudit.liteCore.rawReductionRate >= 0.75);

assert.equal(shard.records.length, 16239);
assert.equal(shard.rankConversions.length, 2392);
assert.equal(hubeiItem.records, 16239);
assert.equal(hubeiItem.rankConversions, 2392);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 1313);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId && row.sourceQuality.startsWith("official")).length, 1313);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.rankEnd, 3166);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.rankEnd, 14274);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 7659);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 7069);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 590);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 629);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 4553);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1037);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 166);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 1900);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 3);
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
assert.equal(remainingBelowFloor.length, 0);
assert.ok(remainingBelowFloor.every((row) => row.rankSourceId !== sourceId));
const isolatedSpecial = shard.records.filter((row) => (
  row.year === 2025
  && Number.isInteger(floors[row.subjectType])
  && Number(row.minScore) >= floors[row.subjectType]
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(isolatedSpecial.length, 196);
assert.ok(isolatedSpecial.every((row) => row.rankSourceId !== sourceId));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.deepEqual(sourceNote.publishedScoreFloors, { 历史类: 0, 物理类: 0 });
assert.equal(sourceNote.provenance.officialPdfRows, 1311);
assert.equal(sourceNote.provenance.imageOcrCumulativeMatches, 1289);
assert.ok(core.admissionScoreLayer.currentFinding.includes("7659条湖北2025普通类整数最低分记录"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("含政策性加分"));

const shardRaw = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, `${path.basename(hubeiItem.file, ".json")}.json.gz`)));
const coreRaw = zlib.gunzipSync(fs.readFileSync(coreFile));
assert.equal(sha256(shardRaw), hubeiItem.sha256);
assert.equal(sha256(coreRaw), manifest.core.sha256);

assert.equal(applied.dataset, "official-hubei-rank-conversion-2025-v3322-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 7659);
assert.equal(applied.after.specialPathExcludedRecords, 196);
assert.deepEqual(applied.after.linkedByType, {
  "institution-admission": 166,
  "major-admission": 1037,
  "major-group-admission": 4553,
  "school-admission-summary": 3,
  "vocational-admission": 1900,
});

console.log("official Hubei 2025 rank runtime v3.322 tests passed");
