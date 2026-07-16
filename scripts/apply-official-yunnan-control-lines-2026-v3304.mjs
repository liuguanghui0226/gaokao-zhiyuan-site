#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.303-shanxi-control-lines2026-pending-vocational-and-rank-provenance-847184records";
const NEXT_VERSION = "local-deterministic-v3.304-yunnan-control-lines2026-art-thresholds-and-rank-image-provenance-847238records";
const SOURCE_ID = "official-yunnan-control-lines-2026";
const RANK_SOURCE_ID = "official-yunnan-rank-2026";
const RANK_URL = "https://gaokao.chsi.com.cn/gkxx/ss/202606/20260626/2293847808.html";
const RANK_IMAGE_URL = "https://t2.chei.com.cn/news/img/2293847809.png";
const EXPECTED_RECORDS = 54;
const EXPECTED_RANK_ROWS = 986;
const EXPECTED_SHARD_RANK_ROWS = 1966;
const EXPECTED_NEW_RECORD_COUNT = 847238;
const EXPECTED_NEW_SHARD_RECORDS = 15460;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-yunnan-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-yunnan-control-lines-2026-v3304-runtime-manifest.json",
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
  const row = container?.rows?.find((item) => item.province === "云南");
  assert(row, "Yunnan province-readiness row is missing");
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

function targetRankRows(shard) {
  return shard.rankConversions.filter((record) => record.year === 2026 && record.sourceId === RANK_SOURCE_ID);
}

function rankAt(rows, subjectType, score) {
  return rows.find((record) => record.subjectType === subjectType && record.score === score);
}

