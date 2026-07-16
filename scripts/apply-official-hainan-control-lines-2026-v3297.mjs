#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.296-guizhou-control-lines2026-and-rank-provenance-847019records";
const NEXT_VERSION = "local-deterministic-v3.297-hainan-control-lines2026-and-rank-provenance-847033records";
const SOURCE_ID = "official-hainan-control-lines-2026";
const RANK_SOURCE_ID = "official-hainan-rank-2026";
const RANK_INDEX_URL = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/t20260625_4099593.html";
const RANK_PDF_URL = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/P020260625627884748040.pdf";
const EXPECTED_RECORDS = 14;
const EXPECTED_RANK_ROWS = 547;
const EXPECTED_NEW_RECORD_COUNT = 847033;
const EXPECTED_NEW_SHARD_RECORDS = 10690;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-hainan-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-hainan-control-lines-2026-v3297-runtime-manifest.json",
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
  const row = container?.rows?.find((item) => item.province === "海南");
  assert(row, "Hainan province-readiness row is missing");
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

function rankUrlFor(record) {
  assert(record.subjectType === "综合", `Unexpected Hainan rank subject: ${record.subjectType}`);
  return RANK_PDF_URL;
}

function rankAt(rows, subjectType, score) {
  return rows.find((record) => record.subjectType === subjectType && (record.score === score || (record.scoreRange && score >= record.scoreRange.min && score <= record.scoreRange.max)));
}

