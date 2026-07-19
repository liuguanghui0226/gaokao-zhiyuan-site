#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.321-shanxi-official-rank2025-bachelor-floor-aligned-868426records";
const sourceId = "official-wtu-national-2021-2025-school-major-admission";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2021-2025-v3308-wtu-runtime-manifest.json"), "utf8"));
const coverageAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/admission-score-coverage-v3308.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5125);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 124700);
assert.equal(Object.keys(manifest.shards).length, 31);
assert.equal(Object.values(manifest.shards).reduce((sum, item) => sum + item.records, 0), 868426);
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.equal(sourceNote.parsedRecords, 2222);
assert.equal(sourceNote.nativeAdmissionRankRecords, 1921);
assert.equal(sourceNote.derivedRankRecords, 0);
assert.equal(sourceNote.rankUnavailableRecords, 301);
assert.equal(sourceNote.ordinaryRecords, 1633);
assert.equal(sourceNote.specialPathRecords, 589);
assert.equal(sourceNote.provinceCount, 31);
assert.match(sourceNote.evidenceBoundary, /school-recorded min-score rank/);
assert.match(sourceNote.evidenceBoundary, /not province-wide closure/);

let total = 0;
let nativeRank = 0;
let derived = 0;
let ordinary = 0;
let special = 0;
let rankUnavailable = 0;
let wtuXizang = 0;
let jxustRows = 0;
let computer = null;
for (const [province, item] of Object.entries(manifest.shards)) {
  const file = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
  const bytes = zlib.gunzipSync(fs.readFileSync(file));
  assert.equal(bytes.length, item.bytes, `${province} byte count drifted`);
  assert.equal(sha256(bytes), item.sha256, `${province} hash drifted`);
  const shard = JSON.parse(bytes);
  assert.equal(shard.records.length, item.records, `${province} record count drifted`);
  assert.equal(shard.rankConversions.length, item.rankConversions, `${province} rank count drifted`);
  const rows = shard.records.filter((record) => record.sourceId === sourceId);
  assert.equal(rows.length, runtimeManifest.after.shardStats[province].recordsAdded, `${province} WTU count drifted`);
  total += rows.length;
  nativeRank += rows.filter((record) => record.minRankEnd && !record.rankDerivedFromScore).length;
  derived += rows.filter((record) => record.rankDerivedFromScore).length;
  ordinary += rows.filter((record) => record.formalScoreScope === "school-official-only").length;
  special += rows.filter((record) => record.formalScoreScope === "special-path-only").length;
  rankUnavailable += rows.filter((record) => record.rankUnavailable).length;
  jxustRows += shard.records.filter((record) => record.sourceId === "official-jxust-national-2023-2025-school-major-admission").length;
  if (province === "西藏") wtuXizang = rows.length;
  if (province === "江西") computer = rows.find((record) => record.id === "wtu-2025-1730b6dda0ef0ea3a4");
}

assert.equal(total, 2222);
assert.equal(nativeRank, 1921);
assert.equal(derived, 0);
assert.equal(ordinary, 1633);
assert.equal(special, 589);
assert.equal(rankUnavailable, 301);
assert.equal(wtuXizang, 17);
assert.equal(jxustRows, 2905);
assert.equal(runtimeManifest.after.nativeAdmissionRankRecords, 1921);
assert.equal(runtimeManifest.after.recordsAdded, 2222);
assert.equal(manifest.shards["西藏"].records, 28458);
assert.equal(manifest.shards["宁夏"].records, 9257);

assert.ok(computer);
assert.equal(computer.minScore, 554);
assert.equal(computer.averageScore, 560.1);
assert.equal(computer.maxScore, 572);
assert.equal(computer.minScoreDifference, 125);
assert.equal(computer.admittedCount, 7);
assert.equal(computer.minRankEnd, 32276);
assert.equal(computer.rankEvidenceScope, "school-recorded-min-score-rank");
assert.equal(computer.rankDerivedFromScore, false);
assert.equal(computer.nativeAdmissionRankUnavailable, false);
assert.equal(computer.electiveRequirement, "化学必选");
assert.equal(computer.sourcePlanTypeRaw, "普通类");

assert.equal(coverageAudit.totals.records, 783558);
assert.equal(coverageAudit.totals.recentRecords2023Plus, 679087);
assert.equal(coverageAudit.totals.recordsWithScoreDerivedRank, 4804);
assert.equal(coverageAudit.totals.recordsWithNativeRank, 330961);
assert.equal(coverageAudit.totals.recordsWithAnyRank, 335765);
assert.equal(coverageAudit.totals.byDataType["major-admission"], 466181);
assert.deepEqual(coverageAudit.lowestCoverageProvinces, ["西藏", "青海", "上海", "北京", "宁夏", "新疆", "天津", "海南", "吉林", "甘肃"]);

console.log(JSON.stringify({
  ok: true,
  modelVersion,
  records: total,
  nativeRankRecords: nativeRank,
  derivedRankRecords: derived,
  ordinary,
  special,
  rankUnavailable,
  xizangRecords: wtuXizang,
  sample: { minScore: computer.minScore, minRank: computer.minRankEnd, admittedCount: computer.admittedCount },
}, null, 2));
