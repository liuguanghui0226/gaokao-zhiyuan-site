#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.286-beijing-control-lines2026-and-score-basis-846666records";
const NEXT_VERSION = "local-deterministic-v3.287-tianjin-control-lines2026-pending-vocational-and-rank-provenance-846672records";
const SOURCE_ID = "official-tianjin-control-lines-2026";
const RANK_SOURCE_ID = "official-tianjin-rank-2026";
const RANK_SOURCE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260624/2293845980.html";
const RANK_PDF_URL = "https://t4.chei.com.cn/news/getfile/2293845981-2293845980-ceda0163fd4fad87e9fe561da1f1c735.pdf";
const RANK_PAGE_BYTES = 44159;
const RANK_PAGE_SHA256 = "6237d13873da2c099969bdc3bfeb16e56d194ae906a6f04d94304c56777f4905";
const RANK_PDF_BYTES = 622036;
const RANK_PDF_SHA256 = "768a8cf5bc3c07d1a1d390c5040394192314c6845e4383cfdba2e01d4b9dec1d";
const EXPECTED_RECORDS = 6;
const EXPECTED_RANK_ROWS = 381;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-tianjin-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-tianjin-control-lines-2026-v3287-runtime-manifest.json",
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
  const row = container?.rows?.find((item) => item.province === "天津");
  assert(row, "Tianjin province-readiness row is missing");
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

function patchRankSourceNote(core) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Tianjin rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Tianjin parsed rank rows: ${note.parsedRecords}`);
  assert(note.pdfPages === 2, `Unexpected Tianjin rank PDF pages: ${note.pdfPages}`);
  assert(note.attachmentUrls?.includes(RANK_PDF_URL), "Tianjin rank PDF URL drifted");
  note.pageHtmlBytes = RANK_PAGE_BYTES;
  note.pageHtmlSha256 = RANK_PAGE_SHA256;
  note.pdfBytes = RANK_PDF_BYTES;
  note.pdfSha256 = RANK_PDF_SHA256;
  note.provenanceRevision = {
    verifiedAt: "2026-07-16",
    finding: "重新下载天津教育招生考试院在阳光高考发布的正式来源页和2页PDF；既有381条综合改革位次记录保持不变，运行分片逐条补齐来源页URL。",
    rankRowsLinked: EXPECTED_RANK_ROWS,
    valueChanges: 0,
  };
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const sourceRankRows = rankRows(shard);
  const rankNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift");
  assert(manifest.recordCount === 846672, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Tianjin control records`);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Tianjin rank rows`);
  assert(sourceRankRows.every((record) => record.sourceUrl === RANK_SOURCE_URL), "Tianjin rank source URL repair drifted");
  assert(rankNote?.pageHtmlSha256 === RANK_PAGE_SHA256, "Tianjin rank page provenance drifted");
  assert(rankNote?.pdfSha256 === RANK_PDF_SHA256, "Tianjin rank PDF provenance drifted");
  return { sourceRecords, sourceRankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const tianjinFile = path.join(releaseDir, "tianjin.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(tianjinFile);

  assert(payload.dataset === "official-tianjin-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "天津" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 1, "Expected one ordinary record");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 5, "Expected five special-path records");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.sourceRankRows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 846666, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["天津"]?.records === 9650, `Unexpected Tianjin base count ${manifest.shards?.["天津"]?.records}`);
  assert(manifest.shards?.["天津"]?.rankConversions === EXPECTED_RANK_ROWS, "Unexpected Tianjin rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_RANK_ROWS, `Unexpected Tianjin rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const sourceRankRows = rankRows(shard);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Tianjin rank rows`);
  assert(sourceRankRows.every((record) => !record.sourceUrl), "Expected all Tianjin rank rows to need URL repair");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = sourceRankRows.map((record) => [record.id, record.score, record.rankStart, record.rankEnd, record.sameRankScore]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    tianjinRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: sourceRankRows.filter((record) => !record.sourceUrl).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    tianjinSha256: sha256(zlib.gunzipSync(fs.readFileSync(tianjinFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of sourceRankRows) record.sourceUrl = RANK_SOURCE_URL;
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(sourceRankRows.map((record) => [record.id, record.score, record.rankStart, record.rankEnd, record.sameRankScore])), "Tianjin rank values changed during provenance repair");
  shard.generatedAt = payload.generatedAt;
  patchRankSourceNote(core);

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  const newCount = Number(layer.structuredRecords) + records.length;
  assert(newCount === 846672, `Unexpected merged record count ${newCount}`);
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = newCount;
  layer.structuredRecords = newCount;
  layer.statusLabel = `已接入${newCount}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "天津2026普通本科控制线458分、特殊类型资格参考线547分，艺考类本科文化线343/297/229分、体育类本科文化线407分；381条同年位次记录已补齐正式来源。2026普通高职专科控制线尚待官方发布，本科线以下结果只作路径调研。";
  layer.sourceNotes.push(payload.sourceNotes[0]);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "天津");
  assert(provinceBreakdown, "Tianjin province coverage row is missing");
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
  atomicWriteGzip(tianjinFile, shardBytes);
  const coreBytes = encodeJson(core);
  atomicWriteGzip(coreFile, coreBytes);

  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = newCount;
  manifest.shards["天津"].records = shard.records.length;
  manifest.shards["天津"].bytes = shardBytes.byteLength;
  manifest.shards["天津"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-tianjin-control-lines-2026-v3287-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      tianjinRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankSourceUrlRecords: sourceRankRows.filter((record) => record.sourceUrl === RANK_SOURCE_URL).length,
      rankValueChanges: 0,
      rankEvidence: { pageHtmlBytes: RANK_PAGE_BYTES, pageHtmlSha256: RANK_PAGE_SHA256, pdfBytes: RANK_PDF_BYTES, pdfSha256: RANK_PDF_SHA256 },
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      ordinaryVocationalStatus: payload.diagnostics.ordinaryVocationalStatus,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      tianjinBytes: shardBytes.byteLength,
      tianjinSha256: sha256(shardBytes),
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
