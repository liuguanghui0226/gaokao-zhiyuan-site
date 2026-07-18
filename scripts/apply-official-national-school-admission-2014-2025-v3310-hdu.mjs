#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.309-national-school-official-qlu2021-2025-native-rank-859382records";
const NEXT_VERSION = "local-deterministic-v3.310-national-school-official-hdu2014-2025-admitted-count-866845records";
const SOURCE_ID = "official-hdu-national-2014-2025-school-major-admission";
const EXPECTED_ADDED_RECORDS = 7463;
const EXPECTED_ORDINARY_RECORDS = 6059;
const EXPECTED_SPECIAL_RECORDS = 1404;
const EXPECTED_BASE_RECORDS = 859382;
const EXPECTED_NEXT_RECORDS = 866845;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-national-school-admission-2014-2025-v3310-hdu-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-national-school-admission-2014-2025-v3310-hdu-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--import") args.importFile = argv[++index];
    else if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--runtime-manifest") args.runtimeManifest = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined && item !== "" && (!Array.isArray(item) || item.length));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, compact(item)])
      .filter(([, item]) => item !== undefined && item !== null && item !== "" && (!Array.isArray(item) || item.length)));
  }
  return value;
}

function increment(map, key, amount) {
  map[key] = Number(map[key] || 0) + amount;
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(uncompressedBytes) {
  return zlib.gzipSync(uncompressedBytes, { level: 9, mtime: 0 });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function addLowBands(target, records) {
  for (const record of records) {
    if (record.formalScoreScope === "special-path-only") continue;
    const score = Number(record.minScore);
    if (!Number.isFinite(score)) continue;
    if (score < 200) target.below200 = Number(target.below200 || 0) + 1;
    if (score < 250) target.below250 = Number(target.below250 || 0) + 1;
    if (score < 300) target.below300 = Number(target.below300 || 0) + 1;
    if (score < 500) target.below500 = Number(target.below500 || 0) + 1;
  }
}

function mergeScoreRange(target, records) {
  const values = records.map((record) => Number(record.minScore)).filter(Number.isFinite);
  if (!values.length) return target;
  return {
    min: Math.min(Number(target?.min ?? Infinity), ...values),
    max: Math.max(Number(target?.max ?? -Infinity), ...values),
  };
}

function updateProvinceCoverage(row, records) {
  row.records = Number(row.records || 0) + records.length;
  row.years = sortedUnique([...(row.years || []), ...records.map((record) => Number(record.year))]).sort((a, b) => b - a);
  row.subjects = sortedUnique([...(row.subjects || []), ...records.map((record) => record.subjectType)]);
  for (const record of records) increment(row.dataTypes, record.dataType, 1);
  row.scoreRange = mergeScoreRange(row.scoreRange, records);
  addLowBands(row.lowBands, records);
}

function updateReadiness(container, province, allShardRecords, addedRecords, rankConversions) {
  const row = container?.rows?.find((item) => item.province === province);
  if (!row) return;
  row.records = allShardRecords.length;
  row.schools = sortedUnique(allShardRecords.map((record) => record.schoolName)).length;
  row.years = sortedUnique(allShardRecords.map((record) => Number(record.year))).sort((a, b) => b - a);
  row.subjects = sortedUnique(allShardRecords.map((record) => record.subjectType));
  row.dataTypes = {};
  for (const record of allShardRecords) increment(row.dataTypes, record.dataType, 1);
  row.majorRecords = Number(row.dataTypes["major-admission"] || 0);
  row.majorWithRank = allShardRecords.filter((record) => record.dataType === "major-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.majorWithScoreDerivedRank = allShardRecords.filter((record) => record.dataType === "major-admission" && record.rankDerivedFromScore === true).length;
  row.institutionRecords = Number(row.dataTypes["institution-admission"] || 0);
  row.vocationalRecords = Number(row.dataTypes["vocational-admission"] || 0);
  row.officialRecords = allShardRecords.filter((record) => /^official/.test(String(record.sourceQuality || ""))).length;
  row.officialEvidenceRecords = Number(row.officialRecords || 0) + Number(row.officialRankRecords || 0);
  row.rankConversionRecords = rankConversions.length;
  row.schoolOfficialRecords = Number(row.schoolOfficialRecords || 0) + addedRecords.filter((record) => record.formalScoreScope === "school-official-only").length;
}

function verifyImport(payload) {
  assert(payload.dataset === "official-national-school-admission-2014-2025-v3310-hdu", `Unexpected import dataset ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_ADDED_RECORDS, `Expected ${EXPECTED_ADDED_RECORDS} records`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "HDU source note mismatch");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_ADDED_RECORDS, "HDU import contains duplicate ids");
  assert(payload.records.every((record) => record.sourceId === SOURCE_ID && record.schoolName === "杭州电子科技大学" && record.dataType === "major-admission"), "HDU import contains out-of-scope rows");
  assert(payload.audit.skippedRows.length === 0 && payload.audit.sourceRows === EXPECTED_ADDED_RECORDS, "HDU source row reconciliation drifted");
  assert(payload.records.every((record) => record.admittedCount > 0), "HDU admitted-count coverage drifted");
  assert(payload.records.every((record) => record.rankUnavailable === true && record.rankDerivedFromScore === false && !record.minRankEnd), "HDU rank-unavailable semantics drifted");
  assert(payload.records.filter((record) => record.formalScoreScope === "school-official-only").length === EXPECTED_ORDINARY_RECORDS, "HDU ordinary count drifted");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === EXPECTED_SPECIAL_RECORDS, "HDU special-path count drifted");
  assert(payload.sourceNotes[0].provinceCount === 31, "HDU province coverage drifted");
}

function alreadyApplied(core, manifest, releaseDir) {
  assert(core.modelVersion === NEXT_VERSION, `Unexpected already-applied core version ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION && manifest.recordCount === EXPECTED_NEXT_RECORDS, "Already-applied manifest drifted");
  let count = 0;
  for (const [province, item] of Object.entries(manifest.shards)) {
    const shard = readGzipJson(path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`));
    const rows = shard.records.filter((record) => record.sourceId === SOURCE_ID);
    assert(rows.every((record) => record.province === province), `HDU province drift in ${province}`);
    count += rows.length;
  }
  assert(count === EXPECTED_ADDED_RECORDS, `Already-applied HDU row count drifted: ${count}`);
  assert(core.admissionScoreLayer.sourceNotes.filter((note) => note.id === SOURCE_ID).length === 1, "Already-applied source note drifted");
  return count;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing direct mac_2T processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  verifyImport(payload);

  if (core.modelVersion === NEXT_VERSION) {
    const count = alreadyApplied(core, manifest, releaseDir);
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, records: count }, null, 2));
    return;
  }
  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === EXPECTED_BASE_RECORDS, `Unexpected base record count ${manifest.recordCount}`);
  assert(core.admissionScoreLayer.structuredRecords === EXPECTED_BASE_RECORDS, "Core structured record count drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const byProvince = new Map();
  for (const record of payload.records.map(compact)) {
    if (!byProvince.has(record.province)) byProvince.set(record.province, []);
    byProvince.get(record.province).push(record);
  }
  assert(byProvince.size === 31, "HDU official province coverage drifted");
  const tempDir = path.join(releaseDir, `.v3310-${process.pid}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const shardBuffers = new Map();
  const shardStats = {};
  const beforeProvinceCounts = {};
  const afterProvinceCounts = {};

  for (const [province, item] of Object.entries(manifest.shards)) {
    const slug = path.basename(item.file, ".json");
    const shardFile = path.join(releaseDir, `${slug}.json.gz`);
    const shard = readGzipJson(shardFile);
    const additions = byProvince.get(province) || [];
    assert(additions.length > 0, `Missing HDU records for ${province}`);
    assert(shard.records.length === item.records, `${province} shard count drifted before merge`);
    assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${province} already contains HDU rows`);
    beforeProvinceCounts[province] = shard.records.length;
    shard.records.push(...additions);
    shard.generatedAt = payload.generatedAt;
    afterProvinceCounts[province] = shard.records.length;
    const bytes = encodeJson(shard);
    shardBuffers.set(province, { file: shardFile, temp: path.join(tempDir, `${slug}.json.gz`), bytes, gzip: gzipBytes(bytes), shard, additions });
    shardStats[province] = {
      recordsAdded: additions.length,
      recordsAfter: shard.records.length,
      admittedCountRecordsAdded: additions.filter((record) => record.admittedCount > 0).length,
      ordinaryRecordsAdded: additions.filter((record) => record.formalScoreScope === "school-official-only").length,
      specialPathRecordsAdded: additions.filter((record) => record.formalScoreScope === "special-path-only").length,
      rankUnavailableRecordsAdded: additions.filter((record) => record.rankUnavailable).length,
    };
  }

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  const existingSchoolNames = new Set(coverage.schools || []);
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = EXPECTED_NEXT_RECORDS;
  layer.structuredRecords = EXPECTED_NEXT_RECORDS;
  layer.statusLabel = `已接入${EXPECTED_NEXT_RECORDS}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "新增杭州电子科技大学2014-2025年31省7463条官方分专业首轮投档录取记录，全部直接保留官网招生数、最低分、平均分和最高分。373份官方原始响应覆盖372个省份/年份查询，7463条源行零跳过、零重复；6059条普通school-official-only与1404条艺体、专项、三位一体、中外合作、提前批、内高班等special-path-only继续隔离。官网未公布最低录取位次和专业选科要求，7463条全部保持rankUnavailable且不生成假位次。";
  layer.sourceNotes.push({ ...payload.sourceNotes[0], file: args.importFile });
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 仍对计划层、控制线、学校官网单校分数、分数换算位次和 special-path-only 做风险隔离；学校单校证据不替代省级考试院全量投档/录取表。`;

  coverage.files = Number(coverage.files || 0) + payload.sourceNotes[0].rawFiles.length;
  coverage.rawRecords = EXPECTED_NEXT_RECORDS;
  coverage.records = EXPECTED_NEXT_RECORDS;
  increment(coverage.dataTypes, "major-admission", EXPECTED_ADDED_RECORDS);
  coverage.schools = sortedUnique([...(coverage.schools || []), "杭州电子科技大学"]);
  coverage.cities = sortedUnique([...(coverage.cities || []), "杭州"]);
  coverage.schoolTags = sortedUnique([...(coverage.schoolTags || []), "公办", "理工", "浙江省属"]);
  coverage.scoreRange = mergeScoreRange(coverage.scoreRange, payload.records);
  addLowBands(coverage.lowBands, payload.records);

  for (const [province, records] of byProvince) {
    const provinceRow = coverage.provinceBreakdown.find((row) => row.province === province);
    assert(provinceRow, `Missing province breakdown for ${province}`);
    updateProvinceCoverage(provinceRow, records);
    const runtime = shardBuffers.get(province);
    updateReadiness(layer.provinceReadiness, province, runtime.shard.records, records, runtime.shard.rankConversions);
    updateReadiness(coverage.provinceReadiness, province, runtime.shard.records, records, runtime.shard.rankConversions);
  }
  for (const [yearText, count] of Object.entries(payload.audit.yearCounts)) {
    const year = Number(yearText);
    const row = coverage.yearBreakdown.find((item) => Number(item.year) === year);
    assert(row, `Missing year breakdown for ${year}`);
    row.records = Number(row.records || 0) + count;
    increment(row.dataTypes, "major-admission", count);
    if (!existingSchoolNames.has("杭州电子科技大学")) row.schools = Number(row.schools || 0) + 1;
  }

  const coreBytes = encodeJson(core);
  const coreTemp = path.join(tempDir, "knowledge-core.json.gz");
  fs.writeFileSync(coreTemp, gzipBytes(coreBytes));
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = EXPECTED_NEXT_RECORDS;
  for (const [province, runtime] of shardBuffers) {
    manifest.shards[province].records = runtime.shard.records.length;
    manifest.shards[province].bytes = runtime.bytes.byteLength;
    manifest.shards[province].sha256 = sha256(runtime.bytes);
    fs.writeFileSync(runtime.temp, runtime.gzip);
  }
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  const manifestTemp = path.join(tempDir, "manifest.json.gz");
  fs.writeFileSync(manifestTemp, gzipBytes(manifestBytes));

  for (const runtime of shardBuffers.values()) fs.renameSync(runtime.temp, runtime.file);
  fs.renameSync(coreTemp, coreFile);
  fs.renameSync(manifestTemp, manifestFile);
  fs.rmdirSync(tempDir);

  const runtimeManifest = {
    dataset: "official-national-school-admission-2014-2025-v3310-hdu-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, recordCount: EXPECTED_BASE_RECORDS, provinceRecords: beforeProvinceCounts },
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: EXPECTED_NEXT_RECORDS,
      recordsAdded: EXPECTED_ADDED_RECORDS,
      admittedCountRecords: EXPECTED_ADDED_RECORDS,
      ordinaryRecords: EXPECTED_ORDINARY_RECORDS,
      specialPathRecords: EXPECTED_SPECIAL_RECORDS,
      scoreDerivedRankRecords: 0,
      nativeAdmissionRankRecords: 0,
      rankUnavailableRecords: EXPECTED_ADDED_RECORDS,
      provinceCount: byProvince.size,
      provinceRecords: afterProvinceCounts,
      shardStats,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
    cautions: payload.notes,
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({
    status: "applied", modelVersion: NEXT_VERSION, recordCount: EXPECTED_NEXT_RECORDS,
    recordsAdded: EXPECTED_ADDED_RECORDS, admittedCountRecords: EXPECTED_ADDED_RECORDS,
    ordinaryRecords: EXPECTED_ORDINARY_RECORDS, specialPathRecords: EXPECTED_SPECIAL_RECORDS,
    scoreDerivedRankRecords: 0, nativeAdmissionRankRecords: 0, rankUnavailableRecords: EXPECTED_ADDED_RECORDS,
    provinceCount: byProvince.size, coreSha256: runtimeManifest.after.coreSha256, manifestSha256: runtimeManifest.after.manifestSha256,
  }, null, 2));
}

main();
