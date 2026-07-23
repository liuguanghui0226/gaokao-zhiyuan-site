#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.328-shanghai-official-rank2025-policy-bonus-inclusive-undergraduate-floor-aligned-868426records";
const sourceId = "official-nchu-national-2021-2025-school-major-admission";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2021-2025-v3306-nchu-runtime-manifest.json"), "utf8"));
const coverageAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/admission-score-coverage-v3306.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5132);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 129194);
assert.equal(Object.keys(manifest.shards).length, 31);
assert.equal(Object.values(manifest.shards).reduce((sum, item) => sum + item.records, 0), 868426);
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.equal(sourceNote.parsedRecords, 4860);
assert.equal(sourceNote.derivedRankRecords, 4804);
assert.equal(sourceNote.nativeAdmissionRankRecords, 0);
assert.equal(sourceNote.rankUnavailableRecords, 56);
assert.equal(sourceNote.provinceCount, 29);
assert.match(sourceNote.evidenceBoundary, /score-derived provincial segment rank/);
assert.match(sourceNote.evidenceBoundary, /not school-recorded lowest admitted rank/);

let total = 0;
let derived = 0;
let ordinary = 0;
let special = 0;
let rankUnavailable = 0;
let nativeRankClaims = 0;
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
  assert.equal(rows.length, runtimeManifest.after.shardStats[province].recordsAdded, `${province} NCHU count drifted`);
  total += rows.length;
  derived += rows.filter((record) => record.rankDerivedFromScore).length;
  ordinary += rows.filter((record) => record.formalScoreScope === "school-official-only").length;
  special += rows.filter((record) => record.formalScoreScope === "special-path-only").length;
  rankUnavailable += rows.filter((record) => record.rankUnavailable).length;
  nativeRankClaims += rows.filter((record) => record.minRankEnd && record.nativeAdmissionRankUnavailable !== true).length;
  if (province === "江西") jiangxiComputer = rows.find((record) => record.year === 2025 && record.majorName === "计算机科学与技术");
}

assert.equal(total, 4860);
assert.equal(derived, 4804);
assert.equal(ordinary, 3955);
assert.equal(special, 905);
assert.equal(rankUnavailable, 56);
assert.equal(nativeRankClaims, 0);
assert.equal(runtimeManifest.after.nativeAdmissionRankRecords, 0);
assert.equal(runtimeManifest.after.recordsAdded, 4860);
assert.equal(manifest.shards["西藏"].records, 28458);
assert.equal(manifest.shards["宁夏"].records, 9257);

assert.ok(jiangxiComputer);
assert.equal(jiangxiComputer.minScore, 562);
assert.equal(jiangxiComputer.averageScore, 565);
assert.equal(jiangxiComputer.maxScore, 573);
assert.equal(jiangxiComputer.admittedCount, 46);
assert.equal(jiangxiComputer.minRankEnd, 26975);
assert.equal(jiangxiComputer.rankEvidenceScope, "score-derived-provincial-segment");
assert.equal(jiangxiComputer.nativeAdmissionRankUnavailable, true);
assert.match(jiangxiComputer.rankDisclaimer, /不是学校录取最低位次/);

assert.equal(coverageAudit.totals.recordsWithScoreDerivedRank, 4804);
assert.equal(coverageAudit.totals.recordsWithNativeRank, 326336);
assert.equal(coverageAudit.totals.recordsWithAnyRank, 331140);
assert.equal(coverageAudit.totals.byDataType["major-admission"], 461054);

console.log(JSON.stringify({
  ok: true,
  modelVersion,
  records: total,
  derivedRankRecords: derived,
  nativeRankClaims,
  ordinary,
  special,
  rankUnavailable,
  sample: { minScore: jiangxiComputer.minScore, scoreDerivedRank: jiangxiComputer.minRankEnd, admittedCount: jiangxiComputer.admittedCount },
}, null, 2));
