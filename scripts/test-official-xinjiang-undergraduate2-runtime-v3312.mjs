#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.322-hubei-official-rank2025-full-cohort-aligned-868426records";
const sourceId = "official-xinjiang-undergraduate2-filing-2025-v3312";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-xinjiang-undergraduate2-filing-2025-v3312-runtime-manifest.json"), "utf8"));
const coverageAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/admission-score-coverage-v3312.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 126013);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5126);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 126013);
assert.equal(Object.keys(manifest.shards).length, 31);
assert.equal(Object.values(manifest.shards).reduce((sum, item) => sum + item.records, 0), 868426);
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const source = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(source);
assert.equal(source.parsedRecords, 1076);
assert.equal(source.imageCount, 7);
assert.equal(source.rawFiles.length, 249);
assert.equal(source.rankUnavailableRecords, 1076);
assert.equal(source.scoreDerivedRankRecords, 0);
assert.equal(source.filingScoreRecords, 1060);
assert.equal(source.noFilingPlanRecords, 16);
assert.match(source.evidenceBoundary, /no major result, minimum rank/);

let totalRecords = 0;
let sourceRows = 0;
let sourceOutsideXinjiang = 0;
let rankUnavailable = 0;
let derivedRank = 0;
let scoreRows = 0;
let noFilingRows = 0;
let scoreSample = null;
let noFilingSample = null;
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
  scoreRows += rows.filter((record) => record.dataType === "institution-admission" && record.scoreOnly).length;
  noFilingRows += rows.filter((record) => record.dataType === "admission-plan" && record.noFiling).length;
  if (province === "新疆") {
    assert.equal(rows.length, 1076);
    scoreSample = rows.find((record) => record.imageId === "29679" && record.schoolCode === "1708");
    noFilingSample = rows.find((record) => record.imageId === "29672" && record.schoolCode === "1940");
  }
}

assert.equal(totalRecords, 868426);
assert.equal(sourceRows, 1076);
assert.equal(sourceOutsideXinjiang, 0);
assert.equal(rankUnavailable, 1076);
assert.equal(derivedRank, 0);
assert.equal(scoreRows, 1060);
assert.equal(noFilingRows, 16);
assert.equal(manifest.shards["新疆"].records, 11518);
assert.equal(runtimeManifest.after.recordsAdded, 1076);
assert.equal(runtimeManifest.after.provinceRecords, 11518);
assert.equal(runtimeManifest.after.historyRecords, 472);
assert.equal(runtimeManifest.after.physicsRecords, 604);
assert.equal(runtimeManifest.after.scoreOnlyRecords, 1060);
assert.equal(runtimeManifest.after.noFilingPlanRecords, 16);
assert.equal(runtimeManifest.after.planCountRecords, 1076);
assert.equal(runtimeManifest.after.filingCountRecords, 1076);
assert.equal(runtimeManifest.after.tieBreakRecords, 1060);
assert.equal(runtimeManifest.after.rankUnavailableRecords, 1076);
assert.equal(runtimeManifest.after.coreSha256, "801c3b5e8ad8406e67dc308e829d2f94cc8496066a7d5bdff15ea7caa6fbe782");
assert.equal(runtimeManifest.after.manifestSha256, "8ad987b18cd4f83abcde2e2497cfa11e6b446275a0214b2332382ea15874d529");
assert.equal(manifest.runtimeProfile?.version, "v3.322", "Current runtime manifest must declare the later verified extension");

assert.ok(scoreSample);
assert.equal(scoreSample.schoolName, "塔里木理工学院");
assert.equal(scoreSample.minScore, 368);
assert.equal(scoreSample.maxScore, 426);
assert.equal(scoreSample.rankUnavailable, true);
assert.equal(scoreSample.minRankEnd, undefined);

assert.ok(noFilingSample);
assert.equal(noFilingSample.schoolName, "广东培正学院");
assert.equal(noFilingSample.planCount, 10);
assert.equal(noFilingSample.filingCount, 0);
assert.equal(noFilingSample.minScore, undefined);
assert.equal(noFilingSample.maxScore, undefined);
assert.equal(noFilingSample.tieBreakScores, undefined);

const provinceCoverage = core.admissionScoreLayer.coverage.provinceBreakdown.find((row) => row.province === "新疆");
const readiness = core.admissionScoreLayer.provinceReadiness.rows.find((row) => row.province === "新疆");
const year2025 = core.admissionScoreLayer.coverage.yearBreakdown.find((row) => row.year === 2025);
assert.equal(provinceCoverage.records, 11518);
assert.equal(provinceCoverage.dataTypes["institution-admission"], 3096);
assert.equal(provinceCoverage.dataTypes["admission-plan"], 81);
assert.equal(readiness.records, 11518);
assert.equal(readiness.institutionRecords, 3096);
assert.equal(readiness.planRecords, 81);
assert.equal(readiness.planCount, 214);
assert.equal(readiness.rankConversionRecords, 2823);
assert.equal(year2025.records, 398834);
assert.equal(year2025.dataTypes["institution-admission"], 23167);
assert.equal(year2025.dataTypes["admission-plan"], 31589);

assert.equal(coverageAudit.dataset, "admission-score-coverage-v3312");
assert.equal(coverageAudit.totals.records, 794743);
assert.equal(coverageAudit.totals.recentRecords2023Plus, 684004);
assert.equal(coverageAudit.totals.recordsWithScoreDerivedRank, 4804);
assert.equal(coverageAudit.totals.recordsWithNativeRank, 333035);
assert.equal(coverageAudit.totals.recordsWithAnyRank, 337839);
assert.equal(coverageAudit.totals.byDataType["institution-admission"], 56426);
assert.equal(coverageAudit.totals.byEvidenceLayer["province-or-other-official"], 480762);
assert.deepEqual(coverageAudit.lowestCoverageProvinces, ["西藏", "青海", "上海", "北京", "宁夏", "天津", "海南", "吉林", "新疆", "甘肃"]);

console.log(JSON.stringify({
  ok: true,
  modelVersion,
  totalRecords,
  sourceRows,
  scoreRows,
  noFilingRows,
  provinceRecords: manifest.shards["新疆"].records,
  sample: { school: scoreSample.schoolName, minScore: scoreSample.minScore, maxScore: scoreSample.maxScore },
}, null, 2));
