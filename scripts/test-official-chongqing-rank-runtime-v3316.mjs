#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.316-chongqing-authority-linked-rank2025-aligned-868426records";
const sourceId = "official-chongqing-rank-2025-v3316";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const shardBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "chongqing.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-chongqing-rank-conversion-2025-v3316-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 119677);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5120);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 119677);
assert.equal(manifest.runtimeProfile.version, "v3.316");
assert.equal(manifest.shards["重庆"].records, 62503);
assert.equal(manifest.shards["重庆"].rankConversions, 1963);
assert.equal(manifest.shards["重庆"].bytes, shardBytes.length);
assert.equal(manifest.shards["重庆"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 975);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 473);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 502);
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 438).rankEnd, 35253);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 425).rankEnd, 103219);
assert.deepEqual(newRanks.find((row) => row.subjectType === "历史类" && row.score === 652).scoreRange, { min: 652, max: 750 });
assert.deepEqual(newRanks.find((row) => row.subjectType === "物理类" && row.score === 681).scoreRange, { min: 681, max: 750 });

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 29017);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 28481);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 536);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 19800);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 115);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 9094);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 2);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 6);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 530);
assert.equal(linked.filter((row) => row.rankDerivedFromScore === true).length, 29017);
assert.equal(linked.filter((row) => row.rankEvidenceScope === "score-derived-provincial-segment").length, 29017);
assert.equal(linked.filter((row) => row.nativeAdmissionRankUnavailable === true).length, 29017);
assert.equal(linked.filter((row) => row.rankUnavailable === false && row.scoreOnly === false).length, 29017);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 50);
assert.ok(linked.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));
assert.ok(linked.every((row) => row.cautions.some((text) => text.includes("重庆2025一分一段表按最低分换算"))));

const physics600 = linked.find((row) => row.sourceId === "official-chongqing-undergraduate-2025-physics-parallel" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 11421);
assert.equal(physics600.minRankEnd, 11716);
assert.equal(physics600.rankRangeText, "11421-11716（最低分换算）");

const history438 = linked.find((row) => row.sourceId === "official-chongqing-undergraduate-2025-history-parallel" && row.minScore === 438);
assert.ok(history438);
assert.equal(history438.minRankStart, 34958);
assert.equal(history438.minRankEnd, 35253);

const vocational180 = linked.find((row) => row.sourceId === "official-chongqing-vocational-2025-physics-parallel" && row.minScore === 180);
assert.ok(vocational180);
assert.equal(vocational180.minRankStart, 139478);
assert.equal(vocational180.minRankEnd, 139478);

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 180
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 337);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(rankSource);
assert.equal(rankSource.parsedRecords, 975);
assert.equal(rankSource.provenance.fullTableComparisons, 975);
assert.equal(rankSource.provenance.fullCellComparisons, 2925);
assert.equal(rankSource.provenance.officialDirectRetrievalStatus, "tls-unavailable-current-session");

assert.equal(core.admissionScoreLayer.rankCoverage.records, 119677);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 206);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 140);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 119677);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.equal(year2025.sources, 72);
assert.equal(year2025.parsedSources, 48);
assert.equal(year2025.parsedRecords, 16024);
assert.ok(year2025.parsedProvinces.includes("重庆"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "重庆");
  assert.equal(row.rankConversionRecords, 1963);
  assert.equal(row.officialRankRecords, 1963);
  assert.equal(row.officialEvidenceRecords, 61228);
  assert.equal(row.majorWithScoreDerivedRank, 19898);
  assert.equal(row.institutionWithScoreDerivedRank, 115);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 975);
assert.equal(runtimeManifest.after.linkedAdmissionRecords, 29017);
assert.equal(runtimeManifest.after.officialLinkedRecords, 28481);
assert.equal(runtimeManifest.after.thirdPartyLinkedRecords, 536);
assert.equal(runtimeManifest.after.schoolOfficialScopeLinkedRecords, 530);
assert.equal(runtimeManifest.after.specialPathExcludedRecords, 337);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 50);
assert.equal(runtimeManifest.after.linkedSourceNotes, 110);
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, sha256(coreBytes));

console.log(JSON.stringify({ ok: true, modelVersion, ranks: newRanks.length, linkedAdmissionRecords: linked.length, specialPathExcluded: excludedSpecial.length, sourceNotes: core.admissionScoreLayer.sourceNotes.length }, null, 2));
