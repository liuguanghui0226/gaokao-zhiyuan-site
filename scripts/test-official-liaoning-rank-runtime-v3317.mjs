#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.318-hunan-education-department-rank2025-aligned-868426records";
const sourceId = "official-liaoning-rank-2025-v3317";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const shardBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "liaoning.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-liaoning-rank-conversion-2025-v3317-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 121889);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5122);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 121889);
assert.equal(manifest.runtimeProfile.version, "v3.318");
assert.equal(manifest.shards["辽宁"].records, 34360);
assert.equal(manifest.shards["辽宁"].rankConversions, 2149);
assert.equal(manifest.shards["辽宁"].bytes, shardBytes.length);
assert.equal(manifest.shards["辽宁"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 1073);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 517);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 556);
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 437).rankEnd, 26916);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 367).rankEnd, 118109);
assert.deepEqual(newRanks.find((row) => row.subjectType === "历史类" && row.score === 669).scoreRange, { min: 669, max: 750 });
assert.deepEqual(newRanks.find((row) => row.subjectType === "物理类" && row.score === 707).scoreRange, { min: 707, max: 750 });
assert.ok(!newRanks.some((row) => row.subjectType === "历史类" && [667, 164, 162].includes(row.score)));
assert.ok(!newRanks.some((row) => row.subjectType === "物理类" && [703, 153].includes(row.score)));

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 21701);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 20760);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 941);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 15794);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 109);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 5789);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 6);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 3);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 531);
assert.equal(linked.filter((row) => row.rankDerivedFromScore === true).length, 21701);
assert.equal(linked.filter((row) => row.rankEvidenceScope === "score-derived-provincial-segment").length, 21701);
assert.equal(linked.filter((row) => row.nativeAdmissionRankUnavailable === true).length, 21701);
assert.equal(linked.filter((row) => row.rankUnavailable === false && row.scoreOnly === false).length, 21701);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 0);
assert.ok(linked.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));
assert.ok(linked.every((row) => row.cautions.some((text) => text.includes("辽宁2025成绩统计表按最低分换算"))));

const physics600 = linked.find((row) => row.sourceId === "official-liaoning-2025-filing-undergrad-physics" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 13272);
assert.equal(physics600.minRankEnd, 13601);
assert.equal(physics600.rankRangeText, "13272-13601（最低分换算）");

const history437 = linked.find((row) => row.sourceId === "official-liaoning-2025-filing-undergrad-history" && row.minScore === 437);
assert.ok(history437);
assert.equal(history437.minRankStart, 26702);
assert.equal(history437.minRankEnd, 26916);

const physics367 = linked.find((row) => row.sourceId === "official-liaoning-2025-filing-undergrad-physics" && row.minScore === 367);
assert.ok(physics367);
assert.equal(physics367.minRankStart, 117758);
assert.equal(physics367.minRankEnd, 118109);

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 150
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 41);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(rankSource);
assert.equal(rankSource.parsedRecords, 1073);
assert.equal(rankSource.provenance.rowComparisons, 1073);
assert.equal(rankSource.provenance.cellComparisons, 3219);
assert.equal(rankSource.provenance.zeroScoreGaps, 5);
assert.equal(rankSource.provenance.officialDirectRetrievalStatus, "tls-unavailable-current-session");

assert.equal(core.admissionScoreLayer.rankCoverage.records, 121889);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 208);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 142);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 121889);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.equal(year2025.sources, 74);
assert.equal(year2025.parsedSources, 50);
assert.equal(year2025.parsedRecords, 18236);
assert.ok(year2025.parsedProvinces.includes("辽宁"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "辽宁");
  assert.equal(row.rankConversionRecords, 2149);
  assert.equal(row.officialRankRecords, 2149);
  assert.equal(row.officialEvidenceRecords, 33076);
  assert.equal(row.majorWithScoreDerivedRank, 15911);
  assert.equal(row.institutionWithScoreDerivedRank, 109);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 1073);
assert.equal(runtimeManifest.after.linkedAdmissionRecords, 21701);
assert.equal(runtimeManifest.after.officialLinkedRecords, 20760);
assert.equal(runtimeManifest.after.thirdPartyLinkedRecords, 941);
assert.equal(runtimeManifest.after.schoolOfficialScopeLinkedRecords, 531);
assert.equal(runtimeManifest.after.specialPathExcludedRecords, 41);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 0);
assert.equal(runtimeManifest.after.linkedSourceNotes, 106);
assert.deepEqual(runtimeManifest.after.linkedByType, { "institution-admission": 109, "major-admission": 15794, "major-group-admission": 6, "school-admission-summary": 3, "vocational-admission": 5789 });
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, "4d04d4b8b4dc960d7c2bf0d12ec6d6ec1d0377cf1edb54958d8277786520dbeb");
assert.notEqual(runtimeManifest.after.coreSha256, sha256(coreBytes));

console.log(JSON.stringify({ ok: true, modelVersion, ranks: newRanks.length, linkedAdmissionRecords: linked.length, specialPathExcluded: excludedSpecial.length, sourceNotes: core.admissionScoreLayer.sourceNotes.length }, null, 2));
