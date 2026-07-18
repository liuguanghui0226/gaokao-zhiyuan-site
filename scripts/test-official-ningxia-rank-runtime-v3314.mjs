#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.314-ningxia-official-rank2025-aligned-868426records";
const sourceId = "official-ningxia-rank-2025-v3314";
const filingSourceId = "official-ningxia-undergraduate-b-2025";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const shardBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "ningxia.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-ningxia-rank-conversion-2025-v3314-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 117615);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5118);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 117615);
assert.equal(manifest.runtimeProfile.version, "v3.314");
assert.equal(manifest.shards["宁夏"].records, 9257);
assert.equal(manifest.shards["宁夏"].rankConversions, 1919);
assert.equal(manifest.shards["宁夏"].bytes, shardBytes.length);
assert.equal(manifest.shards["宁夏"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 959);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 467);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 492);
assert.equal(newRanks.find((row) => row.subjectType === "历史类" && row.score === 404).rankEnd, 9485);
assert.equal(newRanks.find((row) => row.subjectType === "物理类" && row.score === 372).rankEnd, 30025);
assert.deepEqual(newRanks.find((row) => row.subjectType === "历史类" && row.score === 616).scoreRange, { min: 616, max: 750 });
assert.deepEqual(newRanks.find((row) => row.subjectType === "物理类" && row.score === 641).scoreRange, { min: 641, max: 750 });

const filingRows = shard.records.filter((row) => row.sourceId === filingSourceId);
assert.equal(filingRows.length, 2491);
assert.equal(filingRows.filter((row) => row.formalScoreScope === "ordinary").length, 2153);
assert.equal(filingRows.filter((row) => row.formalScoreScope !== "ordinary").length, 338);
assert.equal(filingRows.filter((row) => row.rankSourceId === sourceId).length, 2491);
assert.equal(filingRows.filter((row) => row.rankDerivedFromScore === true).length, 2491);
assert.equal(filingRows.filter((row) => row.rankEvidenceScope === "score-derived-provincial-segment").length, 2491);
assert.equal(filingRows.filter((row) => row.nativeAdmissionRankUnavailable === true).length, 2491);
assert.equal(filingRows.filter((row) => row.rankUnavailable === false && row.scoreOnly === false).length, 2491);
assert.equal(filingRows.filter((row) => row.minRankStart === 1).length, 18);
assert.ok(filingRows.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));
assert.ok(filingRows.every((row) => row.rankDisclaimer.includes("不是院校原表直接公布")));

const historyTop = filingRows.find((row) => row.schoolName === "北京大学" && row.subjectType === "历史类" && row.minScore === 637);
assert.ok(historyTop);
assert.equal(historyTop.minRankStart, 1);
assert.equal(historyTop.minRankEnd, 54);
assert.equal(historyTop.rankRangeText, "1-54（最低分换算）");
assert.ok(historyTop.cautions.some((text) => text.includes("最高分合并档")));

const physicsTop = filingRows.find((row) => row.schoolName === "北京大学" && row.subjectType === "物理类" && row.minScore === 662);
assert.ok(physicsTop);
assert.equal(physicsTop.minRankStart, 1);
assert.equal(physicsTop.minRankEnd, 104);
assert.equal(physicsTop.rankRangeText, "1-104（最低分换算）");

const history404 = filingRows.find((row) => row.schoolName === "黑龙江大学" && row.subjectType === "历史类" && row.minScore === 404);
assert.ok(history404);
assert.equal(history404.minRankStart, 9365);
assert.equal(history404.minRankEnd, 9485);

const special372 = filingRows.find((row) => row.schoolName === "福州大学" && row.subjectType === "物理类" && row.minScore === 372);
assert.ok(special372);
assert.equal(special372.formalScoreScope, "special-path-only");
assert.equal(special372.admissionSubtype, "国家专项计划");
assert.equal(special372.minRankStart, 29829);
assert.equal(special372.minRankEnd, 30025);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const filingSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === filingSourceId);
assert.ok(rankSource);
assert.equal(rankSource.parsedRecords, 959);
assert.equal(rankSource.provenance.mirrorVerification, "two-independent-domains-byte-identical-per-subject");
assert.equal(filingSource.scoreDerivedRankRecords, 2491);
assert.equal(filingSource.nativeRankPublishedRecords, 0);
assert.equal(filingSource.rankSourceId, sourceId);

assert.equal(core.admissionScoreLayer.rankCoverage.records, 117615);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 204);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 138);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 117615);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.equal(year2025.sources, 70);
assert.equal(year2025.parsedSources, 46);
assert.equal(year2025.parsedRecords, 13962);
assert.ok(year2025.parsedProvinces.includes("宁夏"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "宁夏");
  assert.equal(row.rankConversionRecords, 1919);
  assert.equal(row.officialRankRecords, 1919);
  assert.equal(row.officialEvidenceRecords, 10461);
  assert.equal(row.institutionWithScoreDerivedRank, 2491);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 959);
assert.equal(runtimeManifest.after.linkedFilingRecords, 2491);
assert.equal(runtimeManifest.after.ordinaryLinkedRecords, 2153);
assert.equal(runtimeManifest.after.specialPathLinkedRecords, 338);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 18);
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, sha256(coreBytes));

console.log(JSON.stringify({ ok: true, modelVersion, ranks: newRanks.length, linkedFilingRecords: filingRows.length, sourceNotes: core.admissionScoreLayer.sourceNotes.length }, null, 2));
