#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.289-fujian-control-lines2026-and-rank-provenance-846768records";
const NEXT_VERSION = "local-deterministic-v3.290-hebei-control-lines2026-and-rank-provenance-846822records";
const SOURCE_ID = "official-hebei-control-lines-2026";
const RANK_SOURCE_ID = "official-hebei-rank-2026";
const RANK_URL = "https://www.hebeea.edu.cn/c/2026-06-24/493215.html";
const EVIDENCE = {
  controlPage: { bytes: 21530, sha256: "89137895e8126fa5d8845f7b11a9aa8e3e477e501b61eb107e16b1732fdf4591" },
  controlImage: { bytes: 497717, sha256: "cd4adbc26dc402f2db0f24724e7e03da2dd436302e0886e68a22ec3872a5eb42" },
  rankPage: { bytes: 29272, sha256: "67045aa3c9dcb2a6e7917c39b502ab267def279bc1296f06567871e6aed95bbe" },
  rankPdf: { bytes: 6084765, sha256: "fcd70c8356b95dc787b92c1c1f7c97183fc5a1532dadf492714e3d5edae7cf16" },
};
const EXPECTED_RECORDS = 54;
const EXPECTED_RANK_ROWS = 1094;
const EXPECTED_NEW_RECORD_COUNT = 846822;
const EXPECTED_NEW_SHARD_RECORDS = 68517;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-hebei-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-hebei-control-lines-2026-v3290-runtime-manifest.json",
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
  const row = container?.rows?.find((item) => item.province === "河北");
  assert(row, "Hebei province-readiness row is missing");
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

function expectedRankUrl(record) {
  assert(["历史类", "物理类"].includes(record.subjectType), `Unexpected Hebei rank subject: ${record.subjectType}`);
  return RANK_URL;
}

function patchRankSourceNote(core) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Hebei rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Hebei parsed rank rows: ${note.parsedRecords}`);
  assert(note.url === RANK_URL, "Hebei rank page URL drifted");
  assert(note.pdfSha256 === EVIDENCE.rankPdf.sha256 && note.pdfBytes === EVIDENCE.rankPdf.bytes, "Hebei rank PDF evidence drifted");
  note.pageEvidence = {
    url: RANK_URL,
    bytes: EVIDENCE.rankPage.bytes,
    sha256: EVIDENCE.rankPage.sha256,
    pdfUrl: note.pdfUrl,
    pdfBytes: EVIDENCE.rankPdf.bytes,
    pdfSha256: EVIDENCE.rankPdf.sha256,
    records: EXPECTED_RANK_ROWS,
    subjectRecords: { "历史类": 532, "物理类": 562 },
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-16",
    finding: "重新下载河北省教育考试院2026成绩统计正文和18页原始PDF；既有1094条位次记录保持不变，逐条补齐正式页面URL。",
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
  assert(manifest.recordCount === EXPECTED_NEW_RECORD_COUNT, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Hebei control records`);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Hebei rank rows`);
  assert(sourceRankRows.every((record) => record.sourceUrl === expectedRankUrl(record)), "Hebei rank source URL repair drifted");
  assert(rankNote?.pageEvidence?.sha256 === EVIDENCE.rankPage.sha256, "Hebei rank-page provenance drifted");
  assert(rankNote?.pageEvidence?.pdfSha256 === EVIDENCE.rankPdf.sha256, "Hebei rank-PDF provenance drifted");
  return { sourceRecords, sourceRankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "hebei.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);

  assert(payload.dataset === "official-hebei-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "河北" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 50, "Expected fifty special-path records");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    if ([core.generatedAt, manifest.generatedAt, shard.generatedAt].some((value) => value !== payload.generatedAt)) {
      core.generatedAt = payload.generatedAt;
      shard.generatedAt = payload.generatedAt;
      const shardBytes = encodeJson(shard);
      atomicWriteGzip(shardFile, shardBytes);
      const coreBytes = encodeJson(core);
      atomicWriteGzip(coreFile, coreBytes);
      manifest.generatedAt = payload.generatedAt;
      manifest.shards["河北"].bytes = shardBytes.byteLength;
      manifest.shards["河北"].sha256 = sha256(shardBytes);
      manifest.core.bytes = coreBytes.byteLength;
      manifest.core.sha256 = sha256(coreBytes);
      const manifestBytes = encodeJson(manifest);
      atomicWriteGzip(manifestFile, manifestBytes);
      const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestFile, "utf8"));
      runtimeManifest.generatedAt = payload.generatedAt;
      Object.assign(runtimeManifest.after, {
        coreBytes: coreBytes.byteLength,
        coreSha256: sha256(coreBytes),
        hebeiBytes: shardBytes.byteLength,
        hebeiSha256: sha256(shardBytes),
        manifestBytes: manifestBytes.byteLength,
        manifestSha256: sha256(manifestBytes),
      });
      writeJson(runtimeManifestFile, runtimeManifest);
      console.log(JSON.stringify({ status: "metadata-reconciled", modelVersion: core.modelVersion, generatedAt: payload.generatedAt, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.sourceRankRows.length }, null, 2));
      return;
    }
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.sourceRankRows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 846768, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["河北"]?.records === 68463, `Unexpected Hebei base count ${manifest.shards?.["河北"]?.records}`);
  assert(manifest.shards?.["河北"]?.rankConversions === EXPECTED_RANK_ROWS, "Unexpected Hebei rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_RANK_ROWS, `Unexpected Hebei rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const sourceRankRows = rankRows(shard);
  assert(sourceRankRows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Hebei rank rows`);
  assert(sourceRankRows.every((record) => !record.sourceUrl), "Expected all Hebei rank rows to need URL repair");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    hebeiRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: sourceRankRows.filter((record) => !record.sourceUrl).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    hebeiSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of sourceRankRows) record.sourceUrl = expectedRankUrl(record);
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(sourceRankRows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore])), "Hebei rank values changed during provenance repair");
  shard.generatedAt = payload.generatedAt;
  patchRankSourceNote(core);

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
  layer.currentFinding = "河北2026普通历史类本科/专科485/200分、物理类本科/专科443/200分进入普通资格路由；特殊类型、艺术、体育和对口50条保持特殊路径。1094条同年位次记录已逐条补齐正式来源。";
  layer.sourceNotes.push(payload.sourceNotes[0]);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "河北");
  assert(provinceBreakdown, "Hebei province coverage row is missing");
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
  manifest.shards["河北"].records = shard.records.length;
  manifest.shards["河北"].bytes = shardBytes.byteLength;
  manifest.shards["河北"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-hebei-control-lines-2026-v3290-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      hebeiRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankSourceUrlRecords: sourceRankRows.filter((record) => record.sourceUrl === expectedRankUrl(record)).length,
      rankValueChanges: 0,
      rankEvidence: EVIDENCE,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      hebeiBytes: shardBytes.byteLength,
      hebeiSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.hebeiRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Hebei merged count ${runtimeManifest.after.hebeiRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
