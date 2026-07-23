#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.323-fujian-official-rank2025-published-floor-aligned-868426records";
const sourceId = "official-jxust-national-2023-2025-school-major-admission";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2023-2025-v3307-jxust-runtime-manifest.json"), "utf8"));
const coverageAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/admission-score-coverage-v3307.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5127);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 126945);
assert.equal(Object.keys(manifest.shards).length, 31);
assert.equal(Object.values(manifest.shards).reduce((sum, item) => sum + item.records, 0), 868426);
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.equal(sourceNote.parsedRecords, 2905);
assert.equal(sourceNote.nativeAdmissionRankRecords, 2704);
assert.equal(sourceNote.derivedRankRecords, 0);
assert.equal(sourceNote.rankUnavailableRecords, 201);
assert.equal(sourceNote.ordinaryRecords, 2596);
assert.equal(sourceNote.specialPathRecords, 309);
assert.equal(sourceNote.provinceCount, 31);
assert.match(sourceNote.evidenceBoundary, /school-recorded min-score rank/);
assert.match(sourceNote.evidenceBoundary, /not province-wide closure/);

let total = 0;
let nativeRank = 0;
let derived = 0;
let ordinary = 0;
let special = 0;
let rankUnavailable = 0;
let jxustXizang = 0;
let nchuRows = 0;
let jiangxiComputer = null;
for (const [province, item] of Object.entries(manifest.shards)) {
  const file = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
  const bytes = zlib.gunzipSync(fs.readFileSync(file));
  assert.equal(bytes.length, item.bytes, `${province} byte count drifted`);
  assert.equal(sha256(bytes), item.sha256, `${province} hash drifted`);
  const shard = JSON.parse(bytes);
  assert.equal(shard.records.length, item.records, `${province} record count drifted`);
  assert.equal(shard.rankConversions.length, item.rankConversions, `${province} rank count drifted`);
  const rows = shard.records.filter((record) => record.sourceId === sourceId);
  assert.equal(rows.length, runtimeManifest.after.shardStats[province].recordsAdded, `${province} JXUST count drifted`);
  total += rows.length;
  nativeRank += rows.filter((record) => record.minRankEnd && !record.rankDerivedFromScore).length;
  derived += rows.filter((record) => record.rankDerivedFromScore).length;
  ordinary += rows.filter((record) => record.formalScoreScope === "school-official-only").length;
  special += rows.filter((record) => record.formalScoreScope === "special-path-only").length;
  rankUnavailable += rows.filter((record) => record.rankUnavailable).length;
  nchuRows += shard.records.filter((record) => record.sourceId === "official-nchu-national-2021-2025-school-major-admission").length;
  if (province === "西藏") jxustXizang = rows.length;
  if (province === "江西") jiangxiComputer = rows.find((record) => record.id === "jxust-2025-5333");
}

assert.equal(total, 2905);
assert.equal(nativeRank, 2704);
assert.equal(derived, 0);
assert.equal(ordinary, 2596);
assert.equal(special, 309);
assert.equal(rankUnavailable, 201);
assert.equal(jxustXizang, 9);
assert.equal(nchuRows, 4860);
assert.equal(runtimeManifest.after.nativeAdmissionRankRecords, 2704);
assert.equal(runtimeManifest.after.recordsAdded, 2905);
assert.equal(manifest.shards["西藏"].records, 28458);
assert.equal(manifest.shards["宁夏"].records, 9257);

assert.ok(jiangxiComputer);
assert.equal(jiangxiComputer.minScore, 554);
assert.equal(jiangxiComputer.averageScore, 557.96);
assert.equal(jiangxiComputer.maxScore, 574);
assert.equal(jiangxiComputer.admittedCount, 73);
assert.equal(jiangxiComputer.minRankEnd, 32276);
assert.equal(jiangxiComputer.rankEvidenceScope, "school-recorded-min-score-rank");
assert.equal(jiangxiComputer.rankDerivedFromScore, false);
assert.equal(jiangxiComputer.nativeAdmissionRankUnavailable, false);
assert.equal(jiangxiComputer.collegeName, "信息工程学院");

assert.equal(coverageAudit.totals.records, 781336);
assert.equal(coverageAudit.totals.recordsWithScoreDerivedRank, 4804);
assert.equal(coverageAudit.totals.recordsWithNativeRank, 329040);
assert.equal(coverageAudit.totals.recordsWithAnyRank, 333844);
assert.equal(coverageAudit.totals.byDataType["major-admission"], 463959);
assert.ok(!coverageAudit.lowestCoverageProvinces.includes("江西"));

console.log(JSON.stringify({
  ok: true,
  modelVersion,
  records: total,
  nativeRankRecords: nativeRank,
  derivedRankRecords: derived,
  ordinary,
  special,
  rankUnavailable,
  xizangRecords: jxustXizang,
  sample: { minScore: jiangxiComputer.minScore, minRank: jiangxiComputer.minRankEnd, admittedCount: jiangxiComputer.admittedCount },
}, null, 2));
