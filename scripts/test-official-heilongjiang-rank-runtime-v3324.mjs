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
const sourceId = "official-heilongjiang-rank-2025-v3324";
const floors = { 历史类: 130, 物理类: 130 };

function readGzip(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-heilongjiang-rank-conversion-2025-v3324-import.json"), "utf8"));
const applied = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-heilongjiang-rank-conversion-2025-v3324-runtime-manifest.json"), "utf8"));
const liteAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/runtime-core-lite-v3324-manifest.json"), "utf8"));
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readGzip(coreFile);
const lite = readGzip(liteFile);
const manifest = readGzip(manifestFile);
const heilongjiangItem = manifest.shards["黑龙江"];
const shard = readGzip(path.join(releaseDir, `${path.basename(heilongjiangItem.file, ".json")}.json.gz`));

assert.equal(imported.dataset, "official-heilongjiang-rank-conversion-2025-v3324-import");
assert.equal(imported.rankConversions.length, 1091);
assert.equal(imported.audit.parsedRecords, 1091);
assert.equal(imported.audit.officialXlsTableRows, 1093);
assert.equal(imported.audit.officialPositiveRows, 1091);
assert.equal(imported.audit.eolTableRows, 1094);
assert.equal(imported.audit.rowComparisons, 1091);
assert.equal(imported.audit.cellComparisons, 3273);
assert.equal(imported.audit.sourceDifferences, 0);
assert.equal(imported.audit.rawCountCellAnomalies, 2);
assert.equal(imported.audit.duplicateIds, 0);
assert.equal(imported.audit.allDerivedCountsClose, true);
assert.equal(imported.audit.allCumulativeRanksContinuous, true);
assert.equal(imported.audit.scoreBasis, "gaokao-cultural-score-excluding-policy-bonus");
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "历史类").length, 528);
assert.equal(imported.rankConversions.filter((row) => row.subjectType === "物理类").length, 563);
assert.equal(imported.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.ok(imported.sourceNotes[0].cautions.some((value) => value.includes("不含照顾政策分")));
assert.equal(imported.sourceNotes[0].provenance.cellComparisons, 3273);

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

assert.equal(shard.records.length, 15910);
assert.equal(shard.rankConversions.length, 2162);
assert.equal(heilongjiangItem.records, 15910);
assert.equal(heilongjiangItem.rankConversions, 2162);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 1091);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId && row.sourceQuality.startsWith("official")).length, 1091);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.rankEnd, 846);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 654)?.sourceId, undefined);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.sourceId, sourceId);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.rankEnd, 5997);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 136)?.sourceId, undefined);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 7098);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 5706);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1392);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 493);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 4016);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1722);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 150);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 1206);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 4);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true && row.nativeAdmissionRankUnavailable === true));
assert.ok(linked.every((row) => Number(row.minScore) >= floors[row.subjectType]));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-cultural-score-excluding-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === false));

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
assert.equal(remainingBelowFloor.length, 0);
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
assert.equal(isolatedSpecial.length, 84);
assert.ok(isolatedSpecial.every((row) => row.rankSourceId !== sourceId));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.deepEqual(sourceNote.publishedScoreFloors, { 历史类: 130, 物理类: 130 });
assert.equal(sourceNote.scoreBasis, "gaokao-cultural-score-excluding-policy-bonus");
assert.equal(sourceNote.provenance.rowComparisons, 1091);
assert.equal(sourceNote.provenance.cellComparisons, 3273);
assert.ok(core.admissionScoreLayer.currentFinding.includes("7098条黑龙江2025普通类整数最低分"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("不含照顾政策分"));

const shardRaw = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, `${path.basename(heilongjiangItem.file, ".json")}.json.gz`)));
const coreRaw = zlib.gunzipSync(fs.readFileSync(coreFile));
assert.equal(sha256(shardRaw), heilongjiangItem.sha256);
assert.equal(sha256(coreRaw), manifest.core.sha256);

assert.equal(applied.dataset, "official-heilongjiang-rank-conversion-2025-v3324-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 7098);
assert.equal(applied.after.specialPathExcludedRecords, 84);
assert.deepEqual(applied.after.linkedByType, {
  "institution-admission": 150,
  "major-admission": 1722,
  "major-group-admission": 4016,
  "school-admission-summary": 4,
  "vocational-admission": 1206,
});

const hdu = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-hdu-national-2014-2025-school-major-admission");
assert.equal(hdu.heilongjiang2025ScoreDerivedRankRecords, 15);
assert.equal(hdu.derivedRankRecords, 214);
assert.equal(hdu.rankUnavailableRecords, 7249);
assert.ok(hdu.rankAlignmentBoundary.includes("黑龙江2025年15条"));

console.log("official Heilongjiang 2025 rank runtime v3.324 tests passed");
