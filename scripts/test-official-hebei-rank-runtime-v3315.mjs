#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.317-liaoning-official-mirror-rank2025-aligned-868426records";
const sourceId = "official-hebei-rank-2025-v3315";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const shardBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "hebei.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hebei-rank-conversion-2025-v3315-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 120750);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5121);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 120750);
assert.equal(manifest.runtimeProfile.version, "v3.317");
assert.equal(manifest.shards["河北"].records, 69443);
assert.equal(manifest.shards["河北"].rankConversions, 2181);
assert.equal(manifest.shards["河北"].bytes, shardBytes.length);
assert.equal(manifest.shards["河北"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 1087);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 533);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 554);
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 477).rankEnd, 64897);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 459).rankEnd, 224230);
assert.deepEqual(newRanks.find((row) => row.subjectType === "历史类" && row.score === 672).scoreRange, { min: 672, max: 750 });
assert.deepEqual(newRanks.find((row) => row.subjectType === "物理类" && row.score === 693).scoreRange, { min: 693, max: 750 });

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 59020);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 47235);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 11785);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 27135);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 11258);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 20615);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 775);
assert.equal(linked.filter((row) => row.rankDerivedFromScore === true).length, 59020);
assert.equal(linked.filter((row) => row.rankEvidenceScope === "score-derived-provincial-segment").length, 59020);
assert.equal(linked.filter((row) => row.nativeAdmissionRankUnavailable === true).length, 59020);
assert.equal(linked.filter((row) => row.rankUnavailable === false && row.scoreOnly === false).length, 59020);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 2);
assert.ok(linked.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));
assert.ok(linked.every((row) => row.cautions.some((text) => text.includes("官方一分一档表按最低分换算"))));

const physics600 = linked.find((row) => row.sourceId === "official-hebei-undergraduate-filing-2025-physics" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 26288);
assert.equal(physics600.minRankEnd, 27073);
assert.equal(physics600.rankRangeText, "26288-27073（最低分换算）");

const history477 = linked.find((row) => row.sourceId === "official-hebei-undergraduate-filing-2025-history" && row.minScore === 477);
assert.ok(history477);
assert.equal(history477.minRankStart, 64258);
assert.equal(history477.minRankEnd, 64897);

const vocational200 = linked.find((row) => row.sourceId === "official-hebei-vocational-filing-2025-physics" && row.minScore === 200);
assert.ok(vocational200);
assert.equal(vocational200.minRankStart, 361426);
assert.equal(vocational200.minRankEnd, 361477);

const historyTop = linked.filter((row) => row.subjectType === "历史类" && row.minScore > 672);
assert.equal(historyTop.length, 2);
assert.ok(historyTop.every((row) => row.minRankStart === 1 && row.minRankEnd === 35));
assert.ok(historyTop.every((row) => row.cautions.some((text) => text.includes("合并档"))));

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 140
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 157);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(rankSource);
assert.equal(rankSource.parsedRecords, 1087);
assert.equal(rankSource.provenance.fullTableComparisons, 1087);
assert.equal(rankSource.provenance.officialPdfPages, 18);

assert.equal(core.admissionScoreLayer.rankCoverage.records, 120750);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 207);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 141);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 120750);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.equal(year2025.sources, 73);
assert.equal(year2025.parsedSources, 49);
assert.equal(year2025.parsedRecords, 17097);
assert.ok(year2025.parsedProvinces.includes("河北"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "河北");
  assert.equal(row.rankConversionRecords, 2181);
  assert.equal(row.officialRankRecords, 2181);
  assert.equal(row.officialEvidenceRecords, 57649);
  assert.equal(row.majorWithScoreDerivedRank, 27398);
  assert.equal(row.institutionWithScoreDerivedRank, 11258);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 1087);
assert.equal(runtimeManifest.after.linkedAdmissionRecords, 59020);
assert.equal(runtimeManifest.after.officialLinkedRecords, 47235);
assert.equal(runtimeManifest.after.thirdPartyLinkedRecords, 11785);
assert.equal(runtimeManifest.after.specialPathExcludedRecords, 157);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 2);
assert.equal(runtimeManifest.after.linkedSourceNotes, 119);
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, "89a139b659c28712d92cb3949d0d3f7576eade58e46122186791f93e04dd621b");
assert.notEqual(runtimeManifest.after.coreSha256, sha256(coreBytes));

console.log(JSON.stringify({ ok: true, modelVersion, ranks: newRanks.length, linkedAdmissionRecords: linked.length, specialPathExcluded: excludedSpecial.length, sourceNotes: core.admissionScoreLayer.sourceNotes.length }, null, 2));
