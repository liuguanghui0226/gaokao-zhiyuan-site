#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.311-xinjiang-official-2025-undergraduate1-score-only-867350records";
const NEXT_VERSION = "local-deterministic-v3.312-xinjiang-official-2025-undergraduate2-score-only-868426records";
const SOURCE_ID = "official-xinjiang-undergraduate2-filing-2025-v3312";
const PROVINCE = "新疆";
const YEAR = 2025;
const EXPECTED_ADDED_RECORDS = 1076;
const EXPECTED_BASE_RECORDS = 867350;
const EXPECTED_NEXT_RECORDS = 868426;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-xinjiang-undergraduate2-filing-2025-v3312-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-xinjiang-undergraduate2-filing-2025-v3312-runtime-manifest.json",
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

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(value) {
  return zlib.gzipSync(value, { level: 9, mtime: 0 });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compact(value) {
  if (Array.isArray(value)) {
    return value.map(compact).filter((item) => item !== undefined && item !== "" && (!Array.isArray(item) || item.length));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, compact(item)])
      .filter(([, item]) => item !== undefined && item !== null && item !== "" && (!Array.isArray(item) || item.length)));
  }
  return value;
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
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

function mergeScoreRange(target, records) {
  const scores = records.map((record) => Number(record.minScore)).filter(Number.isFinite);
  return scores.length ? {
    min: Math.min(Number(target?.min ?? Infinity), ...scores),
    max: Math.max(Number(target?.max ?? -Infinity), ...scores),
  } : target;
}

function refreshReadiness(container, shard) {
  const row = container?.rows?.find((item) => item.province === PROVINCE);
  if (!row) return;
  row.records = shard.records.length;
  row.schools = sortedUnique(shard.records.map((record) => record.schoolName)).length;
  row.years = sortedUnique(shard.records.map((record) => Number(record.year))).sort((a, b) => b - a);
  row.subjects = sortedUnique(shard.records.map((record) => record.subjectType));
  row.dataTypes = {};
  for (const record of shard.records) increment(row.dataTypes, record.dataType, 1);
  const planRecords = shard.records.filter((record) => record.dataType === "admission-plan");
  row.planRecords = planRecords.length;
  row.planCount = planRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0);
  row.majorRecords = Number(row.dataTypes["major-admission"] || 0);
  row.majorWithRank = shard.records.filter((record) => record.dataType === "major-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.majorWithScoreDerivedRank = shard.records.filter((record) => record.dataType === "major-admission" && record.rankDerivedFromScore === true).length;
  row.institutionRecords = Number(row.dataTypes["institution-admission"] || 0);
  row.vocationalRecords = Number(row.dataTypes["vocational-admission"] || 0);
  row.officialRecords = shard.records.filter((record) => /^official/.test(String(record.sourceQuality || ""))).length;
  row.officialEvidenceRecords = Number(row.officialRecords || 0) + Number(row.officialRankRecords || 0);
  row.rankConversionRecords = shard.rankConversions.length;
}

function verifyImport(payload) {
  assert(payload.dataset === "official-xinjiang-undergraduate2-filing-2025-v3312-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Xinjiang source note mismatch");
  assert(payload.records?.length === EXPECTED_ADDED_RECORDS, `Expected ${EXPECTED_ADDED_RECORDS} records`);
  assert(payload.audit?.rowCandidates === EXPECTED_ADDED_RECORDS && payload.audit?.parsedRecords === EXPECTED_ADDED_RECORDS, "Xinjiang row reconciliation drifted");
  assert(payload.audit?.skippedRows?.length === 0 && payload.audit?.duplicateIds === 0, "Xinjiang import contains skipped or duplicate rows");
  assert(payload.audit?.recordsWithPlanCount === EXPECTED_ADDED_RECORDS && payload.audit?.recordsWithFilingCount === EXPECTED_ADDED_RECORDS, "Xinjiang count coverage drifted");
  assert(payload.audit?.recordsWithTieBreak === 1060, "Xinjiang tie-break coverage drifted");
  assert(payload.audit?.filingScoreRecords === 1060 && payload.audit?.noFilingPlanRecords === 16, "Xinjiang score/plan split drifted");
  assert(payload.records.filter((record) => record.subjectType === "历史类").length === 472, "Xinjiang history count drifted");
  assert(payload.records.filter((record) => record.subjectType === "物理类").length === 604, "Xinjiang physics count drifted");
  assert(payload.records.every((record) => record.sourceId === SOURCE_ID && record.province === PROVINCE && record.year === YEAR && record.batch === "本科二批"), "Xinjiang import contains out-of-scope rows");
  assert(payload.records.filter((record) => record.dataType === "institution-admission" && record.scoreOnly === true).length === 1060, "Xinjiang filing-score row boundary drifted");
  assert(payload.records.filter((record) => record.dataType === "admission-plan" && record.noFiling === true && record.scoreOnly === false).length === 16, "Xinjiang no-filing plan boundary drifted");
  assert(payload.records.every((record) => record.rankUnavailable === true && record.nativeAdmissionRankUnavailable === true && record.rankDerivedFromScore === false && !record.minRankStart && !record.minRankEnd), "Xinjiang rank boundary drifted");
}

