#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.293-chongqing-control-lines2026-and-rank-provenance-846887records";
const NEXT_VERSION = "local-deterministic-v3.294-gansu-control-lines2026-and-third-party-rank-boundary-cross-check-846940records";
const SOURCE_ID = "official-gansu-control-lines-2026";
const RANK_SOURCE_ID = "gk100-gansu-rank-2026";
const EXPECTED_RECORDS = 53;
const EXPECTED_RANK_ROWS = 1343;
const EXPECTED_NEW_RECORD_COUNT = 846940;
const EXPECTED_NEW_SHARD_RECORDS = 13294;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-gansu-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-gansu-control-lines-2026-v3294-runtime-manifest.json",
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
  const row = container?.rows?.find((item) => item.province === "甘肃");
  assert(row, "Gansu province-readiness row is missing");
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

function patchRankSourceNote(core, sourceEvidence, sourceRankRows) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Gansu third-party rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Gansu parsed rank rows: ${note.parsedRecords}`);
  assert(note.quality === "third-party-gk100-gansu-rank-conversion-image-tesseract-grid-validated", `Gansu rank quality drifted: ${note.quality}`);
  assert(note.subjects?.find((item) => item.subjectType === "历史类")?.imageSha256 === "d4e418f713a7d57639bf7c7488ddcb21d8c5ae528f13e7eb69a46b8410e4b8ab", "Gansu history rank image hash drifted");
  assert(note.subjects?.find((item) => item.subjectType === "物理类")?.imageSha256 === "b691e8cfe0cf1e5a9646d1535da155fb77c1f9d238dea9f90886541b558a1a91", "Gansu physics rank image hash drifted");
  const crossCheck = sourceEvidence.rankEvidence.controlBoundaryCrossCheck;
  for (const [subjectType, values] of [["历史类", crossCheck.history], ["物理类", crossCheck.physics]]) {
    for (const [scoreKey, rankKey] of [["vocationalScore", "vocationalRankEnd"], ["bachelorScore", "bachelorRankEnd"], ["specialScore", "specialRankEnd"]]) {
      const row = rankAt(sourceRankRows, subjectType, values[scoreKey]);
      assert(row?.rankEnd === values[rankKey], `Gansu rank cross-check drifted: ${subjectType}/${values[scoreKey]}`);
    }
  }
  note.relatedUrls = sortedUnique([...(note.relatedUrls || []), sourceEvidence.url]);
  note.officialControlCrossCheck = {
    url: sourceEvidence.url,
    verifiedAt: "2026-07-16",
    ...crossCheck,
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-16",
    finding: "保留既有高考100第三方图片镜像、OCR网格证据和1343条位次数值；使用甘肃省教育考试院2026正式控制线交叉核验历史/物理专科、本科和特殊类型六个分数点。未找到考试院直接发布的一分一段页面，因此不升级来源等级。",
    rankRowsCrossChecked: EXPECTED_RANK_ROWS,
    checkpointCount: 6,
    valueChanges: 0,
    officialRankPageFound: false,
    sourceQualityRetained: note.quality,
  };
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const sourceRankRows = rankRows(shard);
  const rankNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift");
  assert(manifest.recordCount === EXPECTED_NEW_RECORD_COUNT, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Gansu control records`);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Gansu rank rows`);
  assert(rankNote?.provenanceRevision?.rankRowsCrossChecked === EXPECTED_RANK_ROWS, "Gansu rank provenance boundary drifted");
  assert(rankNote?.quality?.startsWith("third-party-"), "Gansu rank source must remain third-party");
  return { sourceRecords, sourceRankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "gansu.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);
  const sourceEvidence = payload.sourceNotes?.[0];

  assert(payload.dataset === "official-gansu-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && sourceEvidence.id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "甘肃" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 49, "Expected 49 special-path records");
  assert(payload.records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 28, "Expected 28 culture-professional records");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankRowsCrossChecked: prior.sourceRankRows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 846887, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["甘肃"]?.records === 13241, `Unexpected Gansu base count ${manifest.shards?.["甘肃"]?.records}`);
  assert(manifest.shards?.["甘肃"]?.rankConversions === 2679, "Unexpected Gansu rank-conversion manifest count");
  assert(shard.rankConversions?.length === 2679, `Unexpected Gansu rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const sourceRankRows = rankRows(shard);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Gansu 2026 rank rows`);
  const beforeRankValues = sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality, record.sourceUrl]);
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    gansuRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankSourceQuality: core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID)?.quality,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    gansuSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  shard.generatedAt = payload.generatedAt;
  patchRankSourceNote(core, sourceEvidence, sourceRankRows);
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality, record.sourceUrl])), "Gansu rank rows changed during boundary cross-check");

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
  layer.currentFinding = "甘肃2026普通类历史本科405分、专科160分，物理本科367分、专科180分已进入资格路由；特殊类型、艺体、艺术校考/戏曲和中职升学49条保持特殊路径。1343条位次仍标注第三方图片镜像，仅与考试院正式控制线交叉核验，不冒充官方位次表。";
  layer.sourceNotes.push(sourceEvidence);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "甘肃");
  assert(provinceBreakdown, "Gansu province coverage row is missing");
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
  manifest.shards["甘肃"].records = shard.records.length;
  manifest.shards["甘肃"].bytes = shardBytes.byteLength;
  manifest.shards["甘肃"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-gansu-control-lines-2026-v3294-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      gansuRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankRowsCrossChecked: sourceRankRows.length,
      rankValueChanges: 0,
      rankSourceQuality: core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID)?.quality,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      cultureProfessionalRecords: payload.diagnostics.cultureProfessionalRecords,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      gansuBytes: shardBytes.byteLength,
      gansuSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.gansuRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Gansu merged count ${runtimeManifest.after.gansuRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
