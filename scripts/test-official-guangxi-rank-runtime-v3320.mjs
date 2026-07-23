#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.327-tianjin-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const sourceId = "official-guangxi-rank-2025-v3320";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const readGzip = (file) => zlib.gunzipSync(fs.readFileSync(file));
const coreBytes = readGzip(path.join(releaseDir, "knowledge-core.json.gz"));
const manifestBytes = readGzip(path.join(releaseDir, "manifest.json.gz"));
const shardBytes = readGzip(path.join(releaseDir, "guangxi.json.gz"));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const shard = JSON.parse(shardBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guangxi-rank-conversion-2025-v3320-runtime-manifest.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128972);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5131);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 128972);
assert.equal(manifest.runtimeProfile.version, "v3.327");
assert.equal(manifest.shards["广西"].records, 20452);
assert.equal(manifest.shards["广西"].rankConversions, 2908);
assert.equal(manifest.shards["广西"].bytes, shardBytes.length);
assert.equal(manifest.shards["广西"].sha256, sha256(shardBytes));
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const newRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
assert.equal(newRanks.length, 1896);
assert.equal(newRanks.filter((row) => row.subjectType === "历史类").length, 920);
assert.equal(newRanks.filter((row) => row.subjectType === "物理类").length, 976);
assert.equal(newRanks.filter((row) => row.rankInstitutionScope === "outside-guangxi").length, 948);
assert.equal(newRanks.filter((row) => row.rankInstitutionScope === "inside-guangxi").length, 948);
assert.equal(newRanks.filter((row) => row.topWithheldRange).length, 4);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 8222);
assert.equal(linked.filter((row) => row.rankInstitutionScope === "outside-guangxi").length, 7018);
assert.equal(linked.filter((row) => row.rankInstitutionScope === "inside-guangxi").length, 1204);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 7554);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 668);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 2826);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 5396);
assert.equal(linked.filter((row) => row.formalScoreScope === "school-official-only").length, 633);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 1);
assert.deepEqual(Object.fromEntries(Object.entries(runtimeManifest.after.linkedByType).sort()), {
  "institution-admission": 135,
  "major-admission": 1148,
  "major-group-admission": 5062,
  "school-admission-summary": 6,
  "vocational-admission": 1871,
});
assert.ok(linked.every((row) => row.scoreBonusScope === (row.rankInstitutionScope === "inside-guangxi" ? "national-or-local-max" : "national-bonus-only")));
assert.ok(linked.every((row) => Number(row.minRankStart) > 0 && Number(row.minRankEnd) >= Number(row.minRankStart)));

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.quality, "official-source-attributed-guangxi-admissions-rank-images-xlsx-html-cross-verified-moe-school-scope");
assert.equal(rankSource.url, "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390995.html");
assert.equal(rankSource.parsedRecords, 1896);
assert.equal(rankSource.publishedRows, 1892);
assert.equal(rankSource.provenance.xlsxHtmlRowComparisons, 1892);
assert.equal(rankSource.provenance.xlsxHtmlCellComparisons, 7568);
assert.equal(rankSource.provenance.xlsxHtmlDifferences, 0);
assert.deepEqual(rankSource.schoolScopeEvidence, {
  nationalInstitutions: 2919,
  guangxiInstitutions: 89,
  undergraduate: 41,
  vocational: 48,
});

assert.equal(core.admissionScoreLayer.rankCoverage.records, 128972);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.sources, 216);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 150);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.queuedSources, 66);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 128972);
const year2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.deepEqual([year2025.sources, year2025.parsedSources, year2025.queuedSources, year2025.parsedRecords], [82, 58, 24, 25319]);
assert.ok(year2025.parsedProvinces.includes("广西"));

for (const readiness of [core.admissionScoreLayer.provinceReadiness, core.admissionScoreLayer.coverage.provinceReadiness]) {
  const row = readiness.rows.find((item) => item.province === "广西");
  assert.equal(row.rankConversionRecords, 2908);
  assert.equal(row.officialRankRecords, 2908);
  assert.equal(row.officialEvidenceRecords, 18989);
  assert.equal(row.majorWithRank, 4204);
  assert.equal(row.majorWithScoreDerivedRank, 1313);
  assert.equal(row.institutionWithRank, 303);
  assert.equal(row.institutionWithScoreDerivedRank, 135);
}

assert.equal(runtimeManifest.after.rankConversionsAdded, 1896);
assert.equal(runtimeManifest.after.linkedAdmissionRecords, 8222);
assert.equal(runtimeManifest.after.officialLinkedRecords, 7554);
assert.equal(runtimeManifest.after.thirdPartyLinkedRecords, 668);
assert.equal(runtimeManifest.after.schoolOfficialScopeLinkedRecords, 633);
assert.equal(runtimeManifest.after.specialPathExcludedRecords, 110);
assert.equal(runtimeManifest.after.topBucketLinkedRecords, 1);
assert.equal(runtimeManifest.after.linkedSourceNotes, 105);
assert.deepEqual(runtimeManifest.after.linkedByInstitutionScope, { "inside-guangxi": 1204, "outside-guangxi": 7018 });
assert.equal(runtimeManifest.after.shardSha256, sha256(shardBytes));
assert.equal(runtimeManifest.after.coreSha256, "ebdf58bb6b3eb05cdfa73178e3adba85a7b9376e5e84406468a77c8ba5eb1150");
assert.notEqual(runtimeManifest.after.coreSha256, sha256(coreBytes));

console.log(JSON.stringify({ ok: true, modelVersion, ranks: 1896, linkedAdmissionRecords: 8222, linkedByScope: runtimeManifest.after.linkedByInstitutionScope, sourceNotes: 5131 }, null, 2));
