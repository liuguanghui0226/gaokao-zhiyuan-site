#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.324-heilongjiang-official-rank2025-no-policy-bonus-published-floor-aligned-868426records";
const sourceId = "official-fujian-rank-2025-v3323";
const floors = { 历史类: 215, 物理类: 215 };

function readGzip(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-fujian-rank-conversion-2025-v3323-import.json"), "utf8"));
const applied = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-fujian-rank-conversion-2025-v3323-runtime-manifest.json"), "utf8"));
const liteAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/runtime-core-lite-v3323-manifest.json"), "utf8"));
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readGzip(coreFile);
const lite = readGzip(liteFile);
const manifest = readGzip(manifestFile);
const fujianItem = manifest.shards["福建"];
const shard = readGzip(path.join(releaseDir, `${path.basename(fujianItem.file, ".json")}.json.gz`));

assert.equal(imported.dataset, "official-fujian-rank-conversion-2025-v3323-import");
assert.equal(imported.rankConversions.length, 932);
assert.equal(imported.audit.parsedRecords, 932);
assert.equal(imported.audit.structuredRows, 933);
assert.equal(imported.audit.officialImageRows, 930);
assert.equal(imported.audit.officialImageCellsCompared, 2790);
assert.equal(imported.audit.zeroCandidateRows, 1);
assert.equal(imported.audit.topBuckets, 2);
assert.equal(imported.audit.duplicateIds, 0);
assert.equal(imported.audit.allCountsClose, true);
assert.equal(imported.audit.allCumulativeRanksContinuous, true);
assert.equal(imported.audit.officialImages, 8);
assert.equal(imported.audit.imageOcrRowsCompared, 930);
assert.equal(imported.audit.imageOcrMatches.cumulative, 438);
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "历史类").length, 457);
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "物理类").length, 475);
assert.equal(imported.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.ok(imported.sourceNotes[0].cautions.some((value) => value.includes("含政策性加分")));
assert.equal(imported.sourceNotes[0].provenance.officialImageRows, 930);

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128036);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 128036);
assert.equal(manifest.runtimeProfile.version, "v3.324");
assert.equal(manifest.runtimeProfile.initialCore, "knowledge-core-lite.json.gz");
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5128);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5128);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.ok(liteAudit.liteCore.rawReductionRate >= 0.75);

assert.equal(shard.records.length, 22234);
assert.equal(shard.rankConversions.length, 1859);
assert.equal(fujianItem.records, 22234);
assert.equal(fujianItem.rankConversions, 1859);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 932);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId && row.sourceQuality.startsWith("official")).length, 932);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.rankEnd, 1756);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 664)?.sourceId, undefined);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.rankEnd, 12735);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 7591);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 6353);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1238);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 689);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 10);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1718);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 195);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 5664);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 4);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true && row.nativeAdmissionRankUnavailable === true));
assert.ok(linked.every((row) => Number(row.minScore) >= floors[row.subjectType]));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));

const remainingBelowFloor = shard.records.filter((row) => (
  row.year === 2025
  && row.minScore !== null
  && row.minScore !== undefined
  && row.minScore !== ""
  && Number.isInteger(floors[row.subjectType])
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) < floors[row.subjectType]
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(remainingBelowFloor.length, 1);
assert.ok(remainingBelowFloor.every((row) => row.rankSourceId !== sourceId));
const isolatedSpecial = shard.records.filter((row) => (
  row.year === 2025
  && row.minScore !== null
  && row.minScore !== undefined
  && row.minScore !== ""
  && Number.isInteger(floors[row.subjectType])
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= floors[row.subjectType]
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(isolatedSpecial.length, 149);
assert.ok(isolatedSpecial.every((row) => row.rankSourceId !== sourceId));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.deepEqual(sourceNote.publishedScoreFloors, { 历史类: 215, 物理类: 215 });
assert.equal(sourceNote.provenance.officialImageRows, 930);
assert.equal(sourceNote.provenance.imageOcrCumulativeMatches, 438);
assert.ok(core.admissionScoreLayer.currentFinding.includes("7098条黑龙江2025普通类整数最低分"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("低于公开分数档"));

const shardRaw = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, `${path.basename(fujianItem.file, ".json")}.json.gz`)));
const coreRaw = zlib.gunzipSync(fs.readFileSync(coreFile));
assert.equal(sha256(shardRaw), fujianItem.sha256);
assert.equal(sha256(coreRaw), manifest.core.sha256);

assert.equal(applied.dataset, "official-fujian-rank-conversion-2025-v3323-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 7591);
assert.equal(applied.after.specialPathExcludedRecords, 149);
assert.deepEqual(applied.after.linkedByType, {
  "institution-admission": 195,
  "major-admission": 1718,
  "major-group-admission": 10,
  "school-admission-summary": 4,
  "vocational-admission": 5664,
});

console.log("official Fujian 2025 rank runtime v3.323 tests passed");