function patchRankSourceNote(core, sourceEvidence, sourceRankRows) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Hainan rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Hainan parsed rank rows: ${note.parsedRecords}`);
  assert(note.url === RANK_INDEX_URL, `Unexpected Hainan rank index URL: ${note.url}`);
  assert(note.quality === "official-hainan-rank-conversion-pdf", `Hainan rank quality drifted: ${note.quality}`);
  assert(note.attachmentUrls?.includes(RANK_PDF_URL), "Hainan official rank PDF URL drifted");
  assert(note.pdfPages === 20 && note.bandRecords === 1 && note.onePointRecords === 546, "Hainan rank inventory drifted");
  assert(note.scoreRange?.min === 254 && note.scoreRange?.max === 800, "Hainan rank score range drifted");
  const crossCheck = sourceEvidence.rankEvidence.controlBoundaryCrossCheck;
  for (const checkpoint of Object.values(crossCheck)) {
    if (checkpoint.scoreRange) {
      const row = sourceRankRows.find((item) =>
        item.scoreRange?.min === checkpoint.scoreRange.min &&
        item.scoreRange?.max === checkpoint.scoreRange.max
      );
      assert(row?.rankEnd === checkpoint.rankEnd, "Hainan top-bucket rank cross-check drifted");
    } else {
      const row = rankAt(sourceRankRows, "综合", checkpoint.score);
      assert(row?.rankEnd === checkpoint.rankEnd, `Hainan rank cross-check drifted: ${checkpoint.score}`);
    }
  }
  note.relatedUrls = sortedUnique([...(note.relatedUrls || []), sourceEvidence.url, ...(sourceEvidence.relatedUrls || [])]);
  note.controlBoundaryCrossCheck = {
    url: sourceEvidence.url,
    evidenceQuality: sourceEvidence.quality,
    verifiedAt: "2026-07-16",
    ...crossCheck,
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-16",
    finding: "保留海南省考试局正式位次页面、附件URL和547条普通类位次数值；阳光高考转载的20页普通类位次PDF重新解析547行，与运行层逐行零差异。本轮只给每条位次补考试局正式PDF URL。考试局原站本轮TLS连接失败，未伪称直接重新下载原站附件成功。",
    rankRowsLinked: EXPECTED_RANK_ROWS,
    rowsFullCrossChecked: sourceEvidence.rankEvidence.fullRowCrossCheck.rowsCompared,
    checkpointCount: Object.keys(crossCheck).length,
    valueChanges: 0,
    directPageRedownloadStatus: "blocked-current-session-tls-existing-official-url-inventory-retained-chsi-mirror-full-row-verified",
    chsiMirrorPdf: {
      url: sourceEvidence.rankEvidence.chsiMirrorPdfUrl,
      sha256: sourceEvidence.rankEvidence.mirrorPdfSha256,
      pages: sourceEvidence.evidence.chsiRankOrdinaryPdf.pages,
    },
  };
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const sourceRankRows = rankRows(shard);
  const rankNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift");
  assert(manifest.recordCount === EXPECTED_NEW_RECORD_COUNT, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Hainan control records`);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Hainan rank rows`);
  assert(sourceRankRows.every((record) => record.sourceUrl === rankUrlFor(record)), "Hainan rank source URL repair drifted");
  assert(rankNote?.provenanceRevision?.rankRowsLinked === EXPECTED_RANK_ROWS, "Hainan rank provenance drifted");
  return { sourceRecords, sourceRankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "hainan.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);
  const sourceEvidence = payload.sourceNotes?.[0];

  assert(payload.dataset === "official-hainan-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && sourceEvidence.id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "海南" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 1, "Expected one ordinary Hainan record");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 13, "Expected 13 Hainan special-path records");
  assert(payload.records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 1, "Expected one Hainan sports professional threshold");
  assert(payload.records.filter((record) => record.professionalQualification).length === 10, "Expected ten Hainan art culture lines with a professional qualification boundary");
  assert(payload.records.every((record) => record.scoreMaximum === 900), "Hainan control records must retain the 900-point score scale");
  assert(payload.diagnostics.ordinaryVocationalStatus === "pending-official-release", "Hainan ordinary vocational status drifted");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.sourceRankRows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 847019, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["海南"]?.records === 10676, `Unexpected Hainan base count ${manifest.shards?.["海南"]?.records}`);
  assert(manifest.shards?.["海南"]?.rankConversions === EXPECTED_RANK_ROWS, "Unexpected Hainan rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_RANK_ROWS, `Unexpected Hainan rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const sourceRankRows = rankRows(shard);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Hainan rank rows`);
  assert(sourceRankRows.every((record) => !record.sourceUrl), "Expected all Hainan rank rows to need URL repair");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    hainanRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: sourceRankRows.filter((record) => !record.sourceUrl).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    hainanSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of sourceRankRows) record.sourceUrl = rankUrlFor(record);
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality])), "Hainan rank values changed during provenance repair");
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
  layer.currentFinding = "海南2026本科批普通类479分已进入900分制普通本科资格路由；普通专科批实行先报志愿再划线，保持待官方发布。国家专项、特殊类型、体育和10个艺术方向13条保持特殊路径；体育文化421分与专业75分分列，艺术不补造专业分。547条官方位次补齐正式PDF URL，20页转载PDF逐行零差异。";
  layer.sourceNotes.push(sourceEvidence);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "海南");
  assert(provinceBreakdown, "Hainan province coverage row is missing");
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
  manifest.shards["海南"].records = shard.records.length;
  manifest.shards["海南"].bytes = shardBytes.byteLength;
  manifest.shards["海南"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-hainan-control-lines-2026-v3297-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      hainanRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankRowsLinked: sourceRankRows.length,
      rankValueChanges: 0,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      artRecords: payload.diagnostics.artRecords,
      artProfessionalQualificationRecords: payload.diagnostics.artProfessionalQualificationRecords,
      sportsRecords: payload.diagnostics.sportsRecords,
      professionalNumericRecords: payload.diagnostics.professionalNumericRecords,
      ordinaryVocationalStatus: payload.diagnostics.ordinaryVocationalStatus,
      rankRowsFullCrossChecked: payload.diagnostics.rankRowsFullCrossChecked,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      hainanBytes: shardBytes.byteLength,
      hainanSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.hainanRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Hainan merged count ${runtimeManifest.after.hainanRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
