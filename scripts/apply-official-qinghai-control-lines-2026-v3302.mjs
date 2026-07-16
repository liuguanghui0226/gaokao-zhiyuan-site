#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.301-ningxia-control-lines2026-dual-thresholds-and-rank-provenance-847133records";
const NEXT_VERSION = "local-deterministic-v3.302-qinghai-control-lines2026-language-thresholds-and-rank-provenance-847152records";
const SOURCE_ID = "official-qinghai-control-lines-2026";
const RANK_SOURCE_ID = "official-qinghai-rank-2026";
const RANK_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847238.html";
const RANK_PDF_URL = "https://t2.chei.com.cn/news/getfile/2293847239-2293847238-8f4911ad66a2a5465806d4e60d7dd2d9.pdf";
const EXPECTED_RECORDS = 19;
const EXPECTED_RANK_ROWS = 957;
const EXPECTED_SHARD_RANK_ROWS = 2432;
const EXPECTED_NEW_RECORD_COUNT = 847152;
const EXPECTED_NEW_SHARD_RECORDS = 5025;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-qinghai-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-qinghai-control-lines-2026-v3302-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--import") args.importFile = argv[++index];
    else if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--runtime-manifest") args.runtimeManifest = argv[++index];
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

function refreshReadiness(container, records, rankConversions) {
  const row = container?.rows?.find((item) => item.province === "青海");
  assert(row, "Qinghai province-readiness row is missing");
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

function rankRows(shard) {
  return shard.rankConversions.filter((record) => record.year === 2026 && record.sourceId === RANK_SOURCE_ID);
}

function rankAt(rows, subjectType, score) {
  return rows.find((record) => record.subjectType === subjectType && record.score === score);
}

function topScore(subjectType) {
  return subjectType === "历史类" ? 625 : subjectType === "物理类" ? 676 : null;
}

function patchRankSourceNote(core, sourceEvidence, sourceRankRows) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Qinghai rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Qinghai parsed rank rows: ${note.parsedRecords}`);
  assert(note.url === RANK_URL, `Unexpected Qinghai rank page URL: ${note.url}`);
  assert(note.quality === "official-qinghai-rank-conversion-pdf", `Qinghai rank quality drifted: ${note.quality}`);
  assert(note.attachmentUrls?.some((url) => url.includes("2293847239-2293847238-8f4911ad66a2a5465806d4e60d7dd2d9.pdf")), "Qinghai ordinary rank PDF identity drifted");
  assert(note.subjects?.find((row) => row.subjectType === "历史类")?.records === 468, "Qinghai history rank inventory drifted");
  assert(note.subjects?.find((row) => row.subjectType === "物理类")?.records === 489, "Qinghai physics rank inventory drifted");
  assert(note.omittedScoreGaps === 46, "Qinghai zero-person score-gap event count drifted");

  const crossCheck = sourceEvidence.rankEvidence.controlBoundaryCrossCheck;
  for (const [subject, checkpoints] of Object.entries(crossCheck)) {
    const subjectType = subject === "history" ? "历史类" : "物理类";
    for (const key of ["vocational", "bachelor", "special"]) {
      const score = checkpoints[`${key}Score`];
      const rankEnd = checkpoints[`${key}RankEnd`];
      const row = rankAt(sourceRankRows, subjectType, score);
      if (rankEnd === null) assert(!row, `Qinghai ${subjectType}/${score} must remain an official zero-person score`);
      else assert(row?.rankEnd === rankEnd, `Qinghai ${subjectType}/${score} rank cross-check drifted`);
    }
  }

  note.attachmentUrls = sortedUnique([...(note.attachmentUrls || []), RANK_PDF_URL]);
  note.relatedUrls = sortedUnique([...(note.relatedUrls || []), sourceEvidence.url, ...(sourceEvidence.relatedUrls || [])]);
  note.controlBoundaryCrossCheck = {
    url: sourceEvidence.url,
    evidenceQuality: sourceEvidence.quality,
    verifiedAt: "2026-07-17",
    ...crossCheck,
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-17",
    finding: "重新下载阳光高考转载的青海普通类22页一分一段PDF并提取全表，957条分数、同分人数、累计人数和名次区间与运行层逐行零差异。保留46个零人数缺口事件、336个省略分数；两科150分均为官方零人数分数，不生成位次。修复历史≥625、物理≥676两个顶端区间到750分，位次数值零改动。",
    rankRowsLinked: EXPECTED_RANK_ROWS,
    rowsFullCrossChecked: EXPECTED_RANK_ROWS,
    rowsContinuityChecked: EXPECTED_RANK_ROWS,
    checkpointCount: 10,
    officialZeroPersonGapEventsRetained: 46,
    officialZeroPersonScoresRetained: 336,
    topBucketRangeRepairs: 2,
    valueChanges: 0,
    directOfficialMirrorRedownloadStatus: "success",
    verificationScope: "CHSI-hosted official 22-page ordinary PDF redownloaded and full 957-row extraction cross-checked against runtime; two top-bucket score ranges repaired; rank values unchanged",
    officialFile: { url: RANK_PDF_URL, rows: 957, pages: 22, sha256: sourceEvidence.evidence.rankPdf.sha256 },
  };
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const sourceRankRows = rankRows(shard);
  const rankNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift");
  assert(manifest.recordCount === EXPECTED_NEW_RECORD_COUNT, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Qinghai control records`);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Qinghai rank rows`);
  assert(sourceRankRows.every((record) => record.sourceUrl === RANK_PDF_URL), "Qinghai rank source URL repair drifted");
  assert(sourceRankRows.filter((record) => record.scoreRange?.max === 750).length === 2, "Qinghai top-bucket range repair drifted");
  assert(rankNote?.provenanceRevision?.rowsFullCrossChecked === EXPECTED_RANK_ROWS, "Qinghai rank provenance drifted");
  return { sourceRecords, sourceRankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "qinghai.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);
  const sourceEvidence = payload.sourceNotes?.[0];

  assert(payload.dataset === "official-qinghai-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && sourceEvidence.id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "青海" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary Qinghai records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 15, "Expected 15 Qinghai special-path records");
  assert(payload.records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 5, "Expected five Qinghai numeric language thresholds");
  assert(payload.records.filter((record) => record.professionalQualification).length === 8, "Expected eight Qinghai sports/art qualification rows");
  assert(payload.records.every((record) => record.scoreMaximum === 750), "Qinghai control records must retain the 750-point score scale");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.sourceRankRows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 847133, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["青海"]?.records === 5006, `Unexpected Qinghai base count ${manifest.shards?.["青海"]?.records}`);
  assert(manifest.shards?.["青海"]?.rankConversions === EXPECTED_SHARD_RANK_ROWS, "Unexpected Qinghai rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_SHARD_RANK_ROWS, `Unexpected Qinghai rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const sourceRankRows = rankRows(shard);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Qinghai rank rows`);
  assert(sourceRankRows.every((record) => !record.sourceUrl), "Expected all Qinghai rank rows to need URL repair");
  assert(sourceRankRows.every((record) => !record.scoreRange), "Expected Qinghai top-bucket range repair to be unapplied");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = sourceRankRows.map((record) => [record.id, record.score, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    qinghaiRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: sourceRankRows.filter((record) => !record.sourceUrl).length,
    topBucketRangesMissing: sourceRankRows.filter((record) => record.score === topScore(record.subjectType) && !record.scoreRange).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    qinghaiSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  let topBucketRangeRepairs = 0;
  for (const record of sourceRankRows) {
    record.sourceUrl = RANK_PDF_URL;
    if (record.score === topScore(record.subjectType)) {
      record.scoreRange = { min: record.score, max: 750 };
      topBucketRangeRepairs += 1;
    }
  }
  assert(topBucketRangeRepairs === 2, `Expected two Qinghai top-bucket repairs, got ${topBucketRangeRepairs}`);
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(sourceRankRows.map((record) => [record.id, record.score, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality])), "Qinghai rank values changed during provenance repair");
  shard.generatedAt = payload.generatedAt;
  patchRankSourceNote(core, sourceEvidence, sourceRankRows);

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  const newCount = Number(layer.structuredRecords) + records.length;
  assert(newCount === EXPECTED_NEW_RECORD_COUNT, `Unexpected merged record count ${newCount}`);
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = newCount;
  layer.structuredRecords = newCount;
  layer.statusLabel = `已接入${newCount}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "青海2026普通历史本科/专科376/150分、物理本科/专科344/150分进入普通资格路由；特殊类型、民族语言、体育和艺术15条保持特殊路径。民族语言5条文化与科目40分双门槛分列，艺体8条不补造专业分。957条普通类位次与重新下载的22页PDF逐行零差异并补URL；历史≥625、物理≥676两个顶端区间修复到750分。";
  layer.sourceNotes.push(sourceEvidence);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "青海");
  assert(provinceBreakdown, "Qinghai province coverage row is missing");
  provinceBreakdown.records += records.length;
  provinceBreakdown.years = sortedUnique([...provinceBreakdown.years, ...records.map((record) => Number(record.year))]).sort((left, right) => right - left);
  provinceBreakdown.subjects = sortedUnique([...provinceBreakdown.subjects, ...records.map((record) => record.subjectType)]);
  increment(provinceBreakdown.dataTypes, "control-line", records.length);
  addLowBands(provinceBreakdown.lowBands, records);

  const yearBreakdown = coverage.yearBreakdown.find((row) => Number(row.year) === 2026);
  assert(yearBreakdown, "2026 year coverage row is missing");
  const newSchoolNames = sortedUnique(records.map((record) => record.schoolName));
  yearBreakdown.records += records.length;
  increment(yearBreakdown.dataTypes, "control-line", records.length);
  yearBreakdown.schools += newSchoolNames.filter((name) => !existingSchoolNames.has(name)).length;

  refreshReadiness(layer.provinceReadiness, shard.records, shard.rankConversions);
  refreshReadiness(coverage.provinceReadiness, shard.records, shard.rankConversions);

  const shardBytes = encodeJson(shard);
  atomicWriteGzip(shardFile, shardBytes);
  const coreBytes = encodeJson(core);
  atomicWriteGzip(coreFile, coreBytes);

  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = newCount;
  manifest.shards["青海"].records = shard.records.length;
  manifest.shards["青海"].bytes = shardBytes.byteLength;
  manifest.shards["青海"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-qinghai-control-lines-2026-v3302-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      qinghaiRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankRowsLinked: sourceRankRows.length,
      rankRowsFullCrossChecked: sourceRankRows.length,
      rankRowsContinuityChecked: sourceRankRows.length,
      officialZeroPersonGapEventsRetained: 46,
      officialZeroPersonScoresRetained: 336,
      topBucketRangeRepairs,
      rankValueChanges: 0,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      professionalNumericRecords: payload.diagnostics.professionalNumericRecords,
      professionalQualificationRecords: payload.diagnostics.professionalQualificationRecords,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      qinghaiBytes: shardBytes.byteLength,
      qinghaiSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.qinghaiRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Qinghai merged count ${runtimeManifest.after.qinghaiRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
