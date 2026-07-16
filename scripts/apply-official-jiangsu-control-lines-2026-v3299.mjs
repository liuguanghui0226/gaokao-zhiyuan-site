#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.298-heilongjiang-control-lines2026-and-rank-provenance-847051records";
const NEXT_VERSION = "local-deterministic-v3.299-jiangsu-first-stage-control-lines2026-pending-vocational-and-rank-provenance-847079records";
const SOURCE_ID = "official-jiangsu-control-lines-2026";
const RANK_SOURCE_ID = "official-jiangsu-rank-2026";
const RANK_PAGE_URL = "https://www.jseea.cn/webfile/index/index_zkxx/2026-06-24/7475494421979467776.html";
const RANK_HISTORY_URL = "https://www.jseea.cn/webfile/upload/2026/06-24/18-24-3205871556923388.jpg";
const RANK_PHYSICS_URL = "https://www.jseea.cn/webfile/upload/2026/06-24/18-24-3208191910823240.jpg";
const EXPECTED_RECORDS = 28;
const EXPECTED_RANK_ROWS = 408;
const EXPECTED_NEW_RECORD_COUNT = 847079;
const EXPECTED_NEW_SHARD_RECORDS = 26338;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-jiangsu-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-jiangsu-control-lines-2026-v3299-runtime-manifest.json",
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
  const row = container?.rows?.find((item) => item.province === "江苏");
  assert(row, "Jiangsu province-readiness row is missing");
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
  if (record.subjectType === "历史类") return RANK_HISTORY_URL;
  if (record.subjectType === "物理类") return RANK_PHYSICS_URL;
  throw new Error(`Unexpected Jiangsu rank subject: ${record.subjectType}`);
}

function rankAt(rows, subjectType, score) {
  return rows.find((record) => record.subjectType === subjectType
    && (record.score === score || (record.scoreRange && score >= record.scoreRange.min && score <= record.scoreRange.max)));
}