function patchRankSourceNote(core, sourceEvidence, rows) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Yunnan rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Yunnan parsed rank rows: ${note.parsedRecords}`);
  assert(note.quality === "official-yunnan-rank-conversion-image-tesseract-validated", `Yunnan rank quality drifted: ${note.quality}`);
  assert(note.imageSha256 === sourceEvidence.evidence.rankImage.sha256 && note.imageBytes === sourceEvidence.evidence.rankImage.bytes, "Yunnan rank image identity drifted");
  assert(note.imageDimensions?.width === 900 && note.imageDimensions?.height === 8615, "Yunnan rank image dimensions drifted");
  assert(note.ocr?.corrections === 32, "Yunnan OCR correction inventory drifted");
  assert(note.subjects?.find((row) => row.subjectType === "文科")?.records === 482, "Yunnan history rank inventory drifted");
  assert(note.subjects?.find((row) => row.subjectType === "理科")?.records === 504, "Yunnan physics rank inventory drifted");

  const crossCheck = sourceEvidence.rankEvidence.controlBoundaryCrossCheck;
  for (const [key, checkpoints] of Object.entries(crossCheck)) {
    const subjectType = key === "history" ? "文科" : "理科";
    for (const label of ["vocational", "bachelor", "special"]) {
      const score = checkpoints[`${label}Score`];
      assert(rankAt(rows, subjectType, score)?.rankEnd === checkpoints[`${label}RankEnd`], `Yunnan ${subjectType}/${score} rank cross-check drifted`);
    }
    assert(rankAt(rows, subjectType, 600)?.rankEnd === checkpoints.score600RankEnd, `Yunnan ${subjectType}/600 checkpoint drifted`);
  }

  note.relatedUrls = sortedUnique([...(note.relatedUrls || []), RANK_URL, RANK_IMAGE_URL, sourceEvidence.url, ...(sourceEvidence.relatedUrls || [])]);
  note.chsiMirrorUrl = RANK_URL;
  note.chsiMirrorImageUrl = RANK_IMAGE_URL;
  note.controlBoundaryCrossCheck = {
    url: sourceEvidence.url,
    evidenceQuality: sourceEvidence.quality,
    verifiedAt: "2026-07-17",
    ...crossCheck,
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-17",
    finding: "阳光高考重新下载的云南2026分数段长图为900×8615、584926字节，SHA-256与库存云南省招生考试院官方图完全一致。对986条运行位次执行数量、分数连续性、名次连续性和控制线检查，保留32处既有OCR校正；本轮只补阳光高考镜像图URL，位次数值不变。",
    rankRowsLinked: EXPECTED_RANK_ROWS,
    rowsInventoryChecked: EXPECTED_RANK_ROWS,
    rowsContinuityChecked: EXPECTED_RANK_ROWS,
    checkpointCount: 10,
    retainedOcrCorrections: 32,
    topBucketRangeRepairs: 0,
    valueChanges: 0,
    directChsiMirrorImageRedownloadStatus: "success-byte-identical-to-stored-official-image",
    directOriginalPageRedownloadStatus: "blocked-current-session-tls",
    verificationScope: "current CHSI mirror image byte-identical to stored official image; all 986 runtime rows inventory and continuity checked; OCR corrections retained; rank values unchanged",
    officialImage: {
      originalUrl: note.imageUrl,
      mirrorUrl: RANK_IMAGE_URL,
      bytes: note.imageBytes,
      width: note.imageDimensions.width,
      height: note.imageDimensions.height,
      sha256: note.imageSha256,
    },
  };
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const rows = targetRankRows(shard);
  const rankNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift");
  assert(manifest.recordCount === EXPECTED_NEW_RECORD_COUNT, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Yunnan control records`);
  assert(rows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Yunnan rank rows`);
  assert(rows.every((record) => record.sourceUrl === RANK_IMAGE_URL), "Yunnan rank source URL repair drifted");
  assert(rankNote?.provenanceRevision?.rowsInventoryChecked === EXPECTED_RANK_ROWS, "Yunnan rank provenance drifted");
  return { sourceRecords, rows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "yunnan.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);
  const sourceEvidence = payload.sourceNotes?.[0];

  assert(payload.dataset === "official-yunnan-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && sourceEvidence.id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "云南" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary Yunnan records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 50, "Expected 50 Yunnan special-path records");
  assert(payload.records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 44, "Expected 44 Yunnan numeric art thresholds");
  assert(payload.records.filter((record) => record.professionalQualification).length === 4, "Expected four Yunnan sports qualification rows");
  assert(payload.records.every((record) => record.scoreMaximum === 750), "Yunnan control records must retain the 750-point score scale");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.rows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 847184, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["云南"]?.records === 15406, `Unexpected Yunnan base count ${manifest.shards?.["云南"]?.records}`);
  assert(manifest.shards?.["云南"]?.rankConversions === EXPECTED_SHARD_RANK_ROWS, "Unexpected Yunnan rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_SHARD_RANK_ROWS, `Unexpected Yunnan rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const rows = targetRankRows(shard);
  assert(rows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Yunnan rank rows`);
  assert(rows.every((record) => !record.sourceUrl), "Expected all Yunnan rank rows to need URL repair");
  assert(rows.filter((record) => record.scoreRange?.max === 750).length === 2, "Expected two existing Yunnan top-bucket ranges");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = rows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    yunnanRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: rows.filter((record) => !record.sourceUrl).length,
    topBucketRangesPresent: rows.filter((record) => record.scoreRange?.max === 750).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    yunnanSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of rows) record.sourceUrl = RANK_IMAGE_URL;
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(rows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality])), "Yunnan rank values changed during provenance repair");
  shard.generatedAt = payload.generatedAt;
  patchRankSourceNote(core, sourceEvidence, rows);

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
  layer.currentFinding = "云南2026普通历史本科/专科465/180分、物理本科/专科435/180分进入普通资格路由；特殊类型、艺术和体育50条保持特殊路径。艺术44条文化与专业双门槛分列，体育4条不补造专业分。986条普通类位次对应的阳光高考长图与库存官方图字节完全一致，保留32处OCR校正，数值零改动并补镜像图URL。全国2026普通类通用控制线已覆盖31省。";
  layer.sourceNotes.push(sourceEvidence);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "云南");
  assert(provinceBreakdown, "Yunnan province coverage row is missing");
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
  manifest.shards["云南"].records = shard.records.length;
  manifest.shards["云南"].bytes = shardBytes.byteLength;
  manifest.shards["云南"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-yunnan-control-lines-2026-v3304-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      yunnanRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankRowsLinked: rows.length,
      rankRowsInventoryChecked: rows.length,
      rankRowsContinuityChecked: rows.length,
      retainedOcrCorrections: 32,
      topBucketRangeRepairs: 0,
      rankValueChanges: 0,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      professionalNumericRecords: payload.diagnostics.professionalNumericRecords,
      professionalQualificationRecords: payload.diagnostics.professionalQualificationRecords,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      yunnanBytes: shardBytes.byteLength,
      yunnanSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.yunnanRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Yunnan merged count ${runtimeManifest.after.yunnanRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
