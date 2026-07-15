#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.281-xizang-control-provenance-and-low-score-safety-846462records";
const NEXT_VERSION = "local-deterministic-v3.282-zhejiang-control-lines2026-and-segment-routing-846519records";
const SOURCE_ID = "official-zhejiang-control-lines-2026";
const EXPECTED_RECORDS = 57;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-zhejiang-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-zhejiang-control-lines-2026-v3282-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--import") args.importFile = argv[++index];
    else if (item === "--release") args.releaseDir = argv[++index];
    else if (item === "--runtime-manifest") args.runtimeManifest = argv[++index];
  }
  return args;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function increment(map, key, amount) {
  map[key] = Number(map[key] || 0) + amount;
}

function addLowBands(target, records) {
  for (const record of records) {
    const score = Number(record.minScore);
    if (!Number.isFinite(score)) continue;
    if (score < 200) target.below200 = Number(target.below200 || 0) + 1;
    if (score < 250) target.below250 = Number(target.below250 || 0) + 1;
    if (score < 300) target.below300 = Number(target.below300 || 0) + 1;
    if (score < 500) target.below500 = Number(target.below500 || 0) + 1;
  }
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function countBy(records, field) {
  const counts = {};
  for (const record of records) increment(counts, record[field] || "unknown", 1);
  return counts;
}

function refreshZhejiangReadiness(container, records, rankConversions) {
  const row = container?.rows?.find((item) => item.province === "浙江");
  assert(row, "Zhejiang province-readiness row is missing");
  row.records = records.length;
  row.schools = sortedUnique(records.map((record) => record.schoolName)).length;
  row.years = sortedUnique(records.map((record) => Number(record.year))).sort((left, right) => right - left);
  row.subjects = sortedUnique(records.map((record) => record.subjectType));
  row.dataTypes = countBy(records, "dataType");
  row.officialRecords = records.filter((record) => /official/.test(String(record.sourceQuality || ""))).length;
  row.rankConversionRecords = rankConversions.length;
  row.officialEvidenceRecords = row.officialRecords + Number(row.officialRankRecords || 0);
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function atomicWriteGzip(file, uncompressedBytes) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, zlib.gzipSync(uncompressedBytes, { level: 9, mtime: 0 }));
  fs.renameSync(temporary, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected already-applied model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift after prior apply");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} prior Zhejiang records, got ${sourceRecords.length}`);
  assert(manifest.recordCount === 846519, "Manifest record count drift after prior apply");
  return sourceRecords;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const zhejiangFile = path.join(releaseDir, "zhejiang.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(zhejiangFile);

  assert(payload.dataset === "official-zhejiang-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Import source note is missing or mismatched");
  assert(payload.records.every((record) => record.province === "浙江" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.controlLineRouteKind === "segment").length === 2, "Expected two ordinary segment records");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 2, "Only ordinary segment records may enter ordinary control scope");

  if (core.modelVersion === NEXT_VERSION) {
    const sourceRecords = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: sourceRecords.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 846462, `Refusing unexpected base record count ${manifest.recordCount}`);
  assert(manifest.shards?.["浙江"]?.records === 110889, `Refusing unexpected Zhejiang base count ${manifest.shards?.["浙江"]?.records}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} is already present on the base model`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists on the base model`);

  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    zhejiangRecords: shard.records.length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    zhejiangSha256: sha256(zlib.gunzipSync(fs.readFileSync(zhejiangFile))),
  };
  const records = payload.records.map(compact);
  shard.records.push(...records);
  shard.generatedAt = payload.generatedAt;

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  const newCount = Number(layer.structuredRecords) + records.length;
  assert(newCount === 846519, `Unexpected merged record count ${newCount}`);
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = newCount;
  layer.structuredRecords = newCount;
  layer.statusLabel = `已接入${newCount}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "浙江2026官方普通类第一段494分、第二段266分已与同年一分一段表联动；两者按考生分段建模，不冒充本科/专科线。艺体和单独考试招生55条继续隔离。";
  layer.sourceNotes.push(payload.sourceNotes[0]);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "浙江");
  assert(provinceBreakdown, "Zhejiang province coverage row is missing");
  provinceBreakdown.records += records.length;
  provinceBreakdown.years = sortedUnique([...provinceBreakdown.years, ...records.map((record) => Number(record.year))]).sort((left, right) => right - left);
  provinceBreakdown.subjects = sortedUnique([...provinceBreakdown.subjects, ...records.map((record) => record.subjectType)]);
  increment(provinceBreakdown.dataTypes, "control-line", records.length);
  addLowBands(provinceBreakdown.lowBands, records);

  const yearBreakdown = coverage.yearBreakdown.find((row) => Number(row.year) === 2026);
  assert(yearBreakdown, "2026 year coverage row is missing");
  const newSchoolNames = sortedUnique(records.map((record) => record.schoolName));
  const newGlobalSchoolNames = newSchoolNames.filter((name) => !existingSchoolNames.has(name));
  yearBreakdown.records += records.length;
  increment(yearBreakdown.dataTypes, "control-line", records.length);
  yearBreakdown.schools += newGlobalSchoolNames.length;

  refreshZhejiangReadiness(layer.provinceReadiness, shard.records, shard.rankConversions);
  refreshZhejiangReadiness(coverage.provinceReadiness, shard.records, shard.rankConversions);

  const shardBytes = encodeJson(shard);
  atomicWriteGzip(zhejiangFile, shardBytes);
  const coreBytes = encodeJson(core);
  atomicWriteGzip(coreFile, coreBytes);

  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = newCount;
  manifest.shards["浙江"].records = shard.records.length;
  manifest.shards["浙江"].bytes = shardBytes.byteLength;
  manifest.shards["浙江"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-zhejiang-control-lines-2026-v3282-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      zhejiangRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      zhejiangBytes: shardBytes.byteLength,
      zhejiangSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
