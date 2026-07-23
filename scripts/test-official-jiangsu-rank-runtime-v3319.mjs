#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.326-xinjiang-rank2025-score-basis-conflict-blocked-868426records";
const sourceId = "official-jiangsu-rank-2025-v3319";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const shardBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "jiangsu.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-jiangsu-rank-conversion-2025-v3319-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128591);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5130);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 128591);
assert.equal(manifest.runtimeProfile.version, "v3.326");
assert.equal(manifest.shards["江苏"].records, 26991);
assert.equal(manifest.shards["江苏"].rankConversions, 806);
assert.equal(manifest.shards["江苏"].bytes, shardBytes.length);
assert.equal(manifest.shards["江苏"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 398);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 177);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 221);
assert.deepEqual(newRanks.find((row) => row.subjectType === "历史类" && row.score === 658).scoreRange, { min: 658, max: 750 });
assert.deepEqual(newRanks.find((row) => row.subjectType === "物理类" && row.score === 683).scoreRange, { min: 683, max: 750 });
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 600).rankEnd, 5796);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 600).rankEnd, 34888);
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 482).rankEnd, 56398);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 463).rankEnd, 205975);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 7060);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 5912);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1148);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1750);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 152);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 330);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 4826);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 2);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 796);
assert.equal(linked.filter((row) => row.rankDerivedFromScore === true && row.rankEvidenceScope === "score-derived-provincial-segment" && row.nativeAdmissionRankUnavailable === true).length, 7060);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 8);
assert.ok(linked.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));
assert.ok(linked.every((row) => row.cautions.some((text) => text.includes("江苏2025第一阶段逐分段统计表按最低分换算"))));

const history600 = linked.find((row) => row.id === "2025-jiangsu-undergrad-filing-e6a6a7717b8c741844");
const physics600 = linked.find((row) => row.id === "2025-jiangsu-undergrad-filing-3661d144f31786e915");
assert.deepEqual([history600.minRankStart, history600.minRankEnd, history600.rankRangeText], [5559, 5796, "5559-5796（最低分换算）"]);
assert.deepEqual([physics600.minRankStart, physics600.minRankEnd, physics600.rankRangeText], [33986, 34888, "33986-34888（最低分换算）"]);

const belowFloor = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && !Number(row.minRankEnd || row.minRank)
  && row.formalScoreScope !== "special-path-only"
  && ((row.subjectType === "历史类" && Number(row.minScore) < 482) || (row.subjectType === "物理类" && Number(row.minScore) < 463)));
assert.equal(belowFloor.length, 1496);
assert.ok(belowFloor.every((row) => row.rankSourceId !== sourceId));
const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && row.formalScoreScope === "special-path-only"
  && ((row.subjectType === "历史类" && Number.isInteger(Number(row.minScore)) && Number(row.minScore) >= 482 && Number(row.minScore) <= 750)
    || (row.subjectType === "物理类" && Number.isInteger(Number(row.minScore)) && Number(row.minScore) >= 463 && Number(row.minScore) <= 750))
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 123);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.parsedRecords, 398);
assert.equal(rankSource.provenance.rowComparisons, 398);
assert.equal(rankSource.provenance.cellComparisons, 1194);
assert.equal(rankSource.provenance.ocrCorrections, 15);
assert.equal(rankSource.provenance.secondStageExcluded, true);
assert.equal(core.admissionScoreLayer.rankCoverage.records, 128591);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 215);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 149);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 128591);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.deepEqual([year2025.sources, year2025.parsedSources, year2025.parsedRecords], [81, 57, 24938]);
assert.ok(year2025.parsedProvinces.includes("江苏"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "江苏");
  assert.equal(row.rankConversionRecords, 806);
  assert.equal(row.officialRankRecords, 806);
  assert.equal(row.officialEvidenceRecords, 20447);
  assert.equal(row.majorWithRank, 4415);
  assert.equal(row.majorWithScoreDerivedRank, 1959);
  assert.equal(row.institutionWithRank, 301);
  assert.equal(row.institutionWithScoreDerivedRank, 152);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 398);
assert.equal(runtimeManifest.after.linkedAdmissionRecords, 7060);
assert.equal(runtimeManifest.after.officialLinkedRecords, 5912);
assert.equal(runtimeManifest.after.thirdPartyLinkedRecords, 1148);
assert.equal(runtimeManifest.after.schoolOfficialScopeLinkedRecords, 796);
assert.equal(runtimeManifest.after.specialPathExcludedRecords, 123);
assert.equal(runtimeManifest.after.belowPublishedFloorRecords, 1496);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 8);
assert.equal(runtimeManifest.after.linkedSourceNotes, 113);
assert.deepEqual(runtimeManifest.after.linkedByType, { "institution-admission": 152, "major-admission": 1750, "major-group-admission": 4826, "school-admission-summary": 2, "vocational-admission": 330 });
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, "56cffd0f6baefed6ca3c54ca1c1dad0b0d78a08294deaa06940123eeaf4dd744");
assert.notEqual(runtimeManifest.after.coreSha256, sha256(coreBytes));

console.log(JSON.stringify({ ok: true, modelVersion, ranks: 398, linkedAdmissionRecords: 7060, belowPublishedFloor: 1496, specialPathExcluded: 123, sourceNotes: 5130 }, null, 2));
