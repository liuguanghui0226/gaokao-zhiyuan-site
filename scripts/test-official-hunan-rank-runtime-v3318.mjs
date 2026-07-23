#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.330-jiangxi-official-rank2025-filing-score-policy-bonus-inclusive-full-table-replaced-868426records";
const sourceId = "official-hunan-rank-2025-v3318";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const shardBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "hunan.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hunan-rank-conversion-2025-v3318-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 130155);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5134);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 130155);
assert.equal(manifest.runtimeProfile.version, "v3.330");
assert.equal(manifest.shards["湖南"].records, 32686);
assert.equal(manifest.shards["湖南"].rankConversions, 2276);
assert.equal(manifest.shards["湖南"].bytes, shardBytes.length);
assert.equal(manifest.shards["湖南"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 1139);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 550);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 589);
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 446).rankEnd, 53081);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 422).rankEnd, 190592);
assert.deepEqual(newRanks.find((row) => row.subjectType === "历史类" && row.score === 658).scoreRange, { min: 658, max: 750 });
assert.deepEqual(newRanks.find((row) => row.subjectType === "物理类" && row.score === 690).scoreRange, { min: 690, max: 750 });
assert.ok(!newRanks.some((row) => row.subjectType === "历史类" && [129, 124, 116, 115, 112, 110, 105, 104, 103].includes(row.score)));
assert.ok(!newRanks.some((row) => row.subjectType === "物理类" && [107, 101].includes(row.score)));

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 9376);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 8337);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1039);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1483);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 176);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 2330);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 5383);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 4);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 635);
assert.equal(linked.filter((row) => row.rankDerivedFromScore === true).length, 9376);
assert.equal(linked.filter((row) => row.rankEvidenceScope === "score-derived-provincial-segment").length, 9376);
assert.equal(linked.filter((row) => row.nativeAdmissionRankUnavailable === true).length, 9376);
assert.equal(linked.filter((row) => row.rankUnavailable === false && row.scoreOnly === false).length, 9376);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 5);
assert.ok(linked.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));
assert.ok(linked.every((row) => row.cautions.some((text) => text.includes("湖南2025成绩统计表按最低分换算"))));

const physics600 = linked.find((row) => row.sourceId === "official-hunan-undergraduate-filing-2025" && row.subjectType === "物理类" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 15423);
assert.equal(physics600.minRankEnd, 15860);
assert.equal(physics600.rankRangeText, "15423-15860（最低分换算）");

const history446 = linked.find((row) => row.sourceId === "official-hunan-undergraduate-filing-2025" && row.subjectType === "历史类" && row.minScore === 446);
assert.ok(history446);
assert.equal(history446.minRankStart, 52546);
assert.equal(history446.minRankEnd, 53081);

const physics422 = linked.find((row) => row.sourceId === "official-hunan-undergraduate-filing-2025" && row.subjectType === "物理类" && row.minScore === 422);
assert.ok(physics422);
assert.equal(physics422.minRankStart, 189316);
assert.equal(physics422.minRankEnd, 190592);

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 100
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 388);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(rankSource);
assert.equal(rankSource.parsedRecords, 1139);
assert.equal(rankSource.provenance.authorityRows, 1152);
assert.equal(rankSource.provenance.rowComparisons, 1139);
assert.equal(rankSource.provenance.cellComparisons, 3417);
assert.equal(rankSource.provenance.zeroScoreGaps, 11);
assert.equal(rankSource.provenance.eolAuthorityAttribution, "湖南省教育厅");

assert.equal(core.admissionScoreLayer.rankCoverage.records, 130155);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 219);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 153);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 130155);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.equal(year2025.sources, 85);
assert.equal(year2025.parsedSources, 61);
assert.equal(year2025.parsedRecords, 26502);
assert.ok(year2025.parsedProvinces.includes("湖南"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "湖南");
  assert.equal(row.rankConversionRecords, 2276);
  assert.equal(row.officialRankRecords, 2276);
  assert.equal(row.officialEvidenceRecords, 25976);
  assert.equal(row.majorWithRank, 5354);
  assert.equal(row.majorWithScoreDerivedRank, 1728);
  assert.equal(row.institutionWithRank, 383);
  assert.equal(row.institutionWithScoreDerivedRank, 176);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 1139);
assert.equal(runtimeManifest.after.linkedAdmissionRecords, 9376);
assert.equal(runtimeManifest.after.officialLinkedRecords, 8337);
assert.equal(runtimeManifest.after.thirdPartyLinkedRecords, 1039);
assert.equal(runtimeManifest.after.schoolOfficialScopeLinkedRecords, 635);
assert.equal(runtimeManifest.after.specialPathExcludedRecords, 388);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 5);
assert.equal(runtimeManifest.after.linkedSourceNotes, 116);
assert.deepEqual(runtimeManifest.after.linkedByType, { "institution-admission": 176, "major-admission": 1483, "major-group-admission": 5383, "school-admission-summary": 4, "vocational-admission": 2330 });
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, "f9ab6c421205c9430cd96083d31eb45aae0241cc727e3681895a20c767108187");

console.log(JSON.stringify({ ok: true, modelVersion, ranks: newRanks.length, linkedAdmissionRecords: linked.length, specialPathExcluded: excludedSpecial.length, sourceNotes: core.admissionScoreLayer.sourceNotes.length }, null, 2));