function patchRankSourceNote(core, sourceEvidence, sourceRankRows) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Jiangsu rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Jiangsu parsed rank rows: ${note.parsedRecords}`);
  assert(note.url === RANK_PAGE_URL, `Unexpected Jiangsu rank page URL: ${note.url}`);
  assert(note.quality === "official-jiangsu-rank-conversion-image-vision-validated", `Jiangsu rank quality drifted: ${note.quality}`);
  assert(note.imageUrls?.includes(RANK_HISTORY_URL) && note.imageUrls?.includes(RANK_PHYSICS_URL), "Jiangsu rank image URLs drifted");
  assert(note.subjects?.find((row) => row.subjectType === "历史类")?.records === 174, "Jiangsu history rank inventory drifted");
  assert(note.subjects?.find((row) => row.subjectType === "物理类")?.records === 234, "Jiangsu physics rank inventory drifted");
  assert(note.ocrCorrections === 12, "Jiangsu retained Vision correction count drifted");

  const crossCheck = sourceEvidence.rankEvidence.controlBoundaryCrossCheck;
  for (const [subject, checkpoints] of Object.entries(crossCheck)) {
    const subjectType = subject === "history" ? "历史类" : "物理类";
    for (const key of ["bachelor", "special"]) {
      const score = checkpoints[`${key}Score`];
      const rankEnd = checkpoints[`${key}RankEnd`];
      assert(rankAt(sourceRankRows, subjectType, score)?.rankEnd === rankEnd, `Jiangsu ${subjectType}/${score} rank cross-check drifted`);
    }
  }

  note.relatedUrls = sortedUnique([...(note.relatedUrls || []), sourceEvidence.url, ...(sourceEvidence.relatedUrls || [])]);
  note.controlBoundaryCrossCheck = {
    url: sourceEvidence.url,
    evidenceQuality: sourceEvidence.quality,
    verifiedAt: "2026-07-17",
    ...crossCheck,
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-17",
    finding: "重新下载江苏省教育考试院位次页面和历史、物理两张官方图片并锁定哈希；复核运行层408条记录的科类库存、端点、名次宽度、逐行连续性和本科/特殊类型边界，保留此前Vision校验及12处连续性纠正，位次数值零改动。本轮未重新做全图逐行OCR，不把库存连续性复核表述为重新逐行识别。",
    rankRowsLinked: EXPECTED_RANK_ROWS,
    rowsInventoryChecked: EXPECTED_RANK_ROWS,
    rowsContinuityChecked: EXPECTED_RANK_ROWS,
    checkpointCount: 8,
    priorVisionCorrectionsRetained: note.ocrCorrections,
    valueChanges: 0,
    directOfficialRedownloadStatus: "success",
    verificationScope: "official images rehashed; runtime inventory, endpoints, rank widths, continuity and control-boundary checkpoints verified; no fresh full-image row OCR",
    officialFiles: {
      page: { url: RANK_PAGE_URL, sha256: sourceEvidence.evidence.rankPage.sha256 },
      history: { url: RANK_HISTORY_URL, sha256: sourceEvidence.evidence.rankHistory.sha256, rows: 174 },
      physics: { url: RANK_PHYSICS_URL, sha256: sourceEvidence.evidence.rankPhysics.sha256, rows: 234 },
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
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Jiangsu control records`);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Jiangsu rank rows`);
  assert(sourceRankRows.every((record) => record.sourceUrl === rankUrlFor(record)), "Jiangsu rank source URL repair drifted");
  assert(rankNote?.provenanceRevision?.rankRowsLinked === EXPECTED_RANK_ROWS, "Jiangsu rank provenance drifted");
  return { sourceRecords, sourceRankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "jiangsu.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);
  const sourceEvidence = payload.sourceNotes?.[0];

  assert(payload.dataset === "official-jiangsu-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && sourceEvidence.id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "江苏" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 2, "Expected two ordinary Jiangsu records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 26, "Expected 26 Jiangsu special-path records");
  assert(payload.records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 20, "Expected 20 Jiangsu professional thresholds");
  assert(payload.records.filter((record) => record.professionalQualification).length === 4, "Expected four Jiangsu professional qualification rows");
  assert(payload.records.every((record) => record.scoreMaximum === 750), "Jiangsu control records must retain the 750-point score scale");
  assert(payload.diagnostics.ordinaryVocationalStatus === "pending-official-release", "Jiangsu ordinary vocational status drifted");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.sourceRankRows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 847051, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["江苏"]?.records === 26310, `Unexpected Jiangsu base count ${manifest.shards?.["江苏"]?.records}`);
  assert(manifest.shards?.["江苏"]?.rankConversions === EXPECTED_RANK_ROWS, "Unexpected Jiangsu rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_RANK_ROWS, `Unexpected Jiangsu rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const sourceRankRows = rankRows(shard);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Jiangsu rank rows`);
  assert(sourceRankRows.every((record) => !record.sourceUrl), "Expected all Jiangsu rank rows to need URL repair");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    jiangsuRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: sourceRankRows.filter((record) => !record.sourceUrl).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    jiangsuSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of sourceRankRows) record.sourceUrl = rankUrlFor(record);
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality])), "Jiangsu rank values changed during provenance repair");
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
  layer.currentFinding = "江苏2026普通历史本科484分、物理本科456分进入普通本科资格路由；普通专科线在第二阶段志愿填报前另行发布，保持待官方发布。特殊类型、体育、艺术统考、校考和戏曲省际联考26条保持特殊路径；20条艺体统考分列文化与专业门槛，4条资格记录不补造专业分。408条第一阶段位次补齐科类官方图片URL，数值零改动。";
  layer.sourceNotes.push(sourceEvidence);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "江苏");
  assert(provinceBreakdown, "Jiangsu province coverage row is missing");
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
  manifest.shards["江苏"].records = shard.records.length;
  manifest.shards["江苏"].bytes = shardBytes.byteLength;
  manifest.shards["江苏"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-jiangsu-control-lines-2026-v3299-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      jiangsuRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankRowsLinked: sourceRankRows.length,
      rankRowsInventoryChecked: sourceRankRows.length,
      rankRowsContinuityChecked: sourceRankRows.length,
      priorVisionCorrectionsRetained: sourceEvidence.rankEvidence.priorVisionCorrectionsRetained,
      rankValueChanges: 0,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      cultureProfessionalRecords: payload.diagnostics.cultureProfessionalRecords,
      professionalQualificationRecords: payload.diagnostics.professionalQualificationRecords,
      ordinaryVocationalStatus: payload.diagnostics.ordinaryVocationalStatus,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      jiangsuBytes: shardBytes.byteLength,
      jiangsuSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.jiangsuRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Jiangsu merged count ${runtimeManifest.after.jiangsuRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