function alreadyApplied(core, manifest, releaseDir, runtimeManifestFile) {
  assert(core.modelVersion === NEXT_VERSION, `Unexpected already-applied core ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION && manifest.recordCount === EXPECTED_NEXT_RECORDS, "Already-applied manifest drifted");
  const item = manifest.shards[PROVINCE];
  const shard = readGzipJson(path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`));
  const rows = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  assert(rows.length === EXPECTED_ADDED_RECORDS, `Already-applied Xinjiang row count drifted: ${rows.length}`);
  assert(core.admissionScoreLayer.sourceNotes.filter((note) => note.id === SOURCE_ID).length === 1, "Already-applied source note drifted");
  refreshReadiness(core.admissionScoreLayer.provinceReadiness, shard);
  refreshReadiness(core.admissionScoreLayer.coverage.provinceReadiness, shard);
  const coreBytes = encodeJson(core);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  fs.writeFileSync(path.join(releaseDir, "knowledge-core.json.gz"), gzipBytes(coreBytes));
  fs.writeFileSync(path.join(releaseDir, "manifest.json.gz"), gzipBytes(manifestBytes));
  if (fs.existsSync(runtimeManifestFile)) {
    const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestFile, "utf8"));
    runtimeManifest.after.coreBytes = coreBytes.byteLength;
    runtimeManifest.after.coreSha256 = sha256(coreBytes);
    runtimeManifest.after.manifestBytes = manifestBytes.byteLength;
    runtimeManifest.after.manifestSha256 = sha256(manifestBytes);
    writeJson(runtimeManifestFile, runtimeManifest);
  }
  return {
    records: rows.length,
    coreSha256: sha256(coreBytes),
    manifestSha256: sha256(manifestBytes),
  };
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
    const result = alreadyApplied(core, manifest, releaseDir, runtimeManifestFile);
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, ...result }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === EXPECTED_BASE_RECORDS, "Base manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === EXPECTED_BASE_RECORDS, "Base core record count drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Xinjiang runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === item.records, "Xinjiang shard count drifted before merge");
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), "Xinjiang shard already contains v3.312 rows");
  const beforeProvinceRecords = shard.records.length;
  const additions = payload.records.map(compact);
  shard.records.push(...additions);
  shard.generatedAt = payload.generatedAt;
  assert(shard.records.length === beforeProvinceRecords + EXPECTED_ADDED_RECORDS, "Xinjiang shard count drifted after merge");
  assert(shard.records.filter((record) => record.sourceId === SOURCE_ID).length === EXPECTED_ADDED_RECORDS, "Xinjiang source rows drifted after merge");

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = EXPECTED_NEXT_RECORDS;
  layer.structuredRecords = EXPECTED_NEXT_RECORDS;
  layer.statusLabel = `已接入${EXPECTED_NEXT_RECORDS}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "新增新疆教育考试院2025年普通类本科二批1076条官方记录，覆盖历史类472条、物理类604条。7张官网原图1076行全部对账，其中1060条形成院校投档线，16条官方显示投档人数为0，仅保留计划事实且不生成假分数；原表均未公布最低位次，全部保持位次不可用。该批次为省级普通招生正式投档边界，不与单列类、专项、定向或其他特殊路径混用。";
  layer.sourceNotes.push({ ...payload.sourceNotes[0], file: args.importFile });
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 仍严格区分省级院校投档线、专业录取线、计划层、控制线、分数换算位次和特殊路径；新疆2025本科二批官方未给位次时不输出伪精确位次概率，投档人数为0时不生成假分数。`;

  coverage.files = Number(coverage.files || 0) + payload.sourceNotes[0].rawFiles.length;
  coverage.rawRecords = EXPECTED_NEXT_RECORDS;
  coverage.records = EXPECTED_NEXT_RECORDS;
  increment(coverage.dataTypes, "institution-admission", 1060);
  increment(coverage.dataTypes, "admission-plan", 16);
  coverage.schools = sortedUnique([...(coverage.schools || []), ...additions.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...(coverage.schoolTags || []), ...additions.flatMap((record) => record.schoolTags || [])]);
  coverage.scoreRange = mergeScoreRange(coverage.scoreRange, additions);
  addLowBands(coverage.lowBands, additions);

  const provinceRow = coverage.provinceBreakdown.find((row) => row.province === PROVINCE);
  assert(provinceRow, "Xinjiang province breakdown is missing");
  provinceRow.records = Number(provinceRow.records || 0) + EXPECTED_ADDED_RECORDS;
  provinceRow.years = sortedUnique([...(provinceRow.years || []), YEAR]).sort((a, b) => b - a);
  provinceRow.subjects = sortedUnique([...(provinceRow.subjects || []), ...additions.map((record) => record.subjectType)]);
  increment(provinceRow.dataTypes, "institution-admission", 1060);
  increment(provinceRow.dataTypes, "admission-plan", 16);
  provinceRow.scoreRange = mergeScoreRange(provinceRow.scoreRange, additions);
  addLowBands(provinceRow.lowBands, additions);
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(coverage.provinceReadiness, shard);

  const yearRow = coverage.yearBreakdown.find((row) => Number(row.year) === YEAR);
  assert(yearRow, "2025 year breakdown is missing");
  yearRow.records = Number(yearRow.records || 0) + EXPECTED_ADDED_RECORDS;
  increment(yearRow.dataTypes, "institution-admission", 1060);
  increment(yearRow.dataTypes, "admission-plan", 16);
  const yearSchools = new Set();
  for (const [province, shardItem] of Object.entries(manifest.shards)) {
    const provinceShard = province === PROVINCE
      ? shard
      : readGzipJson(path.join(releaseDir, `${path.basename(shardItem.file, ".json")}.json.gz`));
    for (const record of provinceShard.records) {
      if (Number(record.year) === YEAR && record.schoolName) yearSchools.add(record.schoolName);
    }
  }
  yearRow.schools = yearSchools.size;

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = EXPECTED_NEXT_RECORDS;
  item.records = shard.records.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3312-${process.pid}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const shardTemp = path.join(tempDir, `${slug}.json.gz`);
  const coreTemp = path.join(tempDir, "knowledge-core.json.gz");
  const manifestTemp = path.join(tempDir, "manifest.json.gz");
  fs.writeFileSync(shardTemp, gzipBytes(shardBytes));
  fs.writeFileSync(coreTemp, gzipBytes(coreBytes));
  fs.writeFileSync(manifestTemp, gzipBytes(manifestBytes));
  fs.renameSync(shardTemp, shardFile);
  fs.renameSync(coreTemp, coreFile);
  fs.renameSync(manifestTemp, manifestFile);
  fs.rmdirSync(tempDir);

  const runtimeManifest = {
    dataset: "official-xinjiang-undergraduate2-filing-2025-v3312-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, recordCount: EXPECTED_BASE_RECORDS, provinceRecords: beforeProvinceRecords },
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: EXPECTED_NEXT_RECORDS,
      recordsAdded: EXPECTED_ADDED_RECORDS,
      provinceRecords: shard.records.length,
      historyRecords: additions.filter((record) => record.subjectType === "历史类").length,
      physicsRecords: additions.filter((record) => record.subjectType === "物理类").length,
      scoreOnlyRecords: additions.filter((record) => record.scoreOnly).length,
      noFilingPlanRecords: additions.filter((record) => record.noFiling).length,
      rankUnavailableRecords: additions.filter((record) => record.rankUnavailable).length,
      planCountRecords: additions.filter((record) => Number.isFinite(record.planCount)).length,
      filingCountRecords: additions.filter((record) => Number.isFinite(record.filingCount)).length,
      tieBreakRecords: additions.filter((record) => record.tieBreakScores).length,
      shardBytes: shardBytes.byteLength,
      shardSha256: sha256(shardBytes),
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
    cautions: payload.notes,
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({
    status: "applied",
    modelVersion: NEXT_VERSION,
    recordCount: EXPECTED_NEXT_RECORDS,
    recordsAdded: EXPECTED_ADDED_RECORDS,
    provinceRecords: shard.records.length,
    historyRecords: runtimeManifest.after.historyRecords,
    physicsRecords: runtimeManifest.after.physicsRecords,
    rankUnavailableRecords: runtimeManifest.after.rankUnavailableRecords,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
    manifestSha256: runtimeManifest.after.manifestSha256,
  }, null, 2));
}

main();
