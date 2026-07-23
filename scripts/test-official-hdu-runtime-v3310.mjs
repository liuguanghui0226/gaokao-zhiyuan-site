#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.326-xinjiang-rank2025-score-basis-conflict-blocked-868426records";
const sourceId = "official-hdu-national-2014-2025-school-major-admission";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const coreBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "knowledge-core.json.gz")));
const manifestBytes = zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "manifest.json.gz")));
const core = JSON.parse(coreBytes);
const manifest = JSON.parse(manifestBytes);
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2014-2025-v3310-hdu-runtime-manifest.json"), "utf8"));
const coverageAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/admission-score-coverage-v3310.json"), "utf8"));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5130);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 128591);
assert.equal(Object.keys(manifest.shards).length, 31);
assert.equal(Object.values(manifest.shards).reduce((sum, item) => sum + item.records, 0), 868426);
assert.equal(manifest.core.bytes, coreBytes.length);
assert.equal(manifest.core.sha256, sha256(coreBytes));

const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.ok(sourceNote);
assert.equal(sourceNote.parsedRecords, 7463);
assert.equal(sourceNote.admittedCountRecords, 7463);
assert.equal(sourceNote.nativeAdmissionRankRecords, 0);
assert.equal(sourceNote.derivedRankRecords, 222);
assert.equal(sourceNote.rankUnavailableRecords, 7241);
assert.equal(sourceNote.hebei2025ScoreDerivedRankRecords, 28);
assert.equal(sourceNote.chongqing2025ScoreDerivedRankRecords, 23);
assert.equal(sourceNote.liaoning2025ScoreDerivedRankRecords, 26);
assert.equal(sourceNote.hunan2025ScoreDerivedRankRecords, 22);
assert.equal(sourceNote.jiangsu2025ScoreDerivedRankRecords, 17);
assert.equal(sourceNote.guangxi2025ScoreDerivedRankRecords, 18);
assert.equal(sourceNote.shanxi2025ScoreDerivedRankRecords, 19);
assert.equal(sourceNote.hubei2025ScoreDerivedRankRecords, 22);
assert.equal(sourceNote.fujian2025ScoreDerivedRankRecords, 24);
assert.equal(sourceNote.heilongjiang2025ScoreDerivedRankRecords, 15);
assert.equal(sourceNote.hainan2025ScoreDerivedRankRecords, 8);
assert.match(sourceNote.rankAlignmentBoundary, /河北2025年28条、重庆2025年23条、辽宁2025年26条、湖南2025年22条、江苏2025年17条、广西2025年18条、山西2025年19条、湖北2025年22条、福建2025年24条、黑龙江2025年15条、海南2025年8条/);
assert.match(sourceNote.rankAlignmentBoundary, /广西严格按目标院校区内\/区外选用对应加分表/);
assert.match(sourceNote.rankAlignmentBoundary, /黑龙江使用不含照顾政策分且公开至130分的文化课表/);
assert.match(sourceNote.rankAlignmentBoundary, /海南使用含照顾加分且公开至246分的全体考生综合投档分表/);
assert.equal(sourceNote.ordinaryRecords, 6059);
assert.equal(sourceNote.specialPathRecords, 1404);
assert.equal(sourceNote.provinceCount, 31);
assert.match(sourceNote.evidenceBoundary, /rank and elective requirement unavailable/);
assert.match(sourceNote.evidenceBoundary, /not province-wide closure/);

