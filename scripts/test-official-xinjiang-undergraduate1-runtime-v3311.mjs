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
const sourceId = "official-xinjiang-undergraduate1-filing-2025-v3311";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-xinjiang-undergraduate1-filing-2025-v3311-runtime-manifest.json"), "utf8"));
const coverageAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/admission-score-coverage-v3311.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 117615);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5118);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 117615);
assert.equal(Object.keys(manifest.shards).length, 31);
assert.equal(Object.values(manifest.shards).reduce((sum, item) => sum + item.records, 0), 868426);
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const source = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(source);
assert.equal(source.parsedRecords, 505);
assert.equal(source.imageCount, 3);
assert.equal(source.rawFiles.length, 21);
assert.equal(source.rankUnavailableRecords, 505);
assert.equal(source.scoreDerivedRankRecords, 0);
assert.match(source.evidenceBoundary, /no major result, minimum rank/);

let totalRecords = 0;
let sourceRows = 0;
let sourceOutsideXinjiang = 0;
let rankUnavailable = 0;
let derivedRank = 0;
let sample = null;
for (const [province, item] of Object.entries(manifest.shards)) {
  const file = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
  const bytes = zlib.gunzipSync(fs.readFileSync(file));
  assert.equal(bytes.length, item.bytes, `${province} byte count drifted`);
  assert.equal(sha256(bytes), item.sha256, `${province} hash drifted`);
  const shard = JSON.parse(bytes);
  assert.equal(shard.records.length, item.records, `${province} record count drifted`);
  assert.equal(shard.rankConversions.length, item.rankConversions, `${province} rank count drifted`);
  totalRecords += shard.records.length;
  const rows = shard.records.filter((record) => record.sourceId === sourceId);
  sourceRows += rows.length;
  if (province !== "新疆") sourceOutsideXinjiang += rows.length;
  rankUnavailable += rows.filter((record) => record.rankUnavailable).length;
  derivedRank += rows.filter((record) => record.rankDerivedFromScore).length;
  if (province === "新疆") {
    assert.equal(rows.length, 505);
    sample = rows.find((record) => record.imageId === "29623" && record.schoolCode === "3666");
  }
}

assert.equal(totalRecords, 868426);
assert.equal(sourceRows, 505);
assert.equal(sourceOutsideXinjiang, 0);
assert.equal(rankUnavailable, 505);
assert.equal(derivedRank, 0);
assert.equal(manifest.shards["新疆"].records, 11518);
assert.equal(runtimeManifest.after.recordsAdded, 505);
assert.equal(runtimeManifest.after.provinceRecords, 10442);
assert.equal(runtimeManifest.after.historyRecords, 200);
assert.equal(runtimeManifest.after.physicsRecords, 305);
assert.equal(runtimeManifest.after.planCountRecords, 505);
assert.equal(runtimeManifest.after.filingCountRecords, 505);
assert.equal(runtimeManifest.after.tieBreakRecords, 505);
assert.equal(runtimeManifest.after.rankUnavailableRecords, 505);

assert.ok(sample);
assert.equal(sample.schoolName, "北京大学医学部");
assert.equal(sample.minScore, 673);
assert.equal(sample.maxScore, 676);
assert.equal(sample.rankUnavailable, true);
assert.equal(sample.rankEvidenceScope, "rank-unavailable");
assert.equal(sample.minRankEnd, undefined);

const provinceCoverage = core.admissionScoreLayer.coverage.provinceBreakdown.find((row) => row.province === "新疆");
const readiness = core.admissionScoreLayer.provinceReadiness.rows.find((row) => row.province === "新疆");
const year2025 = core.admissionScoreLayer.coverage.yearBreakdown.find((row) => row.year === 2025);
assert.equal(provinceCoverage.records, 11518);
assert.equal(provinceCoverage.dataTypes["institution-admission"], 3096);
assert.equal(readiness.records, 11518);
assert.equal(readiness.institutionRecords, 3096);
assert.equal(readiness.rankConversionRecords, 2823);
assert.equal(year2025.records, 398834);
assert.equal(year2025.dataTypes["institution-admission"], 23167);

assert.equal(coverageAudit.dataset, "admission-score-coverage-v3311");
assert.equal(coverageAudit.totals.records, 793683);
assert.equal(coverageAudit.totals.recentRecords2023Plus, 682944);
assert.equal(coverageAudit.totals.recordsWithScoreDerivedRank, 4804);
assert.equal(coverageAudit.totals.recordsWithNativeRank, 333035);
assert.equal(coverageAudit.totals.recordsWithAnyRank, 337839);
assert.equal(coverageAudit.totals.byDataType["institution-admission"], 55366);
assert.equal(coverageAudit.totals.byEvidenceLayer["province-or-other-official"], 479702);
assert.deepEqual(coverageAudit.lowestCoverageProvinces, ["西藏", "青海", "上海", "北京", "宁夏", "天津", "新疆", "海南", "吉林", "甘肃"]);

console.log(JSON.stringify({
  ok: true,
  modelVersion,
  totalRecords,
  sourceRows,
  provinceRecords: manifest.shards["新疆"].records,
  rankUnavailable,
  sample: { school: sample.schoolName, minScore: sample.minScore, maxScore: sample.maxScore },
}, null, 2));