let total = 0;
let admittedCountRows = 0;
let ordinary = 0;
let special = 0;
let rankUnavailable = 0;
let derived = 0;
let nativeRank = 0;
let qluRows = 0;
let jiangxiComputer = null;
let zhejiangEarly = null;
for (const [province, item] of Object.entries(manifest.shards)) {
  const file = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
  const bytes = zlib.gunzipSync(fs.readFileSync(file));
  assert.equal(bytes.length, item.bytes, `${province} byte count drifted`);
  assert.equal(sha256(bytes), item.sha256, `${province} hash drifted`);
  const shard = JSON.parse(bytes);
  assert.equal(shard.records.length, item.records, `${province} record count drifted`);
  assert.equal(shard.rankConversions.length, item.rankConversions, `${province} rank count drifted`);
  const rows = shard.records.filter((record) => record.sourceId === sourceId);
  assert.equal(rows.length, runtimeManifest.after.shardStats[province].recordsAdded, `${province} HDU count drifted`);
  assert.ok(rows.length > 0, `${province} missing HDU rows`);
  total += rows.length;
  admittedCountRows += rows.filter((record) => record.admittedCount > 0).length;
  ordinary += rows.filter((record) => record.formalScoreScope === "school-official-only").length;
  special += rows.filter((record) => record.formalScoreScope === "special-path-only").length;
  rankUnavailable += rows.filter((record) => record.rankUnavailable).length;
  derived += rows.filter((record) => record.rankDerivedFromScore).length;
  nativeRank += rows.filter((record) => record.minRankEnd && !record.rankDerivedFromScore).length;
  qluRows += shard.records.filter((record) => record.sourceId === "official-qlu-national-2021-2025-school-major-admission").length;
  if (province === "江西") jiangxiComputer = rows.find((record) => record.id === "hdu-2025-09dd552ef21fc9fc31");
  if (province === "浙江") zhejiangEarly = rows.find((record) => record.id === "hdu-2025-99f7483d108727b198");
}

assert.equal(total, 7463);
assert.equal(admittedCountRows, 7463);
assert.equal(ordinary, 6059);
assert.equal(special, 1404);
assert.equal(rankUnavailable, 7241);
assert.equal(derived, 222);
assert.equal(nativeRank, 0);
assert.equal(qluRows, 2157);
assert.equal(runtimeManifest.after.recordsAdded, 7463);
assert.equal(runtimeManifest.after.admittedCountRecords, 7463);

assert.ok(jiangxiComputer);
assert.equal(jiangxiComputer.majorName, "计算机科学与技术");
assert.equal(jiangxiComputer.admittedCount, 3);
assert.equal(jiangxiComputer.minScore, 605);
assert.equal(jiangxiComputer.averageScore, 605.67);
assert.equal(jiangxiComputer.maxScore, 606);
assert.equal(jiangxiComputer.rankUnavailable, true);
assert.equal(jiangxiComputer.rankEvidenceScope, "rank-unavailable");
assert.equal(jiangxiComputer.formalScoreScope, "school-official-only");
assert.ok(zhejiangEarly);
assert.equal(zhejiangEarly.sourceBatchRaw, "普通类提前");
assert.equal(zhejiangEarly.formalScoreScope, "special-path-only");

assert.equal(coverageAudit.dataset, "admission-score-coverage-v3310");
assert.equal(coverageAudit.totals.records, 793178);
assert.equal(coverageAudit.totals.recentRecords2023Plus, 682439);
assert.equal(coverageAudit.totals.recordsWithScoreDerivedRank, 4804);
assert.equal(coverageAudit.totals.recordsWithNativeRank, 333035);
assert.equal(coverageAudit.totals.recordsWithAnyRank, 337839);
assert.equal(coverageAudit.totals.byDataType["major-admission"], 475801);
assert.equal(coverageAudit.totals.byEvidenceLayer["school-official-ordinary"], 163627);
assert.equal(coverageAudit.totals.byEvidenceLayer["special-path-isolated"], 48176);
assert.deepEqual(coverageAudit.lowestCoverageProvinces, ["西藏", "青海", "上海", "北京", "宁夏", "新疆", "天津", "海南", "吉林", "甘肃"]);

console.log(JSON.stringify({
  ok: true,
  modelVersion,
  records: total,
  admittedCountRecords: admittedCountRows,
  ordinary,
  special,
  rankUnavailable,
  provinces: sourceNote.provinceCount,
  sample: { province: jiangxiComputer.province, major: jiangxiComputer.majorName, minScore: jiangxiComputer.minScore, admittedCount: jiangxiComputer.admittedCount },
}, null, 2));
